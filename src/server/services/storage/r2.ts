/**
 * Cloudflare R2 Storage Service
 *
 * R2 is S3-compatible, so we use the AWS SDK with R2 endpoints.
 * This service provides presigned URLs for direct browser uploads
 * and handles image lifecycle management.
 */

import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

// ============ CONFIGURATION ============

const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID;
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME || "reselleros-images";
const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL;

// Validate required environment variables
function validateConfig(): void {
  const missing: string[] = [];
  if (!R2_ACCOUNT_ID) missing.push("R2_ACCOUNT_ID");
  if (!R2_ACCESS_KEY_ID) missing.push("R2_ACCESS_KEY_ID");
  if (!R2_SECRET_ACCESS_KEY) missing.push("R2_SECRET_ACCESS_KEY");

  if (missing.length > 0) {
    throw new Error(
      `Missing required R2 environment variables: ${missing.join(", ")}`
    );
  }
}

// ============ S3 CLIENT ============

let s3Client: S3Client | null = null;

/**
 * Get or create the S3 client for R2
 * Lazy initialization to avoid errors during build time
 */
function getS3Client(): S3Client {
  if (s3Client) return s3Client;

  validateConfig();

  s3Client = new S3Client({
    region: "auto",
    endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: R2_ACCESS_KEY_ID!,
      secretAccessKey: R2_SECRET_ACCESS_KEY!,
    },
  });

  return s3Client;
}

// ============ TYPES ============

export interface UploadUrlResult {
  /** The presigned URL for uploading */
  uploadUrl: string;
  /** The key (path) where the file will be stored */
  key: string;
  /** The public URL for accessing the file after upload */
  publicUrl: string;
  /** URL expiration time in seconds */
  expiresIn: number;
}

export interface ImageMetadata {
  contentType: string;
  contentLength: number;
  lastModified?: Date;
}

// ============ ALLOWED TYPES ============

const ALLOWED_CONTENT_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
];

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

/**
 * Validate content type is an allowed image type
 */
function validateContentType(contentType: string): void {
  if (!ALLOWED_CONTENT_TYPES.includes(contentType.toLowerCase())) {
    throw new Error(
      `Invalid content type: ${contentType}. Allowed types: ${ALLOWED_CONTENT_TYPES.join(", ")}`
    );
  }
}

// ============ KEY GENERATION ============

/**
 * Generate a unique storage key for an image
 * Format: {userId}/{itemId}/{timestamp}-{random}.{ext}
 */
export function generateImageKey(
  userId: string,
  itemId: string,
  contentType: string
): string {
  const ext = contentType.split("/")[1] || "jpg";
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  return `images/${userId}/${itemId}/${timestamp}-${random}.${ext}`;
}

/**
 * Generate key for processed (background removed) image
 */
export function generateProcessedImageKey(originalKey: string): string {
  const parts = originalKey.split(".");
  const ext = parts.pop();
  return `${parts.join(".")}-processed.${ext}`;
}

// ============ PUBLIC API ============

/**
 * Generate a presigned URL for uploading an image directly from the browser
 *
 * @param key - The storage key (path) for the file
 * @param contentType - The MIME type of the file
 * @param maxSizeBytes - Maximum allowed file size (default 10MB)
 * @returns Upload URL and metadata
 */
export async function getUploadUrl(
  key: string,
  contentType: string,
  maxSizeBytes: number = MAX_FILE_SIZE
): Promise<UploadUrlResult> {
  validateContentType(contentType);

  const client = getS3Client();
  const expiresIn = 3600; // 1 hour

  const command = new PutObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: key,
    ContentType: contentType,
    ContentLength: maxSizeBytes, // Note: actual validation should happen client-side
  });

  const uploadUrl = await getSignedUrl(client, command, { expiresIn });

  // Construct public URL
  const publicUrl = R2_PUBLIC_URL
    ? `${R2_PUBLIC_URL}/${key}`
    : `https://${R2_BUCKET_NAME}.${R2_ACCOUNT_ID}.r2.dev/${key}`;

  return {
    uploadUrl,
    key,
    publicUrl,
    expiresIn,
  };
}

/**
 * Generate a presigned URL for downloading/viewing an image
 * Used for private bucket access; public buckets can use direct URLs
 *
 * @param key - The storage key (path) of the file
 * @param expiresIn - URL validity in seconds (default 1 hour)
 * @returns Presigned download URL
 */
export async function getDownloadUrl(
  key: string,
  expiresIn: number = 3600
): Promise<string> {
  const client = getS3Client();

  const command = new GetObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: key,
  });

  return getSignedUrl(client, command, { expiresIn });
}

/**
 * Get the public URL for an image
 * Use this for images in a public bucket
 *
 * @param key - The storage key (path) of the file
 * @returns Public URL
 */
export function getPublicUrl(key: string): string {
  if (R2_PUBLIC_URL) {
    return `${R2_PUBLIC_URL}/${key}`;
  }
  // Fallback to R2 dev URL (requires public bucket)
  return `https://${R2_BUCKET_NAME}.${R2_ACCOUNT_ID}.r2.dev/${key}`;
}

/**
 * Delete an object from R2 storage
 *
 * @param key - The storage key (path) of the file to delete
 */
export async function deleteObject(key: string): Promise<void> {
  const client = getS3Client();

  const command = new DeleteObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: key,
  });

  await client.send(command);
}

/**
 * Check if an object exists and get its metadata
 *
 * @param key - The storage key (path) of the file
 * @returns Image metadata or null if not found
 */
export async function getObjectMetadata(
  key: string
): Promise<ImageMetadata | null> {
  const client = getS3Client();

  try {
    const command = new HeadObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: key,
    });

    const response = await client.send(command);

    return {
      contentType: response.ContentType || "application/octet-stream",
      contentLength: response.ContentLength || 0,
      lastModified: response.LastModified,
    };
  } catch (error) {
    // Object doesn't exist
    if ((error as { name?: string }).name === "NotFound") {
      return null;
    }
    throw error;
  }
}

/**
 * Delete multiple objects from R2 storage
 * Useful for cleaning up all images for an item
 *
 * @param keys - Array of storage keys to delete
 */
export async function deleteObjects(keys: string[]): Promise<void> {
  // R2 doesn't support bulk delete in the same way as S3,
  // so we delete objects individually
  await Promise.all(keys.map((key) => deleteObject(key)));
}

// ============ EXPORTS ============

export const r2Storage = {
  getUploadUrl,
  getDownloadUrl,
  getPublicUrl,
  deleteObject,
  deleteObjects,
  getObjectMetadata,
  generateImageKey,
  generateProcessedImageKey,
  ALLOWED_CONTENT_TYPES,
  MAX_FILE_SIZE,
};

export default r2Storage;
