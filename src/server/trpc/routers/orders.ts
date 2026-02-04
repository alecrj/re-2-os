import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "../init";
import { TRPCError } from "@trpc/server";
import { db } from "@/server/db/client";
import {
  orders,
  inventoryItems,
  channelListings,
  itemImages,
} from "@/server/db/schema";
import { eq, and, desc, sql } from "drizzle-orm";
import { getEbayAdapter } from "@/server/services/channels/ebay";
import type { ChannelOrder } from "@/server/services/channels/types";
import { inngest } from "@/server/inngest";

/**
 * Calculate net profit for an order
 * netProfit = salePrice - costBasis - platformFees - shippingCost
 */
function calculateNetProfit(
  salePrice: number,
  costBasis: number | null,
  platformFees: number | null,
  shippingCost: number | null
): number {
  return (
    salePrice -
    (costBasis ?? 0) -
    (platformFees ?? 0) -
    (shippingCost ?? 0)
  );
}

/**
 * Map eBay order status to our internal status
 */
function mapEbayStatus(
  ebayStatus: ChannelOrder["status"]
): "pending" | "paid" | "shipped" | "delivered" | "returned" | "cancelled" {
  switch (ebayStatus) {
    case "PENDING":
      return "pending";
    case "PAID":
      return "paid";
    case "SHIPPED":
      return "shipped";
    case "DELIVERED":
      return "delivered";
    case "CANCELLED":
      return "cancelled";
    case "REFUNDED":
      return "returned";
    default:
      return "pending";
  }
}

