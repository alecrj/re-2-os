/**
 * Images tRPC Router
 *
 * Handles image upload, confirmation, and deletion via R2 storage.
 * Uses presigned URLs for direct browser-to-R2 uploads.
 */

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, protectedProcedure } from "../init";
import { r2Storage, generateImageKey } from "@/server/services/storage/r2";
import { db } from "@/server/db/client";
import { itemImages } from "@/server/db/schema";
import { eq, and, max } from "drizzle-orm";
import { generateId } from "@/lib/utils";

// ============ INPUT SCHEMAS ============

const getUploadUrlInput = z.object({
  itemId: z.string().min(1, "Item ID is required"),
  contentType: z.enum([
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/webp",
    "image/heic",
    "image/heif",
  ]),
  /** Optional: specify position for multi-image uploads */
  position: z.number().int().nonnegative().optional(),
});

const confirmUploadInput = z.object({
  itemId: z.string().min(1, "Item ID is required"),
  key: z.string().min(1, "Storage key is required"),
  /** Actual file size in bytes */
  sizeBytes: z.number().int().positive().optional(),
  /** Image dimensions */
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  /** Position in image gallery */
  position: z.number().int().nonnegative().optional(),
});

const deleteImageInput = z.object({
  imageId: z.string().min(1, "Image ID is required"),
});

const reorderImagesInput = z.object({
  itemId: z.string().min(1, "Item ID is required"),
  /** Array of image IDs in desired order */
  imageIds: z.array(z.string()).min(1, "At least one image ID required"),
});

const getImagesInput = z.object({
  itemId: z.string().min(1, "Item ID is required"),
});

// ============ ROUTER ============

