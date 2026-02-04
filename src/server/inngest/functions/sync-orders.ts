/**
 * Sync Orders Function
 *
 * Synchronizes orders from connected marketplace channels.
 * Runs periodically or on-demand to fetch new orders.
 *
 * Flow:
 * 1. Get user's channel connection
 * 2. Fetch orders from channel API since last sync
 * 3. Match orders to inventory items
 * 4. Create/update order records
 * 5. Trigger delist-on-sale for new confirmed orders
 * 6. Update last sync timestamp
 */

import { inngest } from '../client';
import { db } from '@/server/db/client';
import { channelConnections, channelListings, inventoryItems, orders } from '@/server/db/schema';
import { eq, and } from 'drizzle-orm';
import { getAdapter, isNativeChannel, type ChannelId, type ChannelOrder } from '@/server/services/channels';

/**
 * Map channel order status to our internal order status
 */
function mapChannelOrderStatus(
  channelStatus: ChannelOrder['status']
): 'pending' | 'paid' | 'shipped' | 'delivered' | 'returned' | 'cancelled' {
  switch (channelStatus) {
    case 'PENDING':
      return 'pending';
    case 'PAID':
      return 'paid';
    case 'SHIPPED':
      return 'shipped';
    case 'DELIVERED':
      return 'delivered';
    case 'CANCELLED':
      return 'cancelled';
    case 'REFUNDED':
      return 'returned';
    default:
      return 'pending';
  }
}

