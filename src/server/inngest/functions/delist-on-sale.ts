/**
 * Delist On Sale Function
 *
 * CRITICAL AUTOPILOT FUNCTION
 *
 * When an item sells on one channel, this function automatically
 * delists it from all other channels to prevent overselling (double-selling).
 *
 * Flow:
 * 1. Receive order/confirmed event
 * 2. Find all other active listings for the same item
 * 3. For API-integrated channels (eBay): delist automatically
 * 4. For assisted channels (Poshmark, etc.): create notification for manual delist
 * 5. Update inventory status to 'sold'
 * 6. Log all actions to audit
 *
 * Failure handling:
 * - Retries 3 times with exponential backoff
 * - On final failure, sends CRITICAL notification to user
 * - Logs all failures to audit for debugging
 */

import { inngest } from "../client";
import { db } from "@/server/db/client";
import {
  channelListings,
  inventoryItems,
} from "@/server/db/schema";
import { eq, and, ne } from "drizzle-orm";
import {
  getAdapter,
  isNativeChannel,
  CHANNEL_CAPABILITIES,
  type ChannelId,
} from "@/server/services/channels";
import { auditService } from "@/server/services/audit";
import { notifyUser } from "@/server/services/notifications";

// ============ TYPES ============

interface DelistResult {
  channel: ChannelId;
  listingId: string;
  externalId: string | null;
  success: boolean;
  requiresManualAction: boolean;
  error?: string;
}

// ============ MAIN FUNCTION ============

