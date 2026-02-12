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
import {
  removeBackground,
  checkBgRemovalQuota,
} from "@/server/services/ai/background-removal";
import { suggestPrice } from "@/server/services/ai/price-suggestion";
import { db } from "@/server/db/client";
import { inventoryItems, itemImages } from "@/server/db/schema";
import { eq, inArray } from "drizzle-orm";

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
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        imageUrls = images.map((img: any) => img.processedUrl || img.originalUrl);
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
   * Get AI-powered price suggestion for an inventory item
   *
   * Can be called with an item ID (fetches details from DB) or
   * with direct item details for items not yet saved.
   */
  suggestPrice: protectedProcedure
    .input(
      z.object({
        /** Provide itemId to fetch details from DB */
        itemId: z.string().optional(),
        /** Or provide details directly */
        title: z.string().optional(),
        description: z.string().optional(),
        condition: z
          .enum(["new", "like_new", "good", "fair", "poor"])
          .optional(),
        category: z.string().optional(),
        brand: z.string().optional(),
        costBasis: z.number().optional(),
        originalRetailPrice: z.number().optional(),
        targetPlatform: z.enum(["ebay", "poshmark", "mercari"]).default("ebay"),
      })
    )
    .mutation(async ({ input }) => {
      let title = input.title ?? "";
      let description = input.description;
      let condition = input.condition ?? "good";
      let category = input.category;
      let costBasis = input.costBasis;
      let imageUrls: string[] = [];

      // If itemId provided, fetch item details from DB
      if (input.itemId) {
        const item = await db.query.inventoryItems.findFirst({
          where: eq(inventoryItems.id, input.itemId),
          with: { images: true },
        });

        if (!item) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Item not found",
          });
        }

        title = title || item.title;
        description = description ?? item.description;
        condition = input.condition ?? (item.condition as typeof condition);
        category = category ?? item.suggestedCategory ?? undefined;
        costBasis = costBasis ?? item.costBasis ?? undefined;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        imageUrls = (item.images as any[])
          .sort((a: { position: number }, b: { position: number }) => a.position - b.position)
          .slice(0, 4)
          .map((img: { processedUrl?: string; originalUrl: string }) =>
            img.processedUrl || img.originalUrl
          );
      }

      if (!title) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Item title is required (provide title or itemId)",
        });
      }

      try {
        const result = await suggestPrice({
          title,
          description,
          condition,
          category,
          brand: input.brand,
          imageUrls: imageUrls.length > 0 ? imageUrls : undefined,
          targetPlatform: input.targetPlatform,
          costBasis,
          originalRetailPrice: input.originalRetailPrice,
        });

        return result;
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Price suggestion failed";

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
   * Remove background from a product image
   *
   * Pipeline:
   * 1. Check user quota
   * 2. Fetch image from DB
   * 3. Call remove.bg API
   * 4. Upload processed image to R2
   * 5. Update DB record with processed URL
   * 6. Increment usage count
   */
  removeBackground: protectedProcedure
    .input(
      z.object({
        imageId: z.string().min(1, "Image ID is required"),
        options: z
          .object({
            size: z
              .enum(["auto", "preview", "small", "medium", "hd"])
              .optional(),
            format: z.enum(["png", "webp"]).optional(),
            bgColor: z.string().optional(),
          })
          .optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const result = await removeBackground(
        ctx.user.id,
        input.imageId,
        input.options
      );

      if (!result.success) {
        throw new TRPCError({
          code: result.error?.includes("quota")
            ? "FORBIDDEN"
            : "INTERNAL_SERVER_ERROR",
          message: result.error ?? "Background removal failed",
        });
      }

      return {
        processedUrl: result.processedUrl!,
        processingTimeMs: result.processingTimeMs,
      };
    }),

  /**
   * Check the user's background removal quota
   */
  bgRemovalQuota: protectedProcedure.query(async ({ ctx }) => {
    return checkBgRemovalQuota(ctx.user.id);
  }),

  /**
   * Check if AI service is available and properly configured
   * Useful for UI to show/hide AI features
   */
  checkAvailability: protectedProcedure.query(async () => {
    const hasApiKey = !!process.env.OPENAI_API_KEY;
    const hasRemoveBgKey = !!process.env.REMOVE_BG_API_KEY;

    return {
      available: hasApiKey,
      model: hasApiKey ? "gpt-4o" : null,
      features: {
        listingGeneration: hasApiKey,
        imageAnalysis: hasApiKey,
        priceSuggestion: hasApiKey,
        backgroundRemoval: hasRemoveBgKey,
      },
    };
  }),
});

// ============ TYPE EXPORTS ============

export type AIRouter = typeof aiRouter;
