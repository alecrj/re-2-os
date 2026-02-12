/**
 * Background Removal Service
 *
 * Removes backgrounds from product images using an external API.
 * Processed images are stored in R2 alongside the originals.
 *
 * Supports multiple providers:
 * - remove.bg (default) - High quality, paid API
 * - Fallback: stores original as processed URL if API unavailable
 *
 * Usage tracking is enforced per user/month via the users table
 * (bgRemovalsThisMonth field).
 */

import { db } from "@/server/db/client";
import { itemImages, users } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import {
  r2Storage,
  generateProcessedImageKey,
} from "@/server/services/storage/r2";

// ============ CONFIGURATION ============

const REMOVE_BG_API_KEY = process.env.REMOVE_BG_API_KEY;
const REMOVE_BG_API_URL = "https://api.remove.bg/v1.0/removebg";

// ============ TYPES ============

export interface BackgroundRemovalResult {
  success: boolean;
  processedUrl?: string;
  error?: string;
  processingTimeMs?: number;
}

export interface BackgroundRemovalOptions {
  /** Image size: "auto", "preview" (up to 0.25MP), "small" (up to 0.25MP), "medium" (up to 1.5MP), "hd" (up to 4MP) */
  size?: "auto" | "preview" | "small" | "medium" | "hd";
  /** Output format */
  format?: "png" | "webp";
  /** Background color (hex without #, or "transparent") */
  bgColor?: string;
}

// ============ USAGE TRACKING ============

/**
 * Check if the user has remaining background removal quota
 */
export async function checkBgRemovalQuota(userId: string): Promise<{
  allowed: boolean;
  used: number;
  limit: number;
}> {
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: {
      bgRemovalsThisMonth: true,
      tier: true,
    },
  });

  if (!user) {
    return { allowed: false, used: 0, limit: 0 };
  }

  // Import tier limits
  const { PRICING_TIERS } = await import("@/lib/constants");
  const tierConfig = PRICING_TIERS[user.tier as keyof typeof PRICING_TIERS];
  const limit = tierConfig.bgRemovals;

  // -1 means unlimited
  if (limit === -1) {
    return { allowed: true, used: user.bgRemovalsThisMonth, limit: -1 };
  }

  return {
    allowed: user.bgRemovalsThisMonth < limit,
    used: user.bgRemovalsThisMonth,
    limit,
  };
}

/**
 * Increment the user's background removal usage count
 */
export async function incrementBgRemovalUsage(userId: string): Promise<void> {
  await db
    .update(users)
    .set({
      bgRemovalsThisMonth: (await db.query.users.findFirst({
        where: eq(users.id, userId),
        columns: { bgRemovalsThisMonth: true },
      }))!.bgRemovalsThisMonth + 1,
    })
    .where(eq(users.id, userId));
}

// ============ BACKGROUND REMOVAL ============

/**
 * Call the remove.bg API to remove the background from an image
 *
 * @param imageUrl - URL of the image to process
 * @param options - Processing options
 * @returns The processed image as a Buffer
 */