export const delistOnSale = inngest.createFunction(
  {
    id: "delist-on-sale",
    name: "Delist Item When Sold",
    retries: 3,
    onFailure: async ({ error, event: failureEvent }) => {
      // CRITICAL: Alert user immediately when delist fails after all retries
      // In onFailure, the original event is nested within failureEvent.data.event
      const originalEvent = failureEvent.data.event;
      const { userId, itemId, channel: soldOnChannel } = originalEvent.data;

      console.error(
        `[delist-on-sale] CRITICAL FAILURE after retries for item ${itemId}:`,
        error
      );

      // Notify user of critical failure
      await notifyUser(userId, {
        type: "DELIST_FAILED",
        itemId,
        priority: "CRITICAL",
        message: `Failed to delist item from other channels after sale on ${soldOnChannel}. Please manually delist to prevent overselling.`,
        metadata: {
          error: error instanceof Error ? error.message : String(error),
          soldOnChannel,
          retries: 3,
        },
      });

      // Log critical failure to audit
      await auditService.log({
        userId,
        actionType: "DELIST_FAILURE_CRITICAL",
        itemId,
        channel: soldOnChannel,
        source: "SYSTEM",
        afterState: {
          error: error instanceof Error ? error.message : String(error),
          status: "failed_after_retries",
        },
        metadata: {
          failedAt: new Date().toISOString(),
        },
        reversible: false,
      });
    },
  },
  { event: "order/confirmed" },
  async ({ event, step }) => {
    const { orderId, userId, itemId, channel: soldOnChannel, salePrice } = event.data;

    // Step 1: Log the sale event and get item details
    const itemDetails = await step.run("get-item-details", async () => {
      console.log(
        `[delist-on-sale] Processing sale: item ${itemId} sold on ${soldOnChannel} (order: ${orderId})`
      );

      // Get item title for notifications
      const item = await db
        .select({
          id: inventoryItems.id,
          title: inventoryItems.title,
          sku: inventoryItems.sku,
          status: inventoryItems.status,
        })
        .from(inventoryItems)
        .where(eq(inventoryItems.id, itemId))
        .limit(1);

      if (item.length === 0) {
        throw new Error(`Item ${itemId} not found`);
      }

      return item[0];
    });

    // Step 2: Find all other active listings for this item
    const otherListings = await step.run("find-other-listings", async () => {
      const listings = await db
        .select({
          id: channelListings.id,
          channel: channelListings.channel,
          externalId: channelListings.externalId,
          externalUrl: channelListings.externalUrl,
          status: channelListings.status,
          price: channelListings.price,
        })
        .from(channelListings)
        .where(
          and(
            eq(channelListings.itemId, itemId),
            eq(channelListings.status, "active"),
            ne(channelListings.channel, soldOnChannel)
          )
        );

      console.log(
        `[delist-on-sale] Found ${listings.length} other active listings for item ${itemId}`
      );

      return listings;
    });

    // Step 3: Delist from each channel (in parallel where possible)
    const delistResults: DelistResult[] = [];

    for (const listing of otherListings) {
      const result = await step.run(
        `delist-from-${listing.channel}-${listing.id}`,
        async () => {
          const channel = listing.channel as ChannelId;
          const capabilities = CHANNEL_CAPABILITIES[channel];

          // Check if channel supports native delist
          if (isNativeChannel(channel) && capabilities.canDelist) {
            // Native delist via API
            try {
              const adapter = getAdapter(channel);

              if (!listing.externalId) {
                // No external ID means listing was never published
                return {
                  channel,
                  listingId: listing.id,
                  externalId: listing.externalId,
                  success: true,
                  requiresManualAction: false,
                  error: undefined,
                };
              }

              const delistResult = await adapter.delist(
                userId,
                listing.externalId
              );

              if (delistResult.success) {
                // Update listing status in database
                await db
                  .update(channelListings)
                  .set({
                    status: "ended",
                    endedAt: new Date(),
                  })
                  .where(eq(channelListings.id, listing.id));

                console.log(
                  `[delist-on-sale] Successfully delisted from ${channel}: ${listing.externalId}`
                );

                return {
                  channel,
                  listingId: listing.id,
                  externalId: listing.externalId,
                  success: true,
                  requiresManualAction: false,
                  error: undefined,
                };
              } else {
                console.error(
                  `[delist-on-sale] Failed to delist from ${channel}:`,
                  delistResult.error
                );

                return {
                  channel,
                  listingId: listing.id,
                  externalId: listing.externalId,
                  success: false,
                  requiresManualAction: true,
                  error: delistResult.error,
                };
              }
            } catch (error) {
              console.error(
                `[delist-on-sale] Exception delisting from ${channel}:`,
                error
              );

              return {
                channel,
                listingId: listing.id,
                externalId: listing.externalId,
                success: false,
                requiresManualAction: true,
                error:
                  error instanceof Error ? error.message : "Unknown error",
              };
            }
          } else {
            // Assisted channel - notify user to delist manually
            await notifyUser(userId, {
              type: "MANUAL_DELIST_REQUIRED",
              channel,
              itemId,
              itemTitle: itemDetails.title,
              priority: "HIGH",
              metadata: {
                listingUrl: listing.externalUrl,
                soldOnChannel,
                salePrice,
              },
            });

            // Mark listing as needing manual action
            await db
              .update(channelListings)
              .set({
                status: "ended",
                requiresManualAction: true,
                statusMessage: `Item sold on ${soldOnChannel}. Please delist manually.`,
                endedAt: new Date(),
              })
              .where(eq(channelListings.id, listing.id));

            console.log(
              `[delist-on-sale] Notified user to manually delist from ${channel}`
            );

            return {
              channel,
              listingId: listing.id,
              externalId: listing.externalId,
              success: true, // Notification was successful
              requiresManualAction: true,
              error: undefined,
            };
          }
        }
      );

      delistResults.push(result);
    }

    // Step 4: Update inventory status to 'sold'
    await step.run("update-inventory-status", async () => {
      const now = new Date();

      await db
        .update(inventoryItems)
        .set({
          status: "sold",
          soldAt: now,
          updatedAt: now,
        })
        .where(eq(inventoryItems.id, itemId));

      console.log(`[delist-on-sale] Updated item ${itemId} status to sold`);
    });

    // Step 5: Log to audit
    await step.run("audit-log", async () => {
      const successfulDelists = delistResults.filter((r) => r.success && !r.requiresManualAction);
      const manualDelists = delistResults.filter((r) => r.requiresManualAction);
      const failedDelists = delistResults.filter((r) => !r.success);

      await auditService.log({
        userId,
        actionType: "DELIST_ON_SALE",
        itemId,
        channel: soldOnChannel,
        source: "SYSTEM",
        beforeState: {
          itemStatus: itemDetails.status,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          activeListings: otherListings.map((l: any) => ({
            channel: l.channel,
            externalId: l.externalId,
          })),
        },
        afterState: {
          itemStatus: "sold",
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          delistedAutomatically: successfulDelists.map((r: any) => r.channel),
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          requiresManualDelist: manualDelists.map((r: any) => r.channel),
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          failedDelists: failedDelists.map((r: any) => ({
            channel: r.channel,
            error: r.error,
          })),
        },
        metadata: {
          orderId,
          soldOnChannel,
          salePrice,
          totalListings: otherListings.length,
          automaticDelists: successfulDelists.length,
          manualDelists: manualDelists.length,
          failures: failedDelists.length,
        },
        reversible: false,
      });
    });

    // Step 6: Send notifications for any failures
    const failures = delistResults.filter((r) => !r.success);
    if (failures.length > 0) {
      await step.run("notify-failures", async () => {
        for (const failure of failures) {
          await notifyUser(userId, {
            type: "DELIST_FAILED",
            channel: failure.channel,
            itemId,
            itemTitle: itemDetails.title,
            priority: "HIGH",
            message: failure.error,
            metadata: {
              externalId: failure.externalId,
              soldOnChannel,
            },
          });
        }
      });
    }

    // Calculate summary
    const summary = {
      success: true,
      itemId,
      itemTitle: itemDetails.title,
      soldOnChannel,
      orderId,
      totalOtherListings: otherListings.length,
      automaticallyDelisted: delistResults.filter(
        (r) => r.success && !r.requiresManualAction
      ).length,
      manualDelistRequired: delistResults.filter((r) => r.requiresManualAction)
        .length,
      failed: delistResults.filter((r) => !r.success).length,
      delistResults,
    };

    console.log(
      `[delist-on-sale] Complete for item ${itemId}:`,
      JSON.stringify(summary, null, 2)
    );

    return summary;
  }
);
