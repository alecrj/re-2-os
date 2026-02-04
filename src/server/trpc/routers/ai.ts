/**
 * AI tRPC Router
 *
 * Provides AI-powered listing generation capabilities.
 * Uses OpenAI GPT-4o vision to analyze product images and generate
 * optimized listing content.
 */

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, protectedProcedure } from "../init";
import { generateListing } from "@/server/services/ai";
import { db } from "@/server/db/client";
import { itemImages } from "@/server/db/schema";
import { inArray } from "drizzle-orm";

// ============ INPUT SCHEMAS ============

/**
 * Schema for generating a listing draft from images
 */
const generateDraftInput = z.object({
  /**
   * Array of image IDs from the itemImages table.
   * The service will fetch the URLs from the database.
   */
  imageIds: z
    .array(z.string().min(1))
    .min(1, "At least one image is required")
    .max(4, "Maximum 4 images allowed"),

  /**
   * Optional: Direct image URLs (alternative to imageIds).
   * Use this for images not yet saved to database.
   */
  imageUrls: z
    .array(z.string().url())
    .max(4, "Maximum 4 images allowed")
    .optional(),

  /**
   * Optional user-provided hints to improve accuracy
   */
  userHints: z
    .object({
      category: z.string().optional(),
      brand: z.string().optional(),
      condition: z.string().optional(),
      keywords: z.array(z.string()).optional(),
    })
    .optional(),

  /**
   * Target marketplace for optimization
   */
  targetPlatform: z.enum(["ebay", "poshmark", "mercari"]),
});

/**
 * Schema for regenerating specific parts of a listing
 */
const regenerateFieldInput = z.object({
  /** The field to regenerate */
  field: z.enum(["title", "description"]),
  /** Current listing context for better regeneration */
  currentListing: z.object({
    title: z.string(),
    description: z.string(),
    category: z.string().optional(),
  }),
  /** Target platform */
  targetPlatform: z.enum(["ebay", "poshmark", "mercari"]),
  /** Image URLs for context */
  imageUrls: z.array(z.string().url()).min(1).max(4),
});

// ============ OUTPUT SCHEMAS ============

/**
 * Output schema for generated listing
 * Matches the GeneratedListing type from the AI service
 */
const generatedListingSchema = z.object({
  title: z.string(),
  description: z.string(),
  suggestedPrice: z.object({
    min: z.number(),
    max: z.number(),
    recommended: z.number(),
  }),
  category: z.object({
    suggested: z.string(),
    ebayId: z.string().optional(),
    confidence: z.number(),
  }),
  condition: z.object({
    suggested: z.enum(["NEW", "LIKE_NEW", "GOOD", "FAIR", "POOR"]),
    confidence: z.number(),
  }),
  itemSpecifics: z.array(
    z.object({
      name: z.string(),
      value: z.string(),
      confidence: z.number(),
    })
  ),
  overallConfidence: z.number(),
  tokensUsed: z.number(),
});

// ============ ROUTER ============

export const aiRouter = createTRPCRouter({
  /**
   * Generate a complete listing draft from product images
   *
   * This procedure:
   * 1. Fetches image URLs from the database (if imageIds provided)
   * 2. Calls the AI service to analyze images
   * 3. Returns a complete listing draft with confidence scores
   *
   * Rate limit considerations:
   * - GPT-4o vision calls are expensive (~$0.01-0.03 per call)
   * - Consider implementing rate limiting in production
   */
  generateDraft: protectedProcedure
    .input(generateDraftInput)
    .output(generatedListingSchema)
    .mutation(async ({ input, ctx: _ctx }) => {
      // Determine which image URLs to use
      let imageUrls: string[] = [];

      if (input.imageUrls && input.imageUrls.length > 0) {
        // Use directly provided URLs
        imageUrls = input.imageUrls;
      } else if (input.imageIds && input.imageIds.length > 0) {
        // Fetch URLs from database
        const images = await db
          .select({
            id: itemImages.id,
            originalUrl: itemImages.originalUrl,
            processedUrl: itemImages.processedUrl,
          })
          .from(itemImages)
          .where(inArray(itemImages.id, input.imageIds));

        if (images.length === 0) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "No images found with the provided IDs",
          });
        }

        // Prefer processed URLs (background removed) if available
        imageUrls = images.map((img) => img.processedUrl || img.originalUrl);
      }

      if (imageUrls.length === 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Either imageIds or imageUrls must be provided",
        });
      }

      try {
        // Call the AI service
        const result = await generateListing({
          imageUrls,
          userHints: input.userHints,
          targetPlatform: input.targetPlatform,
        });

        return result;
      } catch (error) {
        // Map service errors to tRPC errors
        const message =
          error instanceof Error ? error.message : "Failed to generate listing";

        // Check for specific error types
        if (message.includes("API key")) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "AI service configuration error. Please contact support.",
          });
        }

        if (message.includes("rate limit")) {
          throw new TRPCError({
            code: "TOO_MANY_REQUESTS",
            message: "AI service is busy. Please try again in a moment.",
          });
        }

        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message,
          cause: error,
        });
      }
    }),

  /**
   * Regenerate a specific field of a listing
   * Useful when the user wants a different title or description
   *
   * Note: This is a simplified endpoint. For production,
   * consider implementing this with streaming for better UX.
   */
  regenerateField: protectedProcedure
    .input(regenerateFieldInput)
    .output(z.object({ value: z.string(), tokensUsed: z.number() }))
    .mutation(async ({ input }) => {
      try {
        // Generate a full listing but only return the requested field
        const result = await generateListing({
          imageUrls: input.imageUrls,
          userHints: {
            category: input.currentListing.category,
          },
          targetPlatform: input.targetPlatform,
        });

        const value =
          input.field === "title" ? result.title : result.description;

        return {
          value,
          tokensUsed: result.tokensUsed,
        };
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : `Failed to regenerate ${input.field}`;

        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message,
          cause: error,
        });
      }
    }),

  /**
   * Check if AI service is available and properly configured
   * Useful for UI to show/hide AI features
   */
  checkAvailability: protectedProcedure.query(async () => {
    const hasApiKey = !!process.env.OPENAI_API_KEY;

    return {
      available: hasApiKey,
      model: hasApiKey ? "gpt-4o" : null,
      features: {
        listingGeneration: hasApiKey,
        imageAnalysis: hasApiKey,
        priceSuggestion: hasApiKey,
      },
    };
  }),
});

// ============ TYPE EXPORTS ============

export type AIRouter = typeof aiRouter;