export async function callRemoveBgApi(
  imageUrl: string,
  options: BackgroundRemovalOptions = {}
): Promise<Buffer> {
  if (!REMOVE_BG_API_KEY) {
    throw new Error("REMOVE_BG_API_KEY environment variable is not set");
  }

  const formData = new FormData();
  formData.append("image_url", imageUrl);
  formData.append("size", options.size ?? "auto");
  formData.append("format", options.format ?? "png");

  if (options.bgColor && options.bgColor !== "transparent") {
    formData.append("bg_color", options.bgColor);
  }

  const response = await fetch(REMOVE_BG_API_URL, {
    method: "POST",
    headers: {
      "X-Api-Key": REMOVE_BG_API_KEY,
    },
    body: formData,
  });

  if (!response.ok) {
    const errorText = await response.text();
    let errorMessage: string;
    try {
      const errorJson = JSON.parse(errorText);
      errorMessage = errorJson.errors?.[0]?.title ?? `API error: ${response.status}`;
    } catch {
      errorMessage = `Background removal API error: ${response.status}`;
    }
    throw new Error(errorMessage);
  }

  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

/**
 * Upload a processed image buffer to R2
 *
 * @param originalKey - The R2 key of the original image
 * @param imageBuffer - The processed image data
 * @param contentType - The MIME type of the processed image
 * @returns The public URL of the uploaded processed image
 */
export async function uploadProcessedImage(
  originalKey: string,
  imageBuffer: Buffer,
  contentType: string = "image/png"
): Promise<string> {
  const processedKey = generateProcessedImageKey(originalKey);

  // Get presigned upload URL
  const { uploadUrl, publicUrl } = await r2Storage.getUploadUrl(
    processedKey,
    contentType
  );

  // Upload the processed image (convert Buffer to Uint8Array for fetch compatibility)
  const uploadResponse = await fetch(uploadUrl, {
    method: "PUT",
    headers: {
      "Content-Type": contentType,
      "Content-Length": imageBuffer.length.toString(),
    },
    body: new Uint8Array(imageBuffer),
  });

  if (!uploadResponse.ok) {
    throw new Error(`Failed to upload processed image: ${uploadResponse.status}`);
  }

  return publicUrl;
}

/**
 * Extract the R2 storage key from a public URL
 */
export function extractKeyFromUrl(url: string): string {
  const urlObj = new URL(url);
  return urlObj.pathname.startsWith("/")
    ? urlObj.pathname.slice(1)
    : urlObj.pathname;
}

/**
 * Remove the background from an image and save the result to R2
 *
 * Full pipeline:
 * 1. Check user quota
 * 2. Get the image URL from the database
 * 3. Call the background removal API
 * 4. Upload the processed image to R2
 * 5. Update the database record with the processed URL
 * 6. Increment usage count
 *
 * @param userId - The user's ID (for quota tracking)
 * @param imageId - The image record ID in the database
 * @param options - Processing options
 */
export async function removeBackground(
  userId: string,
  imageId: string,
  options: BackgroundRemovalOptions = {}
): Promise<BackgroundRemovalResult> {
  const startTime = Date.now();

  // Step 1: Check quota
  const quota = await checkBgRemovalQuota(userId);
  if (!quota.allowed) {
    return {
      success: false,
      error: `Background removal quota exceeded (${quota.used}/${quota.limit} this month). Upgrade your plan for more.`,
    };
  }

  // Step 2: Get image from database
  const image = await db.query.itemImages.findFirst({
    where: eq(itemImages.id, imageId),
  });

  if (!image) {
    return {
      success: false,
      error: "Image not found",
    };
  }

  // If already processed, return the existing URL
  if (image.processedUrl) {
    return {
      success: true,
      processedUrl: image.processedUrl,
      processingTimeMs: Date.now() - startTime,
    };
  }

  try {
    // Step 3: Call background removal API
    const processedBuffer = await callRemoveBgApi(image.originalUrl, options);

    // Step 4: Upload processed image to R2
    const originalKey = extractKeyFromUrl(image.originalUrl);
    const processedUrl = await uploadProcessedImage(
      originalKey,
      processedBuffer,
      `image/${options.format ?? "png"}`
    );

    // Step 5: Update database record
    await db
      .update(itemImages)
      .set({ processedUrl })
      .where(eq(itemImages.id, imageId));

    // Step 6: Increment usage
    await incrementBgRemovalUsage(userId);

    return {
      success: true,
      processedUrl,
      processingTimeMs: Date.now() - startTime,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Background removal failed";
    console.error(`[BackgroundRemoval] Error processing image ${imageId}:`, error);

    return {
      success: false,
      error: errorMessage,
      processingTimeMs: Date.now() - startTime,
    };
  }
}

// ============ EXPORTS ============

export const backgroundRemovalService = {
  removeBackground,
  checkBgRemovalQuota,
  callRemoveBgApi,
  uploadProcessedImage,
  extractKeyFromUrl,
};
