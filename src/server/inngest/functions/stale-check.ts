/**
 * Stale Inventory Check Function
 *
 * Identifies items that have been listed for extended periods without
 * activity (views, watchers, offers, sales).
 *
 * Thresholds:
 * - 30 days: Warning notification
 * - 60 days: Consider repricing or relisting
 * - 90 days: Consider archiving or heavy discount
 *
 * Actions:
 * - Notify user with suggestions
 * - Optionally auto-archive after configurable days
 * - Suggest repricing strategies
 */

import { inngest } from "../client";
import { db } from "@/server/db/client";
import { inventoryItems, channelListings, autopilotRules, autopilotActions } from "@/server/db/schema";
import type { StaleRuleConfig } from "@/server/db/schema";
import { eq, and, lt } from "drizzle-orm";
import { auditService } from "@/server/services/audit";

// ============ TYPES ============

export interface StaleItemReport {
  itemId: string;
  title: string;
  daysListed: number;
  currentPrice: number;
  floorPrice?: number | null;
  channel?: string;
  staleness: "warning" | "stale" | "very_stale";
  suggestion: string;
  action?: "notify" | "archive" | "relist";
}

interface StaleCheckResult {
  itemId: string;
  action: "notify" | "archive" | "skip";
  reason: string;
}

// ============ DEFAULT RULES ============

const DEFAULT_STALE_RULES: StaleRuleConfig = {
  daysUntilStale: 60,
  notifyOnly: true,
  autoRelist: false,
};

// ============ HELPER FUNCTIONS ============

/**
 * Get staleness level based on days listed
 */
function getStalenessLevel(
  daysListed: number,
  daysUntilStale: number
): "warning" | "stale" | "very_stale" | null {
  const warningThreshold = Math.floor(daysUntilStale * 0.5); // 50% of stale threshold
  const veryStaleThreshold = Math.floor(daysUntilStale * 1.5); // 150% of stale threshold

  if (daysListed >= veryStaleThreshold) {
    return "very_stale";
  } else if (daysListed >= daysUntilStale) {
    return "stale";
  } else if (daysListed >= warningThreshold) {
    return "warning";
  }

  return null;
}

/**
 * Get suggestion based on staleness level
 */
function getSuggestion(
  staleness: "warning" | "stale" | "very_stale",
  currentPrice: number,
  floorPrice?: number | null
): string {
  const hasFloorRoom = !floorPrice || currentPrice > floorPrice * 1.1;

  switch (staleness) {
    case "warning":
      return hasFloorRoom
        ? "Consider a small price reduction (5-10%) to attract buyers"
        : "Monitor for another week before taking action";

    case "stale":
      if (hasFloorRoom) {
        return "Recommend 10-15% price reduction or refresh listing with new photos";
      }
      return "Consider relisting with updated photos and description";

    case "very_stale":
      if (hasFloorRoom) {
        return "Consider aggressive repricing (20%+) or archiving if no longer profitable";
      }
      return "Consider archiving this item or accepting any reasonable offer";
  }
}

// ============ STALE CHECK FUNCTION ============

