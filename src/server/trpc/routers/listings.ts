import { z } from "zod";
import { createTRPCRouter, publicProcedure, protectedProcedure } from "../init";
import { db } from "@/server/db/client";
import { inventoryItems, channelListings } from "@/server/db/schema";
import { eq, and } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { generateCrossListTemplate } from "@/server/services/channels";

export const listingsRouter = createTRPCRouter({
  /**
   * Get all channel listings for an inventory item
   */
  getByItemId: publicProcedure
    .input(z.object({ itemId: z.string() }))
    .query(async ({ input, ctx }) => {
      const userId = ctx.user?.id;
      if (!userId) {
        return [];
      }

      // Verify the user owns the item
      const item = await db.query.inventoryItems.findFirst({
        where: and(
          eq(inventoryItems.id, input.itemId),
          eq(inventoryItems.userId, userId)
        ),
      });

      if (!item) {
        return [];
      }

      const listings = await db.query.channelListings.findMany({
        where: eq(channelListings.itemId, input.itemId),
      });

      return listings.map((listing) => ({
        id: listing.id,
        channel: listing.channel,
        status: listing.status,
        price: listing.price,
        externalId: listing.externalId,
        externalUrl: listing.externalUrl,
        publishedAt: listing.publishedAt,
        requiresManualAction: listing.requiresManualAction,
      }));
    }),

  /**
   * Publish an item to a channel
   */
  publish: protectedProcedure
    .input(
      z.object({
        itemId: z.string(),
        channel: z.enum(["ebay", "poshmark", "mercari", "depop"]),
        price: z.number().positive().optional(),
      })
    )
    .mutation(async ({ input: _input, ctx: _ctx }) => {
      // TODO: Implement channel adapter publish
      return {
        success: true,
        listingId: "placeholder",
        requiresManualAction: false,
      };
    }),

  /**
   * Update a channel listing price
   */
  updatePrice: protectedProcedure
    .input(
      z.object({
        listingId: z.string(),
        price: z.number().positive(),
      })
    )
    .mutation(async ({ input: _input, ctx: _ctx }) => {
      // TODO: Implement channel adapter price update
      return { success: true };
    }),

  /**
   * Delist from a channel
   */
  delist: protectedProcedure
    .input(z.object({ listingId: z.string() }))
    .mutation(async ({ input: _input, ctx: _ctx }) => {
      // TODO: Implement channel adapter delist
      return { success: true, requiresManualAction: false };
    }),

  /**
   * Generate cross-list template for assisted channels
   */
  generateTemplate: protectedProcedure
    .input(
      z.object({
        itemId: z.string(),
        channel: z.enum(["poshmark", "mercari", "depop"]),
      })
    )
    .query(async ({ input, ctx }) => {
      const userId = ctx.user.id;

      // Get the inventory item
      const item = await db.query.inventoryItems.findFirst({
        where: and(
          eq(inventoryItems.id, input.itemId),
          eq(inventoryItems.userId, userId)
        ),
      });

      if (!item) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Item not found" });
      }

      // Generate template using the channel service
      const template = generateCrossListTemplate(input.channel, {
        title: item.title,
        description: item.description,
        price: item.askingPrice,
        condition: item.condition,
        itemSpecifics: item.itemSpecifics ?? undefined,
      });

      return template;
    }),

  /**
   * Mark an item as cross-listed on an assisted channel
   * Creates a channel listing record without making any API calls
   */
  markCrossListed: protectedProcedure
    .input(
      z.object({
        itemId: z.string(),
        channel: z.enum(["poshmark", "mercari", "depop"]),
        externalUrl: z.string().url().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const userId = ctx.user.id;
      const now = new Date();

      // Verify the user owns the item
      const item = await db.query.inventoryItems.findFirst({
        where: and(
          eq(inventoryItems.id, input.itemId),
          eq(inventoryItems.userId, userId)
        ),
      });

      if (!item) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Item not found" });
      }

      // Check if a listing already exists for this channel
      const existingListing = await db.query.channelListings.findFirst({
        where: and(
          eq(channelListings.itemId, input.itemId),
          eq(channelListings.channel, input.channel)
        ),
      });

      if (existingListing) {
        // Update the existing listing
        await db
          .update(channelListings)
          .set({
            status: "active",
            externalUrl: input.externalUrl ?? existingListing.externalUrl,
            publishedAt: existingListing.publishedAt ?? now,
          })
          .where(eq(channelListings.id, existingListing.id));

        return {
          success: true,
          listingId: existingListing.id,
          channel: input.channel,
          isNew: false,
        };
      }

      // Create a new channel listing record
      const listingId = crypto.randomUUID();

      await db.insert(channelListings).values({
        id: listingId,
        itemId: input.itemId,
        channel: input.channel,
        price: item.askingPrice,
        status: "active",
        externalUrl: input.externalUrl ?? null,
        requiresManualAction: true,
        createdAt: now,
        publishedAt: now,
      });

      // Update the inventory item status to active if it was draft
      if (item.status === "draft") {
        await db
          .update(inventoryItems)
          .set({
            status: "active",
            listedAt: item.listedAt ?? now,
            updatedAt: now,
          })
          .where(eq(inventoryItems.id, input.itemId));
      }

      return {
        success: true,
        listingId,
        channel: input.channel,
        isNew: true,
      };
    }),

  /**
   * Update the external URL for an assisted channel listing
   */
  updateExternalUrl: protectedProcedure
    .input(
      z.object({
        listingId: z.string(),
        externalUrl: z.string().url(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const userId = ctx.user.id;

      // Get the listing and verify ownership through the item
      const listing = await db.query.channelListings.findFirst({
        where: eq(channelListings.id, input.listingId),
        with: {
          item: true,
        },
      });

      if (!listing || listing.item.userId !== userId) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Listing not found",
        });
      }

      await db
        .update(channelListings)
        .set({
          externalUrl: input.externalUrl,
        })
        .where(eq(channelListings.id, input.listingId));

      return { success: true };
    }),
});