export const syncOrders = inngest.createFunction(
  {
    id: 'sync-orders',
    name: 'Sync Orders from Marketplace',
    retries: 3,
    // Concurrency limit per user
    concurrency: {
      key: 'sync-orders-{{ event.data.userId }}',
      limit: 1,
    },
  },
  { event: 'sync/orders' },
  async ({ event, step }) => {
    const { userId, channel, since } = event.data;

    // Step 1: Get channel connection
    const connection = await step.run('get-channel-connection', async () => {
      console.log(`[sync-orders] Getting ${channel} connection for user ${userId}`);

      const conn = await db.query.channelConnections.findFirst({
        where: and(
          eq(channelConnections.userId, userId),
          eq(channelConnections.channel, channel),
          eq(channelConnections.status, 'active')
        ),
      });

      if (!conn) {
        return null;
      }

      // Return serializable data for Inngest steps
      return {
        id: conn.id,
        accessToken: conn.accessToken,
        lastSyncAt: since ?? conn.lastSyncAt?.toISOString() ?? null,
      };
    });

    if (!connection) {
      return {
        success: false,
        error: `No active ${channel} connection found`,
      };
    }

    // Step 2: Fetch orders from channel
    const channelOrders = await step.run('fetch-channel-orders', async () => {
      const channelId = channel as ChannelId;
      console.log(
        `[sync-orders] Fetching ${channel} orders since ${connection.lastSyncAt ?? 'beginning'}`
      );

      // Only native channels support order syncing via API
      if (!isNativeChannel(channelId)) {
        console.log(`[sync-orders] ${channel} is an assisted channel - no API sync available`);
        return [];
      }

      try {
        const adapter = getAdapter(channelId);

        // Check if adapter supports order syncing
        if (!adapter.syncOrders) {
          console.log(`[sync-orders] ${channel} adapter does not support order syncing`);
          return [];
        }

        // Determine the since date for syncing
        const sinceDate = connection.lastSyncAt
          ? new Date(connection.lastSyncAt)
          : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // Default to last 7 days

        const fetchedOrders = await adapter.syncOrders(userId, sinceDate);

        console.log(`[sync-orders] Fetched ${fetchedOrders.length} orders from ${channel}`);

        // Serialize orders for Inngest step (convert Date objects to ISO strings)
        return fetchedOrders.map((order) => ({
          ...order,
          orderedAt: order.orderedAt.toISOString(),
          paidAt: order.paidAt?.toISOString() ?? null,
          shippedAt: order.shippedAt?.toISOString() ?? null,
        }));
      } catch (error) {
        console.error(`[sync-orders] Error fetching orders from ${channel}:`, error);
        return [];
      }
    });

    // Order status type matching our schema
    type OrderStatus = 'pending' | 'paid' | 'shipped' | 'delivered' | 'returned' | 'cancelled';

    // Step 3: Match orders to inventory items
    const matchedOrders = await step.run('match-to-inventory', async () => {
      const matched: Array<{
        externalOrderId: string;
        itemId: string | null;
        channelListingId: string | null;
        salePrice: number;
        shippingPaid: number | null;
        platformFees: number | null;
        buyerUsername: string | null;
        shippingAddress: ChannelOrder['shippingAddress'] | null;
        status: OrderStatus;
        orderedAt: string;
        paidAt: string | null;
        shippedAt: string | null;
      }> = [];

      for (const order of channelOrders) {
        // Find matching inventory item by looking up channel listings
        // Each order can have multiple line items, so we process the first one
        const lineItem = order.lineItems[0];
        if (!lineItem) {
          console.log(`[sync-orders] Order ${order.externalOrderId} has no line items, skipping`);
          continue;
        }

        // Try to find the channel listing by external listing ID or SKU
        let listing = null;

        // First try by external listing ID (legacyItemId for eBay)
        if (lineItem.externalListingId) {
          listing = await db.query.channelListings.findFirst({
            where: eq(channelListings.externalId, lineItem.externalListingId),
            with: { item: true },
          });
        }

        // If not found by external ID, try by SKU
        if (!listing && lineItem.sku) {
          const item = await db.query.inventoryItems.findFirst({
            where: and(
              eq(inventoryItems.userId, userId),
              eq(inventoryItems.sku, lineItem.sku)
            ),
            with: {
              channelListings: {
                where: eq(channelListings.channel, channel),
                limit: 1,
              },
            },
          });

          if (item && item.channelListings.length > 0) {
            listing = {
              ...item.channelListings[0],
              item,
            };
          }
        }

        const matchedOrder = {
          externalOrderId: order.externalOrderId,
          itemId: listing?.item?.id ?? null,
          channelListingId: listing?.id ?? null,
          salePrice: order.salePrice,
          shippingPaid: order.shippingPaid ?? null,
          platformFees: order.platformFees ?? null,
          buyerUsername: order.buyerUsername ?? null,
          shippingAddress: order.shippingAddress ?? null,
          status: mapChannelOrderStatus(order.status),
          orderedAt: order.orderedAt as string, // Already serialized
          paidAt: (order.paidAt as string | null) ?? null,
          shippedAt: (order.shippedAt as string | null) ?? null,
        };

        if (listing) {
          console.log(
            `[sync-orders] Matched order ${order.externalOrderId} to item ${listing.item?.id}`
          );
        } else {
          console.log(
            `[sync-orders] Could not match order ${order.externalOrderId} to inventory (SKU: ${lineItem.sku}, ListingID: ${lineItem.externalListingId})`
          );
        }

        matched.push(matchedOrder);
      }

      return matched;
    });

    // Step 4: Create/update order records
    const savedOrders = await step.run('save-orders', async () => {
      const saved: string[] = [];

      for (const order of matchedOrders) {
        // Skip orders that don't have a matched item (we still track them but can't link)
        if (!order.itemId) {
          console.log(
            `[sync-orders] Skipping order ${order.externalOrderId} - no matched inventory item`
          );
          continue;
        }

        try {
          // Check if order already exists
          const existingOrder = await db.query.orders.findFirst({
            where: and(
              eq(orders.userId, userId),
              eq(orders.externalOrderId, order.externalOrderId)
            ),
          });

          const orderId = existingOrder?.id ?? crypto.randomUUID();
          const now = new Date();

          // Calculate net profit if we have cost basis
          let netProfit: number | null = null;
          if (order.itemId) {
            const item = await db.query.inventoryItems.findFirst({
              where: eq(inventoryItems.id, order.itemId),
              columns: { costBasis: true },
            });
            if (item?.costBasis) {
              netProfit =
                order.salePrice -
                (order.platformFees ?? 0) -
                (item.costBasis ?? 0);
            }
          }

          if (existingOrder) {
            // Update existing order
            await db
              .update(orders)
              .set({
                status: order.status,
                salePrice: order.salePrice,
                shippingPaid: order.shippingPaid,
                platformFees: order.platformFees,
                netProfit,
                buyerUsername: order.buyerUsername,
                shippingAddress: order.shippingAddress,
                paidAt: order.paidAt ? new Date(order.paidAt) : null,
                shippedAt: order.shippedAt ? new Date(order.shippedAt) : null,
              })
              .where(eq(orders.id, existingOrder.id));

            console.log(`[sync-orders] Updated order ${order.externalOrderId}`);
          } else {
            // Insert new order
            await db.insert(orders).values({
              id: orderId,
              userId,
              itemId: order.itemId,
              channelListingId: order.channelListingId,
              channel: channel as 'ebay' | 'poshmark' | 'mercari' | 'depop',
              externalOrderId: order.externalOrderId,
              salePrice: order.salePrice,
              shippingPaid: order.shippingPaid,
              platformFees: order.platformFees,
              netProfit,
              buyerUsername: order.buyerUsername,
              shippingAddress: order.shippingAddress,
              status: order.status,
              orderedAt: new Date(order.orderedAt),
              paidAt: order.paidAt ? new Date(order.paidAt) : null,
              shippedAt: order.shippedAt ? new Date(order.shippedAt) : null,
            });

            console.log(`[sync-orders] Created order ${order.externalOrderId}`);

            // Update inventory item status to sold
            await db
              .update(inventoryItems)
              .set({
                status: 'sold',
                soldAt: now,
                updatedAt: now,
              })
              .where(eq(inventoryItems.id, order.itemId));

            // Update channel listing status to sold
            if (order.channelListingId) {
              await db
                .update(channelListings)
                .set({
                  status: 'sold',
                  endedAt: now,
                })
                .where(eq(channelListings.id, order.channelListingId));
            }
          }

          saved.push(order.externalOrderId);
        } catch (error) {
          console.error(
            `[sync-orders] Error saving order ${order.externalOrderId}:`,
            error
          );
        }
      }

      return saved;
    });

    // Step 5: Trigger delist-on-sale for new paid/shipped orders
    // "paid" or "shipped" status indicates a confirmed sale
    const newConfirmedOrders = matchedOrders.filter(
      (o) => (o.status === 'paid' || o.status === 'shipped') && o.itemId
    );

    for (const order of newConfirmedOrders) {
      await step.sendEvent('trigger-delist', {
        name: 'autopilot/delist-on-sale',
        data: {
          userId,
          itemId: order.itemId!,
          soldOnChannel: channel,
          orderId: order.externalOrderId,
        },
      });
    }

    // Step 6: Update last sync timestamp
    await step.run('update-sync-timestamp', async () => {
      const now = new Date();

      await db
        .update(channelConnections)
        .set({ lastSyncAt: now })
        .where(eq(channelConnections.id, connection.id));

      console.log(`[sync-orders] Updated last sync timestamp to ${now.toISOString()}`);
      return { updated: true, timestamp: now.toISOString() };
    });

    return {
      success: true,
      userId,
      channel,
      ordersFetched: channelOrders.length,
      ordersMatched: matchedOrders.length,
      ordersSaved: savedOrders.length,
      delistTriggered: newConfirmedOrders.length,
    };
  }
);
