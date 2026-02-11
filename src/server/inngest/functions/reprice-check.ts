/**
 * Reprice Check Function
 *
 * Evaluates items for potential price adjustments based on
 * user's repricing rules and item performance.
 *
 * Strategies:
 * - time_decay: Gradually reduce price over time
 * - performance: Adjust based on views/watchers (future)
 * - competitive: Match competitor pricing (future)
 *
 * Guardrails:
 * - Never go below floor price
 * - Max daily drop percentage
 * - Max weekly drop percentage
 * - High-value items require approval
 */

import { inngest } from "../client";
import {
  evaluateReprice,
  getRepriceRules,
  getActiveListingsForRepricing,
  checkRepriceLimit,
  incrementRepriceCount,
  createRepriceAction,
  markRepriceExecuted,
  markRepriceFailed,
  updateListingPrice,
  type RepricingContext,
  type RepricingResult,
} from "@/server/services/autopilot/repricing";
import { auditService } from "@/server/services/audit";
import { getAdapter, isNativeChannel } from "@/server/services/channels";
import { db } from "@/server/db/client";
import { autopilotRules } from "@/server/db/schema";
import { eq, and } from "drizzle-orm";

// ============ TYPES ============

interface RepriceAdjustment {
  itemId: string;
  listingId: string;
  channel: string;
  currentPrice: number;
  suggestedPrice: number;
  dropPercent: number;
  action: "reprice" | "skip" | "require_approval" | "rate_limited";
  reason: string;
  confidence: number;
  actionId?: string;
}

// ============ MAIN REPRICE CHECK FUNCTION ============

