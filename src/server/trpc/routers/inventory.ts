import { z } from "zod";
import { createTRPCRouter, publicProcedure, protectedProcedure } from "../init";
import { db } from "@/server/db/client";
import { inventoryItems, itemImages, channelListings } from "@/server/db/schema";
import { eq, and, desc, like, inArray, count } from "drizzle-orm";
import { TRPCError } from "@trpc/server";

// Status enum for type safety
const statusEnum = z.enum(["draft", "active", "sold", "shipped", "archived"]);
const conditionEnum = z.enum(["new", "like_new", "good", "fair", "poor"]);

export const inventoryRouter = createTRPCRouter({
  /**
   * Get inventory statistics for dashboard
   */
  getStats: publicProcedure.query(async ({ ctx }) => {
    const userId = ctx.user?.id;
    if (!userId) {
      return { total: 0, active: 0, draft: 0, sold: 0 };
    }

    const stats = await db
      .select({
        status: inventoryItems.status,
        count: count(),
      })
      .from(inventoryItems)
      .where(eq(inventoryItems.userId, userId))
      .groupBy(inventoryItems.status);

    const result = { total: 0, active: 0, draft: 0, sold: 0 };
    for (const stat of stats) {
      const cnt = Number(stat.count);
      result.total += cnt;
      if (stat.status === "active") result.active = cnt;
      if (stat.status === "draft") result.draft = cnt;
      if (stat.status === "sold") result.sold = cnt;
    }

    return result;
  }),

  /**
   * Get all inventory items for the current user with pagination
   */
  list: publicProcedure
    .input(
      z.object({
        status: statusEnum.optional(),
        channel: z.enum(["ebay", "poshmark", "mercari", "depop"]).optional(),
        search: z.string().optional(),
        limit: z.number().min(1).max(100).default(20),
        cursor: z.string().optional(),
      })
    )
    .query(async ({ input, ctx }) => {
      const userId = ctx.user?.id;
      if (!userId) {
        return { items: [], nextCursor: undefined };
      }

      // Build conditions
      const conditions = [eq(inventoryItems.userId, userId)];

      if (input.status) {
        conditions.push(eq(inventoryItems.status, input.status));
      }

      if (input.search) {
        conditions.push(like(inventoryItems.title, `%${input.search}%`));
      }

      // Get items with images
      const items = await db.query.inventoryItems.findMany({
        where: and(...conditions),
        with: {
          images: {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            orderBy: (images: any, { asc }: any) => [asc(images.position)],
            limit: 1,
          },
          channelListings: true,
        },
        orderBy: [desc(inventoryItems.createdAt)],
        limit: input.limit + 1,
      });

      // Handle cursor-based pagination
      let nextCursor: string | undefined;
      if (items.length > input.limit) {
        const nextItem = items.pop();
        nextCursor = nextItem?.id;
      }

      return {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        items: items.map((item: any) => ({
          id: item.id,
          sku: item.sku,
          title: item.title,
          askingPrice: item.askingPrice,
          floorPrice: item.floorPrice,
          costBasis: item.costBasis,
          status: item.status,
          condition: item.condition,
          quantity: item.quantity,
          createdAt: item.createdAt,
          listedAt: item.listedAt,
          imageUrl: item.images[0]?.processedUrl || item.images[0]?.originalUrl || null,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          channels: item.channelListings.map((cl: any) => ({
            channel: cl.channel,
            status: cl.status,
            externalUrl: cl.externalUrl,
          })),
          daysActive: item.listedAt
            ? Math.floor((Date.now() - item.listedAt.getTime()) / (1000 * 60 * 60 * 24))
            : null,
        })),
        nextCursor,
      };
    }),

  /**
   * Get a single inventory item by ID with all details
   */
  getById: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input, ctx }) => {
      const userId = ctx.user?.id;
      if (!userId) {
        throw new TRPCError({ code: "UNAUTHORIZED" });
      }

      const item = await db.query.inventoryItems.findFirst({
        where: and(
          eq(inventoryItems.id, input.id),
          eq(inventoryItems.userId, userId)
        ),
        with: {
          images: {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            orderBy: (images: any, { asc }: any) => [asc(images.position)],
          },
          channelListings: true,
        },
      });

      if (!item) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Item not found" });
      }

      return {
        id: item.id,
        sku: item.sku,
        title: item.title,
        description: item.description,
        condition: item.condition,
        askingPrice: item.askingPrice,
        floorPrice: item.floorPrice,
        costBasis: item.costBasis,
        status: item.status,
        quantity: item.quantity,
        aiConfidence: item.aiConfidence,
        suggestedCategory: item.suggestedCategory,
        itemSpecifics: item.itemSpecifics,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
        listedAt: item.listedAt,
        soldAt: item.soldAt,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        images: item.images.map((img: any) => ({
          id: img.id,
          originalUrl: img.originalUrl,
          processedUrl: img.processedUrl,
          position: img.position,
          width: img.width,
          height: img.height,
          sizeBytes: img.sizeBytes,
        })),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        channelListings: item.channelListings.map((cl: any) => ({
          id: cl.id,
          channel: cl.channel,
          status: cl.status,
          price: cl.price,
          externalId: cl.externalId,
          externalUrl: cl.externalUrl,
          publishedAt: cl.publishedAt,
        })),
      };
    }),

  /**
   * Create a new inventory item
   */
  create: protectedProcedure
    .input(
      z.object({
        title: z.string().min(1).max(80),
        description: z.string().min(1),
        condition: conditionEnum,
        askingPrice: z.number().positive(),
        floorPrice: z.number().positive().optional(),
        costBasis: z.number().nonnegative().optional(),
        quantity: z.number().int().positive().default(1),
        itemSpecifics: z.record(z.string()).optional(),
        suggestedCategory: z.string().optional(),
        aiConfidence: z.number().min(0).max(1).optional(),
        imageIds: z.array(z.string()).optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const userId = ctx.user.id;
      const now = new Date();
      const id = crypto.randomUUID();
      const sku = `SKU-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

      await db.insert(inventoryItems).values({
        id,
        userId,
        sku,
        title: input.title,
        description: input.description,
        condition: input.condition,
        askingPrice: input.askingPrice,
        floorPrice: input.floorPrice ?? null,
        costBasis: input.costBasis ?? null,
        quantity: input.quantity,
        itemSpecifics: input.itemSpecifics ?? null,
        suggestedCategory: input.suggestedCategory ?? null,
        aiConfidence: input.aiConfidence ?? null,
        status: "draft",
        createdAt: now,
        updatedAt: now,
      });

      // If imageIds provided, associate them with this item
      if (input.imageIds && input.imageIds.length > 0) {
        await db
          .update(itemImages)
          .set({ itemId: id })
          .where(inArray(itemImages.id, input.imageIds));
      }

      return { id, sku };
    }),

  /**
   * Update an inventory item
   */
  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        title: z.string().min(1).max(80).optional(),
        description: z.string().min(1).optional(),
        condition: conditionEnum.optional(),
        askingPrice: z.number().positive().optional(),
        floorPrice: z.number().positive().nullable().optional(),
        costBasis: z.number().nonnegative().nullable().optional(),
        quantity: z.number().int().positive().optional(),
        status: statusEnum.optional(),
        itemSpecifics: z.record(z.string()).nullable().optional(),
        suggestedCategory: z.string().nullable().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const userId = ctx.user.id;
      const { id, ...updates } = input;

      // Verify ownership
      const item = await db.query.inventoryItems.findFirst({
        where: and(
          eq(inventoryItems.id, id),
          eq(inventoryItems.userId, userId)
        ),
      });

      if (!item) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Item not found" });
      }

      // Build update object
      const updateData: Record<string, unknown> = {
        updatedAt: new Date(),
      };

      if (updates.title !== undefined) updateData.title = updates.title;
      if (updates.description !== undefined) updateData.description = updates.description;
      if (updates.condition !== undefined) updateData.condition = updates.condition;
      if (updates.askingPrice !== undefined) updateData.askingPrice = updates.askingPrice;
      if (updates.floorPrice !== undefined) updateData.floorPrice = updates.floorPrice;
      if (updates.costBasis !== undefined) updateData.costBasis = updates.costBasis;
      if (updates.quantity !== undefined) updateData.quantity = updates.quantity;
      if (updates.status !== undefined) {
        updateData.status = updates.status;
        if (updates.status === "active" && !item.listedAt) {
          updateData.listedAt = new Date();
        }
        if (updates.status === "sold" && !item.soldAt) {
          updateData.soldAt = new Date();
        }
      }
      if (updates.itemSpecifics !== undefined) updateData.itemSpecifics = updates.itemSpecifics;
      if (updates.suggestedCategory !== undefined) updateData.suggestedCategory = updates.suggestedCategory;

      await db
        .update(inventoryItems)
        .set(updateData)
        .where(eq(inventoryItems.id, id));

      return { success: true };
    }),

  /**
   * Delete inventory items (supports bulk delete)
   */
  delete: protectedProcedure
    .input(
      z.object({
        ids: z.array(z.string()).min(1),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const userId = ctx.user.id;

      // Verify ownership of all items
      const items = await db
        .select({ id: inventoryItems.id })
        .from(inventoryItems)
        .where(
          and(
            inArray(inventoryItems.id, input.ids),
            eq(inventoryItems.userId, userId)
          )
        );

      if (items.length !== input.ids.length) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Some items not found or not owned by user",
        });
      }

      // Delete associated images first
      await db
        .delete(itemImages)
        .where(inArray(itemImages.itemId, input.ids));

      // Delete channel listings
      await db
        .delete(channelListings)
        .where(inArray(channelListings.itemId, input.ids));

      // Delete inventory items
      await db
        .delete(inventoryItems)
        .where(inArray(inventoryItems.id, input.ids));

      return { success: true, deletedCount: input.ids.length };
    }),

  /**
   * Archive inventory items (soft delete)
   */
  archive: protectedProcedure
    .input(
      z.object({
        ids: z.array(z.string()).min(1),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const userId = ctx.user.id;

      await db
        .update(inventoryItems)
        .set({ status: "archived", updatedAt: new Date() })
        .where(
          and(
            inArray(inventoryItems.id, input.ids),
            eq(inventoryItems.userId, userId)
          )
        );

      return { success: true };
    }),

  /**
   * Publish item to channels (marks as active)
   */
  publish: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        channels: z.array(z.enum(["ebay", "poshmark", "mercari", "depop"])),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const userId = ctx.user.id;
      const now = new Date();

      // Get the item
      const item = await db.query.inventoryItems.findFirst({
        where: and(
          eq(inventoryItems.id, input.id),
          eq(inventoryItems.userId, userId)
        ),
      });

      if (!item) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Item not found" });
      }

      // Update item status to active
      await db
        .update(inventoryItems)
        .set({
          status: "active",
          listedAt: item.listedAt ?? now,
          updatedAt: now,
        })
        .where(eq(inventoryItems.id, input.id));

      // Create channel listings
      const channelListingData = input.channels.map((channel) => ({
        id: crypto.randomUUID(),
        itemId: input.id,
        channel,
        price: item.askingPrice,
        status: channel === "ebay" ? ("pending" as const) : ("draft" as const),
        requiresManualAction: channel !== "ebay",
        createdAt: now,
      }));

      if (channelListingData.length > 0) {
        await db.insert(channelListings).values(channelListingData);
      }

      return {
        success: true,
        channels: input.channels.map((channel) => ({
          channel,
          requiresManualAction: channel !== "ebay",
        })),
      };
    }),
});