export const imagesRouter = createTRPCRouter({
  /**
   * Get a presigned URL for uploading an image
   * Returns the URL and the key where the image will be stored
   */
  getUploadUrl: protectedProcedure
    .input(getUploadUrlInput)
    .mutation(async ({ input, ctx: _ctx }) => {
      // In a real app, we'd verify the user owns this item
      // const userId = ctx.user.id;
      const userId = "demo-user"; // Placeholder until auth is implemented

      try {
        // Generate a unique key for this image
        const key = generateImageKey(userId, input.itemId, input.contentType);

        // Get the presigned upload URL
        const result = await r2Storage.getUploadUrl(key, input.contentType);

        return {
          uploadUrl: result.uploadUrl,
          key: result.key,
          publicUrl: result.publicUrl,
          expiresIn: result.expiresIn,
        };
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Failed to generate upload URL";
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message,
          cause: error,
        });
      }
    }),

  /**
   * Confirm an image upload and create the database record
   * Called after the browser has successfully uploaded to R2
   */
  confirmUpload: protectedProcedure
    .input(confirmUploadInput)
    .mutation(async ({ input, ctx: _ctx }) => {
      // Verify the upload exists in R2
      const metadata = await r2Storage.getObjectMetadata(input.key);
      if (!metadata) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Upload not found. Please try uploading again.",
        });
      }

      // Get the next position if not specified
      let position = input.position;
      if (position === undefined) {
        const maxPositionResult = await db
          .select({ maxPos: max(itemImages.position) })
          .from(itemImages)
          .where(eq(itemImages.itemId, input.itemId));
        position = (maxPositionResult[0]?.maxPos ?? -1) + 1;
      }

      // Create the database record
      const imageId = generateId();
      const publicUrl = r2Storage.getPublicUrl(input.key);

      const now = new Date();
      await db.insert(itemImages).values({
        id: imageId,
        itemId: input.itemId,
        originalUrl: publicUrl,
        position,
        width: input.width,
        height: input.height,
        sizeBytes: input.sizeBytes ?? metadata.contentLength,
        createdAt: now,
      });

      return {
        id: imageId,
        originalUrl: publicUrl,
        position,
        width: input.width,
        height: input.height,
        sizeBytes: input.sizeBytes ?? metadata.contentLength,
        createdAt: now,
      };
    }),

  /**
   * Delete an image from R2 and the database
   */
  delete: protectedProcedure
    .input(deleteImageInput)
    .mutation(async ({ input, ctx: _ctx }) => {
      // Get the image record
      const images = await db
        .select()
        .from(itemImages)
        .where(eq(itemImages.id, input.imageId))
        .limit(1);

      const image = images[0];
      if (!image) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Image not found",
        });
      }

      // In a real app, verify the user owns this item
      // const item = await db.select().from(inventoryItems)
      //   .where(and(
      //     eq(inventoryItems.id, image.itemId),
      //     eq(inventoryItems.userId, ctx.user.id)
      //   )).limit(1);

      // Extract the key from the URL
      const extractKeyFromUrl = (url: string): string => {
        // URL format: https://bucket.account.r2.dev/images/userId/itemId/file.ext
        // or: https://custom-domain.com/images/userId/itemId/file.ext
        const urlObj = new URL(url);
        return urlObj.pathname.startsWith("/")
          ? urlObj.pathname.slice(1)
          : urlObj.pathname;
      };

      const keysToDelete: string[] = [];

      // Add original image key
      keysToDelete.push(extractKeyFromUrl(image.originalUrl));

      // Add processed image key if it exists
      if (image.processedUrl) {
        keysToDelete.push(extractKeyFromUrl(image.processedUrl));
      }

      // Delete from R2
      try {
        await r2Storage.deleteObjects(keysToDelete);
      } catch (error) {
        // Log but don't fail - the DB record deletion is more important
        console.error("Failed to delete from R2:", error);
      }

      // Delete from database
      await db.delete(itemImages).where(eq(itemImages.id, input.imageId));

      // Re-order remaining images to fill the gap
      const remainingImages = await db
        .select()
        .from(itemImages)
        .where(eq(itemImages.itemId, image.itemId))
        .orderBy(itemImages.position);

      // Update positions to be sequential
      for (let i = 0; i < remainingImages.length; i++) {
        if (remainingImages[i].position !== i) {
          await db
            .update(itemImages)
            .set({ position: i })
            .where(eq(itemImages.id, remainingImages[i].id));
        }
      }

      return { success: true, deletedId: input.imageId };
    }),

  /**
   * Reorder images for an item
   */
  reorder: protectedProcedure
    .input(reorderImagesInput)
    .mutation(async ({ input, ctx: _ctx }) => {
      // Update positions based on the order of imageIds
      for (let i = 0; i < input.imageIds.length; i++) {
        await db
          .update(itemImages)
          .set({ position: i })
          .where(
            and(
              eq(itemImages.id, input.imageIds[i]),
              eq(itemImages.itemId, input.itemId)
            )
          );
      }

      return { success: true };
    }),

  /**
   * Get all images for an item
   */
  getByItemId: protectedProcedure
    .input(getImagesInput)
    .query(async ({ input }) => {
      const images = await db
        .select()
        .from(itemImages)
        .where(eq(itemImages.itemId, input.itemId))
        .orderBy(itemImages.position);

      return images.map((img) => ({
        id: img.id,
        itemId: img.itemId,
        originalUrl: img.originalUrl,
        processedUrl: img.processedUrl,
        position: img.position,
        width: img.width,
        height: img.height,
        sizeBytes: img.sizeBytes,
        createdAt: img.createdAt,
      }));
    }),

  /**
   * Set the processed (background removed) URL for an image
   * Called after background removal processing is complete
   */
  setProcessedUrl: protectedProcedure
    .input(
      z.object({
        imageId: z.string(),
        processedUrl: z.string().url(),
      })
    )
    .mutation(async ({ input }) => {
      await db
        .update(itemImages)
        .set({ processedUrl: input.processedUrl })
        .where(eq(itemImages.id, input.imageId));

      return { success: true };
    }),

  /**
   * Delete all images for an item
   * Used when deleting an inventory item
   */
  deleteAllForItem: protectedProcedure
    .input(z.object({ itemId: z.string() }))
    .mutation(async ({ input }) => {
      // Get all images for the item
      const images = await db
        .select()
        .from(itemImages)
        .where(eq(itemImages.itemId, input.itemId));

      if (images.length === 0) {
        return { success: true, deletedCount: 0 };
      }

      // Extract keys from URLs
      const extractKeyFromUrl = (url: string): string => {
        const urlObj = new URL(url);
        return urlObj.pathname.startsWith("/")
          ? urlObj.pathname.slice(1)
          : urlObj.pathname;
      };

      const keysToDelete: string[] = [];
      for (const image of images) {
        keysToDelete.push(extractKeyFromUrl(image.originalUrl));
        if (image.processedUrl) {
          keysToDelete.push(extractKeyFromUrl(image.processedUrl));
        }
      }

      // Delete from R2
      try {
        await r2Storage.deleteObjects(keysToDelete);
      } catch (error) {
        console.error("Failed to delete images from R2:", error);
      }

      // Delete from database
      await db.delete(itemImages).where(eq(itemImages.itemId, input.itemId));

      return { success: true, deletedCount: images.length };
    }),
});