export const repriceCheck = inngest.createFunction(
  {
    id: "reprice-check",
    name: "Check and Apply Repricing Rules",
    retries: 1,
    // Rate limit per user to avoid API hammering
    rateLimit: {
      key: "event.data.userId",
      limit: 5,
      period: "1m",
    },
  },
  { event: "autopilot/reprice-check" },
  async ({ event, step }) => {
    const { userId, itemId } = event.data;

    // Step 1: Check if user has repricing enabled
    const repriceEnabled = await step.run("check-reprice-enabled", async () => {
      const rules = await db
        .select()
        .from(autopilotRules)
        .where(
          and(
            eq(autopilotRules.userId, userId),
            eq(autopilotRules.ruleType, "reprice"),
            eq(autopilotRules.enabled, true)
          )
        )
        .limit(1);

      return rules.length > 0;
    });

    if (!repriceEnabled) {
      return {
        success: true,
        userId,
        message: "Repricing is not enabled for this user",
        itemsChecked: 0,
        itemsRepriced: 0,
      };
    }

    // Step 2: Load user's reprice rules
    const rules = await step.run("load-reprice-rules", async () => {
      return getRepriceRules(userId);
    });

    // Step 3: Check rate limit
    const rateLimit = await step.run("check-rate-limit", async () => {
      return checkRepriceLimit(userId);
    });

    if (!rateLimit.allowed) {
      const resetsAtStr = typeof rateLimit.resetsAt === 'string'
        ? rateLimit.resetsAt
        : new Date(rateLimit.resetsAt).toISOString();
      return {
        success: true,
        userId,
        message: `Daily reprice limit reached (${100 - rateLimit.remaining}/100). Resets at ${resetsAtStr}`,
        itemsChecked: 0,
        itemsRepriced: 0,
        rateLimitReached: true,
      };
    }

    // Step 4: Get items to check
    const contexts = await step.run("get-items-to-check", async () => {
      const listings = await getActiveListingsForRepricing(userId, itemId);
      // Serialize dates for Inngest step serialization
      return listings.map((ctx) => ({
        ...ctx,
        item: {
          ...ctx.item,
          listedAt: ctx.item.listedAt?.toISOString() ?? null,
        },
        listing: {
          ...ctx.listing,
          publishedAt: ctx.listing.publishedAt?.toISOString() ?? null,
        },
        lastRepriceAt: ctx.lastRepriceAt?.toISOString() ?? null,
      }));
    });

    if (contexts.length === 0) {
      return {
        success: true,
        userId,
        message: "No active listings to check",
        itemsChecked: 0,
        itemsRepriced: 0,
      };
    }

    // Step 5: Evaluate each item for repricing
    const adjustments = await step.run("evaluate-repricing", async () => {
      const results: RepriceAdjustment[] = [];

      for (const serializedCtx of contexts) {
        // Deserialize dates
        const ctx: RepricingContext = {
          ...serializedCtx,
          item: {
            ...serializedCtx.item,
            listedAt: serializedCtx.item.listedAt
              ? new Date(serializedCtx.item.listedAt)
              : null,
          },
          listing: {
            ...serializedCtx.listing,
            publishedAt: serializedCtx.listing.publishedAt
              ? new Date(serializedCtx.listing.publishedAt)
              : null,
          },
          lastRepriceAt: serializedCtx.lastRepriceAt
            ? new Date(serializedCtx.lastRepriceAt)
            : null,
        };

        const result = await evaluateReprice(ctx, rules);

        let action: RepriceAdjustment["action"] = "skip";
        if (result.shouldReprice) {
          action = "reprice";
        } else if (
          result.confidenceLevel === "LOW" ||
          result.confidenceLevel === "VERY_LOW"
        ) {
          action = "require_approval";
        }

        results.push({
          itemId: ctx.item.id,
          listingId: ctx.listing.id,
          channel: ctx.listing.channel,
          currentPrice: ctx.currentPrice,
          suggestedPrice: result.newPrice ?? ctx.currentPrice,
          dropPercent: result.dropPercent ?? 0,
          action,
          reason: result.reason,
          confidence: result.confidence,
        });
      }

      return results;
    });

    // Step 6: Apply price changes
    const applied = await step.run("apply-price-changes", async () => {
      const appliedChanges: string[] = [];
      const failedChanges: Array<{ itemId: string; error: string }> = [];

      let repricesRemaining = rateLimit.remaining;

      for (const adj of adjustments) {
        if (adj.action !== "reprice") {
          continue;
        }

        // Check if we still have reprices remaining
        if (repricesRemaining <= 0) {
          adj.action = "rate_limited";
          adj.reason = "Daily reprice limit reached";
          continue;
        }

        // Find the original context for this adjustment
        const serializedCtx = contexts.find((c) => c.item.id === adj.itemId);
        if (!serializedCtx) continue;

        // Reconstruct context with dates
        const ctx: RepricingContext = {
          ...serializedCtx,
          item: {
            ...serializedCtx.item,
            listedAt: serializedCtx.item.listedAt
              ? new Date(serializedCtx.item.listedAt)
              : null,
          },
          listing: {
            ...serializedCtx.listing,
            publishedAt: serializedCtx.listing.publishedAt
              ? new Date(serializedCtx.listing.publishedAt)
              : null,
          },
          lastRepriceAt: serializedCtx.lastRepriceAt
            ? new Date(serializedCtx.lastRepriceAt)
            : null,
        };

        try {
          // Create action record
          const result: RepricingResult = {
            shouldReprice: true,
            newPrice: adj.suggestedPrice,
            reason: adj.reason,
            confidence: adj.confidence,
            confidenceLevel:
              adj.confidence >= 0.8
                ? "HIGH"
                : adj.confidence >= 0.6
                  ? "MEDIUM"
                  : adj.confidence >= 0.4
                    ? "LOW"
                    : "VERY_LOW",
            dropPercent: adj.dropPercent,
          };

          const actionId = await createRepriceAction(userId, ctx, result);
          adj.actionId = actionId;

          // Update price on the channel if native integration
          if (
            isNativeChannel(ctx.listing.channel as "ebay" | "poshmark" | "mercari" | "depop") &&
            ctx.listing.externalId
          ) {
            const adapter = getAdapter(ctx.listing.channel as "ebay");

            if (adapter.capabilities.canReprice) {
              const updateResult = await adapter.updatePrice(
                userId,
                ctx.listing.externalId,
                adj.suggestedPrice
              );

              if (!updateResult.success) {
                await markRepriceFailed(actionId, updateResult.error ?? "Unknown error");
                failedChanges.push({
                  itemId: adj.itemId,
                  error: updateResult.error ?? "Channel update failed",
                });
                continue;
              }
            }
          }

          // Update local database price
          await updateListingPrice(ctx.listing.id, adj.suggestedPrice);

          // Mark action as executed
          await markRepriceExecuted(actionId);

          // Track the reprice
          incrementRepriceCount(userId);
          repricesRemaining--;

          appliedChanges.push(adj.itemId);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : "Unknown error";
          if (adj.actionId) {
            await markRepriceFailed(adj.actionId, errorMessage);
          }
          failedChanges.push({
            itemId: adj.itemId,
            error: errorMessage,
          });
        }
      }

      return { appliedChanges, failedChanges };
    });

    // Step 7: Log actions to audit
    await step.run("log-audit", async () => {
      for (const adj of adjustments) {
        if (adj.action === "reprice" && adj.actionId) {
          await auditService.log({
            userId,
            actionType: "PRICE_CHANGE",
            actionId: adj.actionId,
            itemId: adj.itemId,
            channel: adj.channel,
            source: "AUTOPILOT",
            beforeState: { price: adj.currentPrice },
            afterState: { price: adj.suggestedPrice },
            metadata: {
              dropPercent: adj.dropPercent,
              reason: adj.reason,
              confidence: adj.confidence,
            },
          });
        }
      }
    });

    return {
      success: true,
      userId,
      itemsChecked: contexts.length,
      itemsRepriced: applied.appliedChanges.length,
      itemsFailed: applied.failedChanges.length,
      adjustments: adjustments.map((adj) => ({
        itemId: adj.itemId,
        action: adj.action,
        currentPrice: adj.currentPrice,
        suggestedPrice: adj.suggestedPrice,
        dropPercent: adj.dropPercent,
        reason: adj.reason,
      })),
    };
  }
);

// ============ SCHEDULED REPRICE CHECK ============

export const scheduledRepriceCheck = inngest.createFunction(
  {
    id: "scheduled-reprice-check",
    name: "Scheduled Daily Reprice Check",
    retries: 1,
  },
  { cron: "0 6 * * *" }, // 6 AM daily (UTC - adjust for user timezone)
  async ({ step }) => {
    // Get all users with repricing enabled
    const usersWithRepricing = await step.run(
      "get-users-with-repricing",
      async () => {
        const enabledRules = await db
          .select({ userId: autopilotRules.userId })
          .from(autopilotRules)
          .where(
            and(
              eq(autopilotRules.ruleType, "reprice"),
              eq(autopilotRules.enabled, true)
            )
          );

        // Get unique user IDs
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const uniqueUserIds = Array.from(new Set(enabledRules.map((r: any) => r.userId)));
        return uniqueUserIds;
      }
    );

    if (usersWithRepricing.length === 0) {
      return {
        success: true,
        message: "No users have repricing enabled",
        usersProcessed: 0,
      };
    }

    // Send reprice-check event for each user
    // Use fan-out to process users in parallel
    const events = usersWithRepricing.map((userId) => ({
      name: "autopilot/reprice-check" as const,
      data: { userId },
    }));

    await step.sendEvent("trigger-user-reprices", events);

    return {
      success: true,
      usersProcessed: usersWithRepricing.length,
    };
  }
);
