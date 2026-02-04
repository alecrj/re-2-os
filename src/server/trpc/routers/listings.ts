import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "../init";
import { db } from "@/server/db/client";
import { inventoryItems, channelListings, itemImages } from "@/server/db/schema";
import { eq, and } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { generateCrossListTemplate, getAdapter, isNativeChannel } from "@/server/services/channels";
import { auditService } from "@/server/services/audit";

const ChannelEnum = z.enum(["ebay", "poshmark", "mercari", "depop"]);

export const listingsRouter = createTRPCRouter({
  /**
   * Get all channel listings for an inventory item
   */
  getByItemId: protectedProcedure
    .input(z.object({ itemId: z.string() }))
    .query(async ({ input, ctx }) => {
      const userId = ctx.session.user.id;

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
        channel: ChannelEnum,
        price: z.number().positive().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const userId = ctx.session.user.id;
      const now = new Date();

      // Get the inventory item with images
      const item = await db.query.inventoryItems.findFirst({
        where: and(
          eq(inventoryItems.id, input.itemId),
          eq(inventoryItems.userId, userId)
        ),
      });

      if (!item) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Item not found" });
      }

      // Get images for the item
      const images = await db.query.itemImages.findMany({
        where: eq(itemImages.itemId, input.itemId),
        orderBy: (images, { asc }) => [asc(images.position)],
      });

      const price = input.price ?? item.askingPrice;

      // Check if listing already exists
      const existingListing = await db.query.channelListings.findFirst({
        where: and(
          eq(channelListings.itemId, input.itemId),
          eq(channelListings.channel, input.channel)
        ),
      });

      if (existingListing && existingListing.status === "active") {
        throw new TRPCError({
          code: "CONFLICT",
          message: `Item is already listed on ${input.channel}`,
        });
      }

      // For native channels (eBay), call the adapter
      if (isNativeChannel(input.channel)) {
        const adapter = getAdapter(input.channel);

        const result = await adapter.publish(userId, {
          title: item.title,
          description: item.description,
          price,
          quantity: item.quantity,
          condition: item.condition,
          category: item.suggestedCategory ?? undefined,
          imageUrls: images.map((img) => img.processedUrl ?? img.originalUrl),
          itemSpecifics: item.itemSpecifics ?? undefined,
          sku: item.sku,
        });

        if (!result.success) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: result.error ?? `Failed to publish to ${input.channel}`,
          });
        }

        // Create or update the channel listing record
        const listingId = existingListing?.id ?? crypto.randomUUID();

        if (existingListing) {
          await db
            .update(channelListings)
            .set({
              status: "active",
              price,
              externalId: result.externalId,
              externalUrl: result.externalUrl,
              publishedAt: now,
              requiresManualAction: false,
            })
            .where(eq(channelListings.id, existingListing.id));
        } else {
          await db.insert(channelListings).values({
            id: listingId,
            itemId: input.itemId,
            channel: input.channel,
            price,
            status: "active",
            externalId: result.externalId,
            externalUrl: result.externalUrl,
            requiresManualAction: false,
            createdAt: now,
            publishedAt: now,
          });
        }

        // Update inventory item status
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

        // Log to audit
        await auditService.log({
          userId,
          actionType: "LISTING_PUBLISH",
          itemId: input.itemId,
          channel: input.channel,
          source: "USER",
          afterState: { listingId, externalId: result.externalId, price },
        });

        return {
          success: true,
          listingId,
          externalId: result.externalId,
          externalUrl: result.externalUrl,
          requiresManualAction: false,
        };
      }

      // For assisted channels, create a pending listing and return template instructions
      const listingId = existingListing?.id ?? crypto.randomUUID();

      if (existingListing) {
        await db
          .update(channelListings)
          .set({
            status: "pending",
            price,
            requiresManualAction: true,
          })
          .where(eq(channelListings.id, existingListing.id));
      } else {
        await db.insert(channelListings).values({
          id: listingId,
          itemId: input.itemId,
          channel: input.channel,
          price,
          status: "pending",
          requiresManualAction: true,
          createdAt: now,
        });
      }

      return {
        success: true,
        listingId,
        requiresManualAction: true,
        message: `Please manually list this item on ${input.channel}. Use the template generator for optimized content.`,
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
    .mutation(async ({ input, ctx }) => {
      const userId = ctx.session.user.id;

      // Get the listing with item
      const listing = await db.query.channelListings.findFirst({
        where: eq(channelListings.id, input.listingId),
        with: { item: true },
      });

      if (!listing || listing.item.userId !== userId) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Listing not found" });
      }

      const oldPrice = listing.price;

      // For native channels, update via adapter
      if (isNativeChannel(listing.channel) && listing.externalId) {
        const adapter = getAdapter(listing.channel);

        const result = await adapter.update(userId, listing.externalId, {
          title: listing.item.title,
          description: listing.item.description,
          price: input.price,
          quantity: listing.item.quantity,
          condition: listing.item.condition,
          imageUrls: [],
          sku: listing.item.sku,
        });

        if (!result.success) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: result.error ?? "Failed to update price",
          });
        }
      }

      // Update local record
      await db
        .update(channelListings)
        .set({ price: input.price })
        .where(eq(channelListings.id, input.listingId));

      // Log to audit
      await auditService.log({
        userId,
        actionType: "PRICE_CHANGE",
        itemId: listing.itemId,
        channel: listing.channel,
        source: "USER",
        beforeState: { price: oldPrice },
        afterState: { price: input.price },
        reversible: true,
      });

      return {
        success: true,
        requiresManualAction: !isNativeChannel(listing.channel),
      };
    }),

  /**
   * Delist from a channel
   */
  delist: protectedProcedure
    .input(z.object({ listingId: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const userId = ctx.session.user.id;

      // Get the listing with item
      const listing = await db.query.channelListings.findFirst({
        where: eq(channelListings.id, input.listingId),
        with: { item: true },
      });

      if (!listing || listing.item.userId !== userId) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Listing not found" });
      }

      // For native channels, delist via adapter
      if (isNativeChannel(listing.channel) && listing.externalId) {
        const adapter = getAdapter(listing.channel);
        const result = await adapter.delist(userId, listing.externalId);

        if (!result.success && !result.requiresManualAction) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: result.error ?? "Failed to delist",
          });
        }
      }

      // Update local record
      await db
        .update(channelListings)
        .set({
          status: "ended",
          endedAt: new Date(),
        })
        .where(eq(channelListings.id, input.listingId));

      // Log to audit
      await auditService.log({
        userId,
        actionType: "LISTING_DELIST",
        itemId: listing.itemId,
        channel: listing.channel,
        source: "USER",
        beforeState: { status: listing.status },
        afterState: { status: "ended" },
        reversible: true,
      });

      return {
        success: true,
        requiresManualAction: !isNativeChannel(listing.channel),
      };
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
      const userId = ctx.session.user.id;

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
      const userId = ctx.session.user.id;
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

      // Check if a listing already exists
      const existingListing = await db.query.channelListings.findFirst({
        where: and(
          eq(channelListings.itemId, input.itemId),
          eq(channelListings.channel, input.channel)
        ),
      });

      if (existingListing) {
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

      // Create new listing
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

      // Update inventory status if draft
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
      const userId = ctx.session.user.id;

      const listing = await db.query.channelListings.findFirst({
        where: eq(channelListings.id, input.listingId),
        with: { item: true },
      });

      if (!listing || listing.item.userId !== userId) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Listing not found" });
      }

      await db
        .update(channelListings)
        .set({ externalUrl: input.externalUrl })
        .where(eq(channelListings.id, input.listingId));

      return { success: true };
    }),
});
