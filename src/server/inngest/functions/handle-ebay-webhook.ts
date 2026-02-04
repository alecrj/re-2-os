/**
 * Handle eBay Webhook Notifications
 *
 * Processes real-time notifications from eBay:
 * - Order received: Sync order data and trigger delist-on-sale
 * - Item sold: Trigger cross-platform delist
 * - Order shipped: Update order status
 */
import { inngest } from "../client";
import { db } from "@/server/db/client";
import {
  inventoryItems,
  channelListings,
  orders,
} from "@/server/db/schema";
import { eq, and } from "drizzle-orm";

/**
 * Handle eBay order received notification
 *
 * When an order is placed on eBay, this function:
 * 1. Finds the associated item
 * 2. Creates/updates the order record
 * 3. Triggers delist-on-sale for other channels
 */
export const handleEbayOrderReceived = inngest.createFunction(
  {
    id: "handle-ebay-order-received",
    name: "Handle eBay Order Received",
    retries: 3,
  },
  { event: "ebay/order.received" },
  async ({ event, step }) => {
    const { notificationId, orderId, payload } = event.data;

    if (!orderId) {
      return { status: "skipped", reason: "No orderId in notification" };
    }

    // Step 1: Find the channel listing and associated item
    const listing = await step.run("find-listing", async () => {
      // Extract item ID from payload (structure depends on eBay notification format)
      const lineItems = (payload as { lineItems?: Array<{ legacyItemId?: string; sku?: string }> }).lineItems || [];
      if (lineItems.length === 0) {
        return null;
      }

      const ebayItemId = lineItems[0].legacyItemId || lineItems[0].sku;
      if (!ebayItemId) {
        return null;
      }

      // Find the channel listing
      const [found] = await db
        .select()
        .from(channelListings)
        .where(
          and(
            eq(channelListings.externalId, ebayItemId),
            eq(channelListings.channel, "ebay")
          )
        )
        .limit(1);

      return found || null;
    });

    if (!listing) {
      return {
        status: "skipped",
        reason: "Could not find listing for eBay order",
        notificationId,
      };
    }

    // Step 2: Get the item details
    const item = await step.run("get-item", async () => {
      const [found] = await db
        .select()
        .from(inventoryItems)
        .where(eq(inventoryItems.id, listing.itemId))
        .limit(1);
      return found || null;
    });

    if (!item) {
      return {
        status: "error",
        reason: "Item not found for listing",
        listingId: listing.id,
      };
    }

    // Step 3: Create or update order record
    const order = await step.run("upsert-order", async () => {
      const orderData = payload as {
        pricingSummary?: { total?: { value?: string } };
        buyer?: { username?: string };
        creationDate?: string;
      };

      const existing = await db
        .select()
        .from(orders)
        .where(eq(orders.externalOrderId, orderId))
        .limit(1);

      const now = new Date();
      const salePrice = orderData.pricingSummary?.total?.value
        ? parseFloat(orderData.pricingSummary.total.value)
        : listing.price || 0;

      if (existing.length > 0) {
        // Update existing - just update status
        await db
          .update(orders)
          .set({
            status: "pending",
          })
          .where(eq(orders.id, existing[0].id));
        return existing[0];
      } else {
        // Create new order
        const newOrderId = crypto.randomUUID();
        await db.insert(orders).values({
          id: newOrderId,
          userId: item.userId,
          itemId: item.id,
          channel: "ebay",
          externalOrderId: orderId,
          status: "pending",
          salePrice,
          buyerUsername: orderData.buyer?.username,
          orderedAt: orderData.creationDate
            ? new Date(orderData.creationDate)
            : now,
        });

        return { id: newOrderId };
      }
    });

    // Step 4: Trigger delist on other channels
    await step.sendEvent("trigger-delist", {
      name: "autopilot/delist-on-sale",
      data: {
        userId: item.userId,
        itemId: item.id,
        soldOnChannel: "ebay",
        orderId: order.id,
      },
    });

    return {
      status: "processed",
      notificationId,
      orderId,
      itemId: item.id,
      action: "order-created-delist-triggered",
    };
  }
);

/**
 * Handle eBay item sold notification
 *
 * Similar to order received but specifically for item sold events
 */
export const handleEbayItemSold = inngest.createFunction(
  {
    id: "handle-ebay-item-sold",
    name: "Handle eBay Item Sold",
    retries: 3,
  },
  { event: "ebay/item.sold" },
  async ({ event, step }) => {
    const { notificationId, itemId: ebayItemId } = event.data;

    if (!ebayItemId) {
      return { status: "skipped", reason: "No itemId in notification" };
    }

    // Find the channel listing
    const listing = await step.run("find-listing", async () => {
      const [found] = await db
        .select()
        .from(channelListings)
        .where(
          and(
            eq(channelListings.externalId, ebayItemId),
            eq(channelListings.channel, "ebay")
          )
        )
        .limit(1);
      return found || null;
    });

    if (!listing) {
      return {
        status: "skipped",
        reason: "Could not find listing for sold item",
        notificationId,
        ebayItemId,
      };
    }

    // Get the item
    const item = await step.run("get-item", async () => {
      const [found] = await db
        .select()
        .from(inventoryItems)
        .where(eq(inventoryItems.id, listing.itemId))
        .limit(1);
      return found || null;
    });

    if (!item) {
      return { status: "error", reason: "Item not found" };
    }

    // Update listing status
    await step.run("update-listing-status", async () => {
      await db
        .update(channelListings)
        .set({
          status: "sold",
          endedAt: new Date(),
        })
        .where(eq(channelListings.id, listing.id));
    });

    // Trigger delist on other channels
    await step.sendEvent("trigger-delist", {
      name: "autopilot/delist-on-sale",
      data: {
        userId: item.userId,
        itemId: item.id,
        soldOnChannel: "ebay",
        orderId: `ebay-${ebayItemId}`, // Use item ID if no order ID
      },
    });

    return {
      status: "processed",
      notificationId,
      ebayItemId,
      itemId: item.id,
      action: "item-sold-delist-triggered",
    };
  }
);

/**
 * Handle eBay order shipped notification
 */
export const handleEbayOrderShipped = inngest.createFunction(
  {
    id: "handle-ebay-order-shipped",
    name: "Handle eBay Order Shipped",
    retries: 3,
  },
  { event: "ebay/order.shipped" },
  async ({ event, step }) => {
    const { notificationId, orderId } = event.data;

    if (!orderId) {
      return { status: "skipped", reason: "No orderId in notification" };
    }

    // Update order status (tracking info would require schema addition)
    await step.run("update-order", async () => {
      await db
        .update(orders)
        .set({
          status: "shipped",
          shippedAt: new Date(),
        })
        .where(eq(orders.externalOrderId, orderId));
    });

    return {
      status: "processed",
      notificationId,
      orderId,
      action: "order-marked-shipped",
    };
  }
);
