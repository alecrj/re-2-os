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
      // TODO: Query database for channel connection
      // const conn = await db.query.channelConnections.findFirst({
      //   where: and(
      //     eq(channelConnections.userId, userId),
      //     eq(channelConnections.channel, channel),
      //     eq(channelConnections.status, 'active')
      //   )
      // });

      console.log(`[sync-orders] Getting ${channel} connection for user ${userId}`);

      // Mock connection - would be replaced with actual DB query
      // Use ISO string for serialization safety across Inngest steps
      return {
        id: 'mock-connection-1',
        accessToken: 'mock-token',
        lastSyncAt: since ?? null,
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
      // TODO: Call channel adapter to fetch orders
      // const adapter = getChannelAdapter(channel);
      // const orders = await adapter.getOrders({
      //   accessToken: connection.accessToken,
      //   since: connection.lastSyncAt,
      // });

      console.log(
        `[sync-orders] Fetching ${channel} orders since ${connection.lastSyncAt ?? 'beginning'}`
      );

      // Mock orders - would be replaced with actual API call
      return [];
    });

    // Step 3: Match orders to inventory items
    const matchedOrders = await step.run('match-to-inventory', async () => {
      const matched: Array<{
        externalOrderId: string;
        itemId: string | null;
        channelListingId: string | null;
        salePrice: number;
        status: string;
      }> = [];

      for (const _order of channelOrders) {
        // TODO: Find matching inventory item by external listing ID
        // const listing = await db.query.channelListings.findFirst({
        //   where: eq(channelListings.externalId, _order.listingId)
        // });

        console.log(`[sync-orders] Would match order to inventory`);
        // matched.push({ ... });
      }

      return matched;
    });

    // Step 4: Create/update order records
    const savedOrders = await step.run('save-orders', async () => {
      const saved: string[] = [];

      for (const order of matchedOrders) {
        // TODO: Upsert order record
        // await db.insert(orders).values({...}).onConflictDoUpdate({...});

        console.log(`[sync-orders] Would save order ${order.externalOrderId}`);
        saved.push(order.externalOrderId);
      }

      return saved;
    });

    // Step 5: Trigger delist-on-sale for new confirmed orders
    const newConfirmedOrders = matchedOrders.filter(
      (o) => o.status === 'confirmed' && o.itemId
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
      // TODO: Update channel connection lastSyncAt
      // await db.update(channelConnections)
      //   .set({ lastSyncAt: new Date() })
      //   .where(eq(channelConnections.id, connection.id));

      console.log(`[sync-orders] Would update last sync timestamp`);
      return { updated: true };
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
