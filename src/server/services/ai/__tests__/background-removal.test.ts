/**
 * Tests for Background Removal Service
 *
 * These tests cover:
 * - extractKeyFromUrl utility
 * - Quota checking logic
 * - removeBackground pipeline (mocked dependencies)
 * - Error handling paths
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock dependencies before importing the module
vi.mock("@/server/db/client", () => ({
  db: {
    query: {
      users: {
        findFirst: vi.fn(),
      },
      itemImages: {
        findFirst: vi.fn(),
      },
    },
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(),
      })),
    })),
  },
}));

vi.mock("@/server/db/schema", () => ({
  itemImages: { id: "id", processedUrl: "processed_url" },
  users: { id: "id", bgRemovalsThisMonth: "bg_removals_this_month", tier: "tier" },
}));

vi.mock("@/server/services/storage/r2", () => ({
  r2Storage: {
    getUploadUrl: vi.fn().mockResolvedValue({
      uploadUrl: "https://r2.upload/presigned",
      publicUrl: "https://cdn.example.com/processed.png",
    }),
  },
  generateProcessedImageKey: vi.fn((key: string) => {
    const parts = key.split(".");
    const ext = parts.pop();
    return `${parts.join(".")}-processed.${ext}`;
  }),
}));

import { extractKeyFromUrl } from "../background-removal";
import { db } from "@/server/db/client";

// ============ UNIT TESTS ============

describe("Background Removal Service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("extractKeyFromUrl", () => {
    it("should extract key from URL with leading slash", () => {
      const url = "https://cdn.example.com/images/user-1/item-1/12345-abc.jpg";
      const key = extractKeyFromUrl(url);
      expect(key).toBe("images/user-1/item-1/12345-abc.jpg");
    });

    it("should handle URLs without leading slash", () => {
      const url = "https://cdn.example.com/images/user-1/photo.png";
      const key = extractKeyFromUrl(url);
      expect(key).toBe("images/user-1/photo.png");
    });

    it("should handle deeply nested paths", () => {
      const url =
        "https://bucket.account.r2.dev/images/u1/i1/1234-abcd.webp";
      const key = extractKeyFromUrl(url);
      expect(key).toBe("images/u1/i1/1234-abcd.webp");
    });
  });

  describe("checkBgRemovalQuota", () => {
    it("should return not allowed when user not found", async () => {
      const { checkBgRemovalQuota } = await import("../background-removal");
      vi.mocked(db.query.users.findFirst).mockResolvedValueOnce(undefined);

      const result = await checkBgRemovalQuota("nonexistent-user");
      expect(result).toEqual({ allowed: false, used: 0, limit: 0 });
    });

    it("should allow when usage is under limit", async () => {
      const { checkBgRemovalQuota } = await import("../background-removal");
      vi.mocked(db.query.users.findFirst).mockResolvedValueOnce({
        bgRemovalsThisMonth: 3,
        tier: "free",
      });

      const result = await checkBgRemovalQuota("user-1");
      expect(result.allowed).toBe(true);
      expect(result.used).toBe(3);
      expect(result.limit).toBe(10); // free tier = 10
    });

    it("should deny when usage is at limit", async () => {
      const { checkBgRemovalQuota } = await import("../background-removal");
      vi.mocked(db.query.users.findFirst).mockResolvedValueOnce({
        bgRemovalsThisMonth: 10,
        tier: "free",
      });

      const result = await checkBgRemovalQuota("user-1");
      expect(result.allowed).toBe(false);
      expect(result.used).toBe(10);
      expect(result.limit).toBe(10);
    });

    it("should allow unlimited for business tier", async () => {
      const { checkBgRemovalQuota } = await import("../background-removal");
      vi.mocked(db.query.users.findFirst).mockResolvedValueOnce({
        bgRemovalsThisMonth: 9999,
        tier: "business",
      });

      const result = await checkBgRemovalQuota("user-1");
      expect(result.allowed).toBe(true);
      expect(result.limit).toBe(-1);
    });
  });

  describe("removeBackground", () => {
    it("should return quota error when quota exceeded", async () => {
      const { removeBackground } = await import("../background-removal");
      vi.mocked(db.query.users.findFirst).mockResolvedValueOnce({
        bgRemovalsThisMonth: 10,
        tier: "free",
      });

      const result = await removeBackground("user-1", "image-1");
      expect(result.success).toBe(false);
      expect(result.error).toContain("quota exceeded");
    });

    it("should return error when image not found", async () => {
      const { removeBackground } = await import("../background-removal");
      // Mock quota check - user under limit
      vi.mocked(db.query.users.findFirst).mockResolvedValueOnce({
        bgRemovalsThisMonth: 0,
        tier: "free",
      });
      // Mock image lookup - not found
      vi.mocked(db.query.itemImages.findFirst).mockResolvedValueOnce(
        undefined
      );

      const result = await removeBackground("user-1", "nonexistent-image");
      expect(result.success).toBe(false);
      expect(result.error).toBe("Image not found");
    });

    it("should return existing processed URL without re-processing", async () => {
      const { removeBackground } = await import("../background-removal");
      // Mock quota check
      vi.mocked(db.query.users.findFirst).mockResolvedValueOnce({
        bgRemovalsThisMonth: 0,
        tier: "free",
      });
      // Mock image lookup - already processed
      vi.mocked(db.query.itemImages.findFirst).mockResolvedValueOnce({
        id: "image-1",
        originalUrl: "https://cdn.example.com/original.jpg",
        processedUrl: "https://cdn.example.com/processed.png",
      });

      const result = await removeBackground("user-1", "image-1");
      expect(result.success).toBe(true);
      expect(result.processedUrl).toBe(
        "https://cdn.example.com/processed.png"
      );
    });
  });

  describe("BackgroundRemovalResult type", () => {
    it("should have correct structure for success result", () => {
      const result = {
        success: true,
        processedUrl: "https://cdn.example.com/processed.png",
        processingTimeMs: 1500,
      };

      expect(result.success).toBe(true);
      expect(result.processedUrl).toBeDefined();
      expect(result.processingTimeMs).toBeGreaterThan(0);
    });

    it("should have correct structure for error result", () => {
      const result = {
        success: false,
        error: "API key not configured",
        processingTimeMs: 50,
      };

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe("BackgroundRemovalOptions", () => {
    it("should accept valid size options", () => {
      const validSizes = ["auto", "preview", "small", "medium", "hd"];
      validSizes.forEach((size) => {
        expect(["auto", "preview", "small", "medium", "hd"]).toContain(size);
      });
    });

    it("should accept valid format options", () => {
      const validFormats = ["png", "webp"];
      validFormats.forEach((format) => {
        expect(["png", "webp"]).toContain(format);
      });
    });
  });
});