export const staleCheck = inngest.createFunction(
  {
    id: "stale-check",
    name: "Check for Stale Inventory",
    retries: 1,
    rateLimit: {
      key: "event.data.userId",
      limit: 2,
      period: "1h",
    },
  },
  { event: "autopilot/stale-check" },
  async ({ event, step }) => {
    const { userId, daysThreshold } = event.data;

    // Step 1: Get user's stale rules
    const rules = await step.run("get-stale-rules", async () => {
      const userRules = await db
        .select()
        .from(autopilotRules)
        .where(
          and(
            eq(autopilotRules.userId, userId),
            eq(autopilotRules.ruleType, "stale"),
            eq(autopilotRules.enabled, true)
          )
        )
        .limit(1);

      if (userRules.length === 0) {
        return DEFAULT_STALE_RULES;
      }

      return userRules[0].config as StaleRuleConfig;
    });

    const effectiveThreshold = daysThreshold ?? rules.daysUntilStale;
    const warningThreshold = Math.floor(effectiveThreshold * 0.5);

    // Step 2: Find items that might be stale
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - warningThreshold);

    const staleItems = await step.run("find-stale-items", async () => {
      // Get items listed before the cutoff date
      const items = await db
        .select({
          item: inventoryItems,
          listing: channelListings,
        })
        .from(inventoryItems)
        .leftJoin(channelListings, eq(inventoryItems.id, channelListings.itemId))
        .where(
          and(
            eq(inventoryItems.userId, userId),
            eq(inventoryItems.status, "active"),
            lt(inventoryItems.listedAt, cutoffDate)
          )
        );

      return items.map((row) => ({
        item: {
          id: row.item.id,
          title: row.item.title,
          askingPrice: row.item.askingPrice,
          floorPrice: row.item.floorPrice,
          listedAt: row.item.listedAt?.toISOString() ?? null,
          createdAt: row.item.createdAt.toISOString(),
        },
        listing: row.listing
          ? {
              id: row.listing.id,
              channel: row.listing.channel,
              price: row.listing.price,
              publishedAt: row.listing.publishedAt?.toISOString() ?? null,
            }
          : null,
      }));
    });

    if (staleItems.length === 0) {
      return {
        success: true,
        userId,
        message: "No stale inventory found",
        itemsChecked: 0,
        staleItems: [],
      };
    }

    // Step 3: Analyze each item and generate report
    const reports = await step.run("analyze-stale-items", async () => {
      const results: StaleItemReport[] = [];

      for (const { item, listing } of staleItems) {
        const listedDate = item.listedAt
          ? new Date(item.listedAt)
          : new Date(item.createdAt);
        const daysListed = Math.floor(
          (Date.now() - listedDate.getTime()) / (24 * 60 * 60 * 1000)
        );

        const staleness = getStalenessLevel(daysListed, effectiveThreshold);

        if (!staleness) {
          continue; // Not stale enough
        }

        const currentPrice = listing?.price ?? item.askingPrice;
        const suggestion = getSuggestion(staleness, currentPrice, item.floorPrice);

        // Determine action based on rules
        let action: "notify" | "archive" | "relist" | undefined;
        if (rules.notifyOnly) {
          action = "notify";
        } else if (staleness === "very_stale" && !rules.autoRelist) {
          action = "archive";
        } else if (rules.autoRelist && (staleness === "stale" || staleness === "very_stale")) {
          action = "relist";
        } else {
          action = "notify";
        }

        results.push({
          itemId: item.id,
          title: item.title,
          daysListed,
          currentPrice,
          floorPrice: item.floorPrice,
          channel: listing?.channel,
          staleness,
          suggestion,
          action,
        });
      }

      // Sort by staleness (most stale first)
      results.sort((a, b) => {
        const order = { very_stale: 0, stale: 1, warning: 2 };
        return order[a.staleness] - order[b.staleness];
      });

      return results;
    });

    if (reports.length === 0) {
      return {
        success: true,
        userId,
        message: "No items meet staleness threshold",
        itemsChecked: staleItems.length,
        staleItems: [],
      };
    }

    // Step 4: Take action based on rules
    const actions = await step.run("process-stale-actions", async () => {
      const results: StaleCheckResult[] = [];

      for (const report of reports) {
        if (report.action === "archive" && !rules.notifyOnly) {
          // Auto-archive very stale items
          await db
            .update(inventoryItems)
            .set({ status: "archived" })
            .where(eq(inventoryItems.id, report.itemId));

          // Create autopilot action record
          const actionId = crypto.randomUUID();
          await db.insert(autopilotActions).values({
            id: actionId,
            userId,
            itemId: report.itemId,
            actionType: "ARCHIVE",
            confidence: 0.7,
            confidenceLevel: "MEDIUM",
            beforeState: { status: "active" },
            afterState: { status: "archived" },
            payload: {
              reason: `Stale for ${report.daysListed} days`,
              daysListed: report.daysListed,
            },
            status: "executed",
            requiresApproval: false,
            reversible: true,
            undoDeadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
            createdAt: new Date(),
            executedAt: new Date(),
            retryCount: 0,
          });

          // Log to audit
          await auditService.log({
            userId,
            actionType: "ITEM_ARCHIVE",
            actionId,
            itemId: report.itemId,
            source: "AUTOPILOT",
            beforeState: { status: "active" },
            afterState: { status: "archived" },
            metadata: {
              reason: "Auto-archived stale item",
              daysListed: report.daysListed,
            },
          });

          results.push({
            itemId: report.itemId,
            action: "archive",
            reason: `Auto-archived: stale for ${report.daysListed} days`,
          });
        } else {
          // Just notify
          results.push({
            itemId: report.itemId,
            action: "notify",
            reason: report.suggestion,
          });
        }
      }

      return results;
    });

    // Step 5: Create notification summary
    const summary = await step.run("create-summary", async () => {
      const warningCount = reports.filter((r) => r.staleness === "warning").length;
      const staleCount = reports.filter((r) => r.staleness === "stale").length;
      const veryStaleCount = reports.filter((r) => r.staleness === "very_stale").length;
      const archivedCount = actions.filter((a) => a.action === "archive").length;

      return {
        totalStale: reports.length,
        warningCount,
        staleCount,
        veryStaleCount,
        archivedCount,
        message:
          `Found ${reports.length} potentially stale items: ` +
          `${veryStaleCount} very stale, ${staleCount} stale, ${warningCount} warnings. ` +
          (archivedCount > 0 ? `Auto-archived ${archivedCount} items.` : ""),
      };
    });

    return {
      success: true,
      userId,
      ...summary,
      staleItems: reports.map((r) => ({
        itemId: r.itemId,
        title: r.title,
        daysListed: r.daysListed,
        staleness: r.staleness,
        suggestion: r.suggestion,
        actionTaken: actions.find((a) => a.itemId === r.itemId)?.action ?? "none",
      })),
    };
  }
);

// ============ SCHEDULED STALE CHECK ============

export const scheduledStaleCheck = inngest.createFunction(
  {
    id: "scheduled-stale-check",
    name: "Scheduled Weekly Stale Inventory Check",
    retries: 1,
  },
  { cron: "0 10 * * 1" }, // 10 AM UTC every Monday
  async ({ step }) => {
    // Get all users with stale rules (or active items)
    const usersToCheck = await step.run("get-users-to-check", async () => {
      // Get users with stale rules enabled
      const usersWithRules = await db
        .select({ userId: autopilotRules.userId })
        .from(autopilotRules)
        .where(
          and(
            eq(autopilotRules.ruleType, "stale"),
            eq(autopilotRules.enabled, true)
          )
        );

      // Get unique user IDs
      return Array.from(new Set(usersWithRules.map((r) => r.userId)));
    });

    if (usersToCheck.length === 0) {
      return {
        success: true,
        message: "No users have stale check enabled",
        usersProcessed: 0,
      };
    }

    // Send stale-check event for each user
    const events = usersToCheck.map((userId) => ({
      name: "autopilot/stale-check" as const,
      data: { userId },
    }));

    await step.sendEvent("trigger-stale-checks", events);

    return {
      success: true,
      usersProcessed: usersToCheck.length,
    };
  }
);