export const ordersRouter = createTRPCRouter({
  /**
   * Get all orders for the current user with filters
   */
  list: protectedProcedure
    .input(
      z.object({
        status: z
          .enum([
            "pending",
            "paid",
            "shipped",
            "delivered",
            "returned",
            "cancelled",
          ])
          .optional(),
        channel: z.enum(["ebay", "poshmark", "mercari", "depop"]).optional(),
        page: z.number().min(1).default(1),
        limit: z.number().min(1).max(100).default(25),
      })
    )
    .query(async ({ input, ctx }) => {
      const userId = ctx.user.id;
      const offset = (input.page - 1) * input.limit;

      // Build where conditions
      const conditions = [eq(orders.userId, userId)];
      if (input.status) {
        conditions.push(eq(orders.status, input.status));
      }
      if (input.channel) {
        conditions.push(eq(orders.channel, input.channel));
      }

      // Query orders with related data
      const orderList = await db
        .select({
          order: orders,
          item: {
            id: inventoryItems.id,
            title: inventoryItems.title,
            sku: inventoryItems.sku,
            costBasis: inventoryItems.costBasis,
          },
        })
        .from(orders)
        .leftJoin(inventoryItems, eq(orders.itemId, inventoryItems.id))
        .where(and(...conditions))
        .orderBy(desc(orders.orderedAt))
        .limit(input.limit)
        .offset(offset);

      // Get total count for pagination
      const countResult = await db
        .select({ count: sql<number>`count(*)` })
        .from(orders)
        .where(and(...conditions));

      const total = countResult[0]?.count ?? 0;

      // Fetch first image for each item
      const itemIds = orderList
        .map((o) => o.item?.id)
        .filter((id): id is string => id !== undefined);

      const images =
        itemIds.length > 0
          ? await db
              .select({
                itemId: itemImages.itemId,
                url: itemImages.originalUrl,
              })
              .from(itemImages)
              .where(
                and(
                  sql`${itemImages.itemId} IN ${itemIds}`,
                  eq(itemImages.position, 0)
                )
              )
          : [];

      const imageMap = new Map(images.map((img) => [img.itemId, img.url]));

      return {
        orders: orderList.map((row) => ({
          ...row.order,
          item: row.item
            ? {
                ...row.item,
                imageUrl: imageMap.get(row.item.id),
              }
            : null,
        })),
        pagination: {
          page: input.page,
          limit: input.limit,
          total,
          totalPages: Math.ceil(total / input.limit),
        },
      };
    }),

  /**
   * Get a single order by ID with full details
   */
  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input, ctx }) => {
      const userId = ctx.user.id;

      const result = await db
        .select({
          order: orders,
          item: inventoryItems,
          listing: channelListings,
        })
        .from(orders)
        .leftJoin(inventoryItems, eq(orders.itemId, inventoryItems.id))
        .leftJoin(channelListings, eq(orders.channelListingId, channelListings.id))
        .where(and(eq(orders.id, input.id), eq(orders.userId, userId)))
        .limit(1);

      if (result.length === 0) {
        return null;
      }

      const row = result[0];

      // Get images for the item
      const images = row.item
        ? await db
            .select({
              url: itemImages.originalUrl,
              position: itemImages.position,
            })
            .from(itemImages)
            .where(eq(itemImages.itemId, row.item.id))
            .orderBy(itemImages.position)
        : [];

      return {
        ...row.order,
        item: row.item
          ? {
              ...row.item,
              images: images.map((img) => img.url),
            }
          : null,
        listing: row.listing,
      };
    }),

  /**
   * Get order counts by status for dashboard stats
   */
  getStats: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.user.id;

    const stats = await db
      .select({
        status: orders.status,
        count: sql<number>`count(*)`,
      })
      .from(orders)
      .where(eq(orders.userId, userId))
      .groupBy(orders.status);

    const statusCounts: Record<string, number> = {
      pending: 0,
      paid: 0,
      shipped: 0,
      delivered: 0,
      returned: 0,
      cancelled: 0,
    };

    for (const stat of stats) {
      statusCounts[stat.status] = stat.count;
    }

    // Calculate totals
    const totalRevenue = await db
      .select({
        total: sql<number>`sum(${orders.salePrice})`,
      })
      .from(orders)
      .where(
        and(
          eq(orders.userId, userId),
          sql`${orders.status} NOT IN ('cancelled', 'returned')`
        )
      );

    const totalProfit = await db
      .select({
        total: sql<number>`sum(${orders.netProfit})`,
      })
      .from(orders)
      .where(
        and(
          eq(orders.userId, userId),
          sql`${orders.status} NOT IN ('cancelled', 'returned')`
        )
      );

    return {
      counts: statusCounts,
      totalRevenue: totalRevenue[0]?.total ?? 0,
      totalProfit: totalProfit[0]?.total ?? 0,
    };
  }),

  /**
   * Sync orders from eBay
   * Uses the eBay Fulfillment API to fetch recent orders
   */
  syncFromEbay: protectedProcedure.mutation(async ({ ctx }) => {
    const userId = ctx.user.id;
    const adapter = getEbayAdapter();

    // Check if connected
    const isConnected = await adapter.isConnected(userId);
    if (!isConnected) {
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: "eBay account not connected. Please connect your eBay account first.",
      });
    }

    // Sync orders from the last 30 days
    const since = new Date();
    since.setDate(since.getDate() - 30);

    let ebayOrders: ChannelOrder[];
    try {
      ebayOrders = await adapter.syncOrders(userId, since);
    } catch (error) {
      console.error("[orders.syncFromEbay] Failed to fetch orders:", error);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to sync orders from eBay. Please try again later.",
      });
    }

    const results = {
      synced: 0,
      created: 0,
      updated: 0,
      errors: [] as string[],
    };

    for (const ebayOrder of ebayOrders) {
      try {
        // Check if order already exists
        const existing = await db
          .select()
          .from(orders)
          .where(
            and(
              eq(orders.userId, userId),
              eq(orders.externalOrderId, ebayOrder.externalOrderId)
            )
          )
          .limit(1);

        // Find matching inventory item by SKU
        let itemId: string | null = null;
        let costBasis: number | null = null;

        if (ebayOrder.lineItems.length > 0) {
          const lineItem = ebayOrder.lineItems[0];
          if (lineItem.sku) {
            const item = await db
              .select({
                id: inventoryItems.id,
                costBasis: inventoryItems.costBasis,
              })
              .from(inventoryItems)
              .where(
                and(
                  eq(inventoryItems.userId, userId),
                  eq(inventoryItems.sku, lineItem.sku)
                )
              )
              .limit(1);

            if (item.length > 0) {
              itemId = item[0].id;
              costBasis = item[0].costBasis;
            }
          }
        }

        // Calculate net profit
        const netProfit = calculateNetProfit(
          ebayOrder.salePrice,
          costBasis,
          ebayOrder.platformFees ?? null,
          null // Shipping cost not available from order sync
        );

        if (existing.length > 0) {
          // Update existing order
          await db
            .update(orders)
            .set({
              status: mapEbayStatus(ebayOrder.status),
              salePrice: ebayOrder.salePrice,
              shippingPaid: ebayOrder.shippingPaid,
              platformFees: ebayOrder.platformFees,
              netProfit,
              buyerUsername: ebayOrder.buyerUsername,
              shippingAddress: ebayOrder.shippingAddress,
              paidAt: ebayOrder.paidAt,
              shippedAt: ebayOrder.shippedAt,
            })
            .where(eq(orders.id, existing[0].id));

          results.updated++;
        } else {
          // Create new order
          const orderId = crypto.randomUUID();
          await db.insert(orders).values({
            id: orderId,
            userId,
            itemId: itemId ?? "", // Empty string if no matching item found
            channel: "ebay",
            externalOrderId: ebayOrder.externalOrderId,
            salePrice: ebayOrder.salePrice,
            shippingPaid: ebayOrder.shippingPaid,
            platformFees: ebayOrder.platformFees,
            netProfit,
            buyerUsername: ebayOrder.buyerUsername,
            shippingAddress: ebayOrder.shippingAddress,
            status: mapEbayStatus(ebayOrder.status),
            orderedAt: ebayOrder.orderedAt,
            paidAt: ebayOrder.paidAt,
            shippedAt: ebayOrder.shippedAt,
          });

          // Trigger delist-on-sale automation if we have a valid item ID
          // This will delist from other channels to prevent overselling
          if (itemId) {
            try {
              await inngest.send({
                name: "order/confirmed",
                data: {
                  orderId,
                  userId,
                  itemId,
                  channel: "ebay",
                  salePrice: ebayOrder.salePrice,
                },
              });
            } catch (sendError) {
              // Log but don't fail - the order was created successfully
              console.error(
                "[orders.syncFromEbay] Failed to trigger delist-on-sale:",
                sendError
              );
            }
          }

          results.created++;
        }

        results.synced++;
      } catch (error) {
        console.error(
          `[orders.syncFromEbay] Error processing order ${ebayOrder.externalOrderId}:`,
          error
        );
        results.errors.push(
          `Failed to process order ${ebayOrder.externalOrderId}`
        );
      }
    }

    return results;
  }),

  /**
   * Mark order as shipped and upload tracking to eBay
   */
  markShipped: protectedProcedure
    .input(
      z.object({
        orderId: z.string(),
        trackingNumber: z.string().min(1),
        carrier: z.enum(["usps", "ups", "fedex", "dhl", "other"]),
        shippingCost: z.number().nonnegative().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const userId = ctx.user.id;

      // Get the order
      const orderResult = await db
        .select()
        .from(orders)
        .where(and(eq(orders.id, input.orderId), eq(orders.userId, userId)))
        .limit(1);

      if (orderResult.length === 0) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Order not found",
        });
      }

      const order = orderResult[0];

      if (order.status === "shipped" || order.status === "delivered") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Order has already been shipped",
        });
      }

      // Calculate updated net profit if shipping cost provided
      let netProfit = order.netProfit;
      if (input.shippingCost !== undefined) {
        // Get item cost basis for recalculation
        const itemResult = await db
          .select({ costBasis: inventoryItems.costBasis })
          .from(inventoryItems)
          .where(eq(inventoryItems.id, order.itemId))
          .limit(1);

        const costBasis = itemResult[0]?.costBasis ?? null;
        netProfit = calculateNetProfit(
          order.salePrice,
          costBasis,
          order.platformFees,
          input.shippingCost
        );
      }

      // Update order in database
      const now = new Date();
      await db
        .update(orders)
        .set({
          status: "shipped",
          shippingCost: input.shippingCost,
          netProfit,
          shippedAt: now,
        })
        .where(eq(orders.id, input.orderId));

      // If eBay order, upload tracking number
      if (order.channel === "ebay" && order.externalOrderId) {
        try {
          const _adapter = getEbayAdapter();
          // Note: eBay tracking upload would need to be implemented in the adapter
          // For now, we just log it
          console.log(
            `[orders.markShipped] Would upload tracking ${input.trackingNumber} to eBay order ${order.externalOrderId}`
          );
        } catch (error) {
          console.error(
            "[orders.markShipped] Failed to upload tracking to eBay:",
            error
          );
          // Don't fail the mutation, tracking can be added manually
        }
      }

      // Update inventory item status
      if (order.itemId) {
        await db
          .update(inventoryItems)
          .set({
            status: "shipped",
            updatedAt: now,
          })
          .where(eq(inventoryItems.id, order.itemId));
      }

      return {
        success: true,
        orderId: input.orderId,
        trackingNumber: input.trackingNumber,
      };
    }),

  /**
   * Record a manual sale (for Poshmark/Mercari/Depop)
   * Creates an order and triggers delist-on-sale
   */
  recordSale: protectedProcedure
    .input(
      z.object({
        itemId: z.string(),
        channel: z.enum(["poshmark", "mercari", "depop"]),
        salePrice: z.number().positive(),
        platformFees: z.number().nonnegative().optional(),
        shippingCost: z.number().nonnegative().optional(),
        buyerUsername: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const userId = ctx.user.id;

      // Get the inventory item
      const itemResult = await db
        .select()
        .from(inventoryItems)
        .where(
          and(eq(inventoryItems.id, input.itemId), eq(inventoryItems.userId, userId))
        )
        .limit(1);

      if (itemResult.length === 0) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Inventory item not found",
        });
      }

      const item = itemResult[0];

      if (item.status === "sold" || item.status === "shipped") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Item has already been sold",
        });
      }

      // Calculate net profit
      const netProfit = calculateNetProfit(
        input.salePrice,
        item.costBasis,
        input.platformFees ?? null,
        input.shippingCost ?? null
      );

      // Create order
      const orderId = crypto.randomUUID();
      const now = new Date();

      await db.insert(orders).values({
        id: orderId,
        userId,
        itemId: input.itemId,
        channel: input.channel,
        salePrice: input.salePrice,
        platformFees: input.platformFees,
        shippingCost: input.shippingCost,
        netProfit,
        buyerUsername: input.buyerUsername,
        status: "paid", // Manual sales are recorded after payment
        orderedAt: now,
        paidAt: now,
      });

      // Trigger delist-on-sale automation
      // This will:
      // 1. Delist from native channels (eBay) automatically
      // 2. Send notifications for assisted channels (Poshmark, Mercari, Depop)
      // 3. Update inventory status to 'sold'
      // 4. Log all actions to audit
      try {
        await inngest.send({
          name: "order/confirmed",
          data: {
            orderId,
            userId,
            itemId: input.itemId,
            channel: input.channel,
            salePrice: input.salePrice,
          },
        });
      } catch (sendError) {
        // Log but don't fail - the order was created successfully
        // The delist-on-sale function handles failures gracefully
        console.error(
          "[orders.recordSale] Failed to trigger delist-on-sale:",
          sendError
        );
      }

      return {
        id: orderId,
        netProfit,
      };
    }),

  /**
   * Update order status
   */
  updateStatus: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        status: z.enum([
          "pending",
          "paid",
          "shipped",
          "delivered",
          "returned",
          "cancelled",
        ]),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const userId = ctx.user.id;

      // Verify ownership
      const orderResult = await db
        .select()
        .from(orders)
        .where(and(eq(orders.id, input.id), eq(orders.userId, userId)))
        .limit(1);

      if (orderResult.length === 0) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Order not found",
        });
      }

      const now = new Date();
      const updates: Record<string, unknown> = {
        status: input.status,
      };

      // Set timestamp based on status
      if (input.status === "paid") {
        updates.paidAt = now;
      } else if (input.status === "shipped") {
        updates.shippedAt = now;
      } else if (input.status === "delivered") {
        updates.deliveredAt = now;
      }

      await db.update(orders).set(updates).where(eq(orders.id, input.id));

      return { success: true };
    }),
});
