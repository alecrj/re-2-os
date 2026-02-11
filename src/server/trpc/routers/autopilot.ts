import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "../init";
import { db } from "@/server/db/client";
import {
  autopilotRules,
  autopilotActions,
  channelListings,
  inventoryItems,
  type OfferRuleConfig,
  type RepriceRuleConfig,
} from "@/server/db/schema";
import { eq, and, desc, inArray, gte, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { auditService } from "@/server/services/audit";
import {
  validateOfferRuleConfig,
  DEFAULT_OFFER_RULE_CONFIG,
} from "@/server/services/autopilot";
import {
  getAdapter,
  isNativeChannel,
  type ChannelId,
} from "@/server/services/channels";

// ============ INPUT SCHEMAS ============

const offerRuleInputSchema = z.object({
  id: z.string().optional(),
  autoAcceptThreshold: z.number().min(0).max(1).default(0.9),
  autoDeclineThreshold: z.number().min(0).max(1).default(0.5),
  autoCounterEnabled: z.boolean().default(false),
  counterStrategy: z.enum(["floor", "midpoint", "asking-5%"]).default("midpoint"),
  maxCounterRounds: z.number().int().min(1).max(5).default(2),
  highValueThreshold: z.number().positive().default(200),
  enabled: z.boolean().default(true),
});

const repriceRuleInputSchema = z.object({
  id: z.string().optional(),
  strategy: z.enum(["time_decay", "performance", "competitive"]).default("time_decay"),
  maxDailyDrop: z.number().min(0).max(0.5).default(0.1),
  maxWeeklyDrop: z.number().min(0).max(0.5).default(0.2),
  respectFloorPrice: z.boolean().default(true),
  highValueThreshold: z.number().positive().default(200),
  enabled: z.boolean().default(true),
});

const resolveActionInputSchema = z.object({
  actionId: z.string(),
  decision: z.enum(["approve", "reject"]),
});

const bulkResolveInputSchema = z.object({
  actionIds: z.array(z.string()).min(1),
  decision: z.enum(["approve", "reject"]),
});

// ============ ACTION EXECUTION HELPER ============

interface ActionExecutionResult {
  success: boolean;
  error?: string;
  requiresManualAction?: boolean;
  manualInstructions?: string;
}

/**
 * Execute an autopilot action via the appropriate channel adapter.
 * Handles both native channels (eBay) and assisted channels (Poshmark, etc.)
 */
async function executeAutopilotAction(
  userId: string,
  action: {
    id: string;
    actionType: string;
    itemId: string | null;
    beforeState: Record<string, unknown> | null;
    afterState: Record<string, unknown> | null;
    payload: Record<string, unknown> | null;
  }
): Promise<ActionExecutionResult> {
  // Get the item and its channel listings if we have an itemId
  if (!action.itemId) {
    return { success: true }; // No item to act on, consider successful
  }

  const item = await db.query.inventoryItems.findFirst({
    where: eq(inventoryItems.id, action.itemId),
  });

  if (!item) {
    return { success: false, error: "Item not found" };
  }

  // Get active channel listings for this item
  const listings = await db.query.channelListings.findMany({
    where: and(
      eq(channelListings.itemId, action.itemId),
      eq(channelListings.status, "active")
    ),
  });

  if (listings.length === 0) {
    // No active listings to update
    return { success: true };
  }

  const results: ActionExecutionResult[] = [];
  const manualActions: string[] = [];

  for (const listing of listings) {
    const channel = listing.channel as ChannelId;

    // Check if this is a native channel
    if (isNativeChannel(channel)) {
      try {
        const adapter = getAdapter(channel);

        // Execute action based on type
        switch (action.actionType) {
          case "REPRICE": {
            const newPrice = action.afterState?.price as number | undefined;
            if (newPrice !== undefined && listing.externalId) {
              const result = await adapter.updatePrice(userId, listing.externalId, newPrice);
              if (!result.success) {
                results.push({ success: false, error: result.error });
              } else {
                // Update local listing price
                await db
                  .update(channelListings)
                  .set({ price: newPrice })
                  .where(eq(channelListings.id, listing.id));
                results.push({ success: true });
              }
            }
            break;
          }

          case "DELIST": {
            if (listing.externalId) {
              const result = await adapter.delist(userId, listing.externalId);
              if (!result.success) {
                results.push({ success: false, error: result.error });
              } else {
                // Update local listing status
                await db
                  .update(channelListings)
                  .set({ status: "ended", endedAt: new Date() })
                  .where(eq(channelListings.id, listing.id));
                results.push({ success: true });
              }
            }
            break;
          }

          case "OFFER_ACCEPT":
          case "OFFER_DECLINE":
          case "OFFER_COUNTER": {
            // Offer operations typically need the offer ID from the payload
            // For now, mark as successful since eBay handles offers differently
            // In a full implementation, this would call the eBay Trading API
            results.push({ success: true });
            break;
          }

          case "RELIST": {
            // Re-list by updating quantity back to 1
            if (listing.externalId) {
              const result = await adapter.update(userId, listing.externalId, {
                quantity: 1,
              });
              if (!result.success) {
                results.push({ success: false, error: result.error });
              } else {
                // Update local listing status
                await db
                  .update(channelListings)
                  .set({ status: "active", endedAt: null })
                  .where(eq(channelListings.id, listing.id));
                results.push({ success: true });
              }
            }
            break;
          }

          case "ARCHIVE": {
            // Archive is a local-only action, delist from channel first
            if (listing.externalId) {
              const result = await adapter.delist(userId, listing.externalId);
              if (!result.success) {
                results.push({ success: false, error: result.error });
              } else {
                await db
                  .update(channelListings)
                  .set({ status: "ended", endedAt: new Date() })
                  .where(eq(channelListings.id, listing.id));
                results.push({ success: true });
              }
            }
            break;
          }

          default:
            results.push({ success: true });
        }
      } catch (error) {
        results.push({
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    } else {
      // Assisted channel - cannot automate, provide instructions
      manualActions.push(
        `${channel.charAt(0).toUpperCase() + channel.slice(1)}: Please manually ${action.actionType.toLowerCase().replace("_", " ")} listing`
      );
    }
  }

  // Update item status if needed
  if (action.actionType === "ARCHIVE") {
    await db
      .update(inventoryItems)
      .set({ status: "archived", updatedAt: new Date() })
      .where(eq(inventoryItems.id, action.itemId));
  } else if (action.actionType === "REPRICE") {
    const newPrice = action.afterState?.price as number | undefined;
    if (newPrice !== undefined) {
      await db
        .update(inventoryItems)
        .set({ askingPrice: newPrice, updatedAt: new Date() })
        .where(eq(inventoryItems.id, action.itemId));
    }
  }

  // Determine overall result
  const failedResults = results.filter((r) => !r.success);
  if (failedResults.length > 0) {
    return {
      success: false,
      error: failedResults.map((r) => r.error).join("; "),
    };
  }

  if (manualActions.length > 0) {
    return {
      success: true,
      requiresManualAction: true,
      manualInstructions: manualActions.join("\n"),
    };
  }

  return { success: true };
}

/**
 * Execute an undo operation via the channel adapter.
 * Reverses a previous autopilot action by restoring the before state.
 */
async function executeUndoAction(
  userId: string,
  action: {
    id: string;
    actionType: string;
    itemId: string | null;
    beforeState: Record<string, unknown> | null;
    afterState: Record<string, unknown> | null;
  }
): Promise<ActionExecutionResult> {
  if (!action.itemId || !action.beforeState) {
    return { success: true };
  }

  const item = await db.query.inventoryItems.findFirst({
    where: eq(inventoryItems.id, action.itemId),
  });

  if (!item) {
    return { success: false, error: "Item not found" };
  }

  // Get active channel listings for this item
  const listings = await db.query.channelListings.findMany({
    where: eq(channelListings.itemId, action.itemId),
  });

  const results: ActionExecutionResult[] = [];
  const manualActions: string[] = [];

  for (const listing of listings) {
    const channel = listing.channel as ChannelId;

    if (isNativeChannel(channel)) {
      try {
        const adapter = getAdapter(channel);

        switch (action.actionType) {
          case "REPRICE": {
            // Restore original price
            const originalPrice = action.beforeState?.price as number | undefined;
            if (originalPrice !== undefined && listing.externalId) {
              const result = await adapter.updatePrice(userId, listing.externalId, originalPrice);
              if (!result.success) {
                results.push({ success: false, error: result.error });
              } else {
                await db
                  .update(channelListings)
                  .set({ price: originalPrice })
                  .where(eq(channelListings.id, listing.id));
                results.push({ success: true });
              }
            }
            break;
          }

          case "DELIST": {
            // Re-list the item (restore quantity)
            if (listing.externalId) {
              const result = await adapter.update(userId, listing.externalId, {
                quantity: 1,
              });
              if (!result.success) {
                results.push({ success: false, error: result.error });
              } else {
                await db
                  .update(channelListings)
                  .set({ status: "active", endedAt: null })
                  .where(eq(channelListings.id, listing.id));
                results.push({ success: true });
              }
            }
            break;
          }

          case "RELIST": {
            // Un-relist (delist again)
            if (listing.externalId) {
              const result = await adapter.delist(userId, listing.externalId);
              if (!result.success) {
                results.push({ success: false, error: result.error });
              } else {
                await db
                  .update(channelListings)
                  .set({ status: "ended", endedAt: new Date() })
                  .where(eq(channelListings.id, listing.id));
                results.push({ success: true });
              }
            }
            break;
          }

          default:
            // For actions like OFFER_ACCEPT, OFFER_DECLINE - cannot undo
            results.push({ success: true });
        }
      } catch (error) {
        results.push({
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    } else {
      manualActions.push(
        `${channel.charAt(0).toUpperCase() + channel.slice(1)}: Please manually undo the ${action.actionType.toLowerCase().replace("_", " ")} action`
      );
    }
  }

  // Restore item state if needed
  if (action.actionType === "REPRICE") {
    const originalPrice = action.beforeState?.price as number | undefined;
    if (originalPrice !== undefined) {
      await db
        .update(inventoryItems)
        .set({ askingPrice: originalPrice, updatedAt: new Date() })
        .where(eq(inventoryItems.id, action.itemId));
    }
  } else if (action.actionType === "ARCHIVE") {
    const originalStatus = (action.beforeState?.status as string) ?? "active";
    await db
      .update(inventoryItems)
      .set({ status: originalStatus as "draft" | "active" | "sold" | "shipped" | "archived", updatedAt: new Date() })
      .where(eq(inventoryItems.id, action.itemId));
  }

  const failedResults = results.filter((r) => !r.success);
  if (failedResults.length > 0) {
    return {
      success: false,
      error: failedResults.map((r) => r.error).join("; "),
    };
  }

  if (manualActions.length > 0) {
    return {
      success: true,
      requiresManualAction: true,
      manualInstructions: manualActions.join("\n"),
    };
  }

  return { success: true };
}

// ============ RATE LIMIT TRACKING ============

/**
 * Rate limit configuration
 */
const RATE_LIMITS = {
  ebayRevisions: { daily: 200 },
  reprices: { daily: 100 },
  autoAccepts: { daily: 50 },
};

/**
 * Get the start of the current day in Pacific Time (eBay's reset time)
 */
function getTodayStartPT(): Date {
  const now = new Date();
  const ptString = now.toLocaleString("en-US", { timeZone: "America/Los_Angeles" });
  const ptDate = new Date(ptString);
  ptDate.setHours(0, 0, 0, 0);

  // Convert back to UTC
  const ptOffset = now.getTime() - new Date(now.toLocaleString("en-US", { timeZone: "America/Los_Angeles" })).getTime();
  return new Date(ptDate.getTime() + ptOffset);
}

/**
 * Get rate limit usage from the database by counting today's executed actions
 */
async function getRateLimitUsage(userId: string): Promise<{
  ebayRevisions: { daily: number; used: number; remaining: number };
  reprices: { daily: number; used: number; remaining: number };
  autoAccepts: { daily: number; used: number; remaining: number };
}> {
  const todayStart = getTodayStartPT();

  // Count reprices executed today
  const repriceCount = await db
    .select({ count: sql<number>`count(*)` })
    .from(autopilotActions)
    .where(
      and(
        eq(autopilotActions.userId, userId),
        eq(autopilotActions.actionType, "REPRICE"),
        eq(autopilotActions.status, "executed"),
        gte(autopilotActions.executedAt, todayStart)
      )
    );

  // Count auto-accepts executed today
  const autoAcceptCount = await db
    .select({ count: sql<number>`count(*)` })
    .from(autopilotActions)
    .where(
      and(
        eq(autopilotActions.userId, userId),
        eq(autopilotActions.actionType, "OFFER_ACCEPT"),
        eq(autopilotActions.status, "executed"),
        gte(autopilotActions.executedAt, todayStart)
      )
    );

  // Count all channel-affecting actions as eBay revisions
  // (REPRICE, DELIST, RELIST, ARCHIVE all count as revisions)
  const revisionCount = await db
    .select({ count: sql<number>`count(*)` })
    .from(autopilotActions)
    .where(
      and(
        eq(autopilotActions.userId, userId),
        eq(autopilotActions.status, "executed"),
        gte(autopilotActions.executedAt, todayStart),
        inArray(autopilotActions.actionType, ["REPRICE", "DELIST", "RELIST", "ARCHIVE"])
      )
    );

  const repricesUsed = Number(repriceCount[0]?.count ?? 0);
  const autoAcceptsUsed = Number(autoAcceptCount[0]?.count ?? 0);
  const revisionsUsed = Number(revisionCount[0]?.count ?? 0);

  return {
    ebayRevisions: {
      daily: RATE_LIMITS.ebayRevisions.daily,
      used: revisionsUsed,
      remaining: Math.max(0, RATE_LIMITS.ebayRevisions.daily - revisionsUsed),
    },
    reprices: {
      daily: RATE_LIMITS.reprices.daily,
      used: repricesUsed,
      remaining: Math.max(0, RATE_LIMITS.reprices.daily - repricesUsed),
    },
    autoAccepts: {
      daily: RATE_LIMITS.autoAccepts.daily,
      used: autoAcceptsUsed,
      remaining: Math.max(0, RATE_LIMITS.autoAccepts.daily - autoAcceptsUsed),
    },
  };
}

// ============ ROUTER ============

export const autopilotRouter = createTRPCRouter({
  // ============ RULES ============

  /**
   * Get all autopilot rules for the current user
   */
  listRules: protectedProcedure.query(async ({ ctx }) => {
    const rules = await db.query.autopilotRules.findMany({
      where: eq(autopilotRules.userId, ctx.user.id),
      orderBy: [desc(autopilotRules.createdAt)],
    });

    return rules;
  }),

  /**
   * Get a specific rule by ID
   */
  getRuleById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input, ctx }) => {
      const rule = await db.query.autopilotRules.findFirst({
        where: and(
          eq(autopilotRules.id, input.id),
          eq(autopilotRules.userId, ctx.user.id)
        ),
      });

      return rule ?? null;
    }),

  /**
   * Get user's offer rule (or defaults)
   */
  getOfferRule: protectedProcedure.query(async ({ ctx }) => {
    const rule = await db.query.autopilotRules.findFirst({
      where: and(
        eq(autopilotRules.userId, ctx.user.id),
        eq(autopilotRules.ruleType, "offer")
      ),
    });

    if (!rule) {
      return {
        id: null,
        enabled: false,
        config: DEFAULT_OFFER_RULE_CONFIG,
      };
    }

    return {
      id: rule.id,
      enabled: rule.enabled,
      config: rule.config as OfferRuleConfig,
    };
  }),

  /**
   * Create or update offer handling rules
   */
  upsertOfferRule: protectedProcedure
    .input(offerRuleInputSchema)
    .mutation(async ({ input, ctx }) => {
      const config: OfferRuleConfig = {
        autoAcceptThreshold: input.autoAcceptThreshold,
        autoDeclineThreshold: input.autoDeclineThreshold,
        autoCounterEnabled: input.autoCounterEnabled,
        counterStrategy: input.counterStrategy,
        maxCounterRounds: input.maxCounterRounds,
        highValueThreshold: input.highValueThreshold,
      };

      // Validate configuration
      const validation = validateOfferRuleConfig(config);
      if (!validation.valid) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: validation.errors.join(", "),
        });
      }

      const now = new Date();

      if (input.id) {
        // Update existing rule
        await db
          .update(autopilotRules)
          .set({
            config,
            enabled: input.enabled,
            updatedAt: now,
          })
          .where(
            and(
              eq(autopilotRules.id, input.id),
              eq(autopilotRules.userId, ctx.user.id)
            )
          );

        return { id: input.id, updated: true };
      }

      // Check if rule already exists
      const existing = await db.query.autopilotRules.findFirst({
        where: and(
          eq(autopilotRules.userId, ctx.user.id),
          eq(autopilotRules.ruleType, "offer")
        ),
      });

      if (existing) {
        // Update existing
        await db
          .update(autopilotRules)
          .set({
            config,
            enabled: input.enabled,
            updatedAt: now,
          })
          .where(eq(autopilotRules.id, existing.id));

        return { id: existing.id, updated: true };
      }

      // Create new rule
      const id = crypto.randomUUID();
      await db.insert(autopilotRules).values({
        id,
        userId: ctx.user.id,
        ruleType: "offer",
        config,
        enabled: input.enabled,
        createdAt: now,
        updatedAt: now,
      });

      return { id, updated: false };
    }),

  /**
   * Create or update repricing rules
   */
  upsertRepriceRule: protectedProcedure
    .input(repriceRuleInputSchema)
    .mutation(async ({ input, ctx }) => {
      const config: RepriceRuleConfig = {
        strategy: input.strategy,
        maxDailyDropPercent: input.maxDailyDrop,
        maxWeeklyDropPercent: input.maxWeeklyDrop,
        respectFloorPrice: input.respectFloorPrice,
        highValueThreshold: input.highValueThreshold,
      };

      const now = new Date();

      if (input.id) {
        // Update existing rule
        await db
          .update(autopilotRules)
          .set({
            config,
            enabled: input.enabled,
            updatedAt: now,
          })
          .where(
            and(
              eq(autopilotRules.id, input.id),
              eq(autopilotRules.userId, ctx.user.id)
            )
          );

        return { id: input.id, updated: true };
      }

      // Check if rule already exists
      const existing = await db.query.autopilotRules.findFirst({
        where: and(
          eq(autopilotRules.userId, ctx.user.id),
          eq(autopilotRules.ruleType, "reprice")
        ),
      });

      if (existing) {
        await db
          .update(autopilotRules)
          .set({
            config,
            enabled: input.enabled,
            updatedAt: now,
          })
          .where(eq(autopilotRules.id, existing.id));

        return { id: existing.id, updated: true };
      }

      // Create new rule
      const id = crypto.randomUUID();
      await db.insert(autopilotRules).values({
        id,
        userId: ctx.user.id,
        ruleType: "reprice",
        config,
        enabled: input.enabled,
        createdAt: now,
        updatedAt: now,
      });

      return { id, updated: false };
    }),

  /**
   * Toggle rule enabled status
   */
  toggleRule: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        enabled: z.boolean(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const rule = await db.query.autopilotRules.findFirst({
        where: and(
          eq(autopilotRules.id, input.id),
          eq(autopilotRules.userId, ctx.user.id)
        ),
      });

      if (!rule) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Rule not found",
        });
      }

      await db
        .update(autopilotRules)
        .set({
          enabled: input.enabled,
          updatedAt: new Date(),
        })
        .where(eq(autopilotRules.id, input.id));

      return { success: true };
    }),

  // ============ PENDING ACTIONS ============

  /**
   * Get pending actions awaiting approval
   */
  getPendingActions: protectedProcedure
    .input(
      z
        .object({
          limit: z.number().min(1).max(100).default(50),
          offset: z.number().min(0).default(0),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      const limit = input?.limit ?? 50;
      const offset = input?.offset ?? 0;

      const actions = await db.query.autopilotActions.findMany({
        where: and(
          eq(autopilotActions.userId, ctx.user.id),
          eq(autopilotActions.status, "pending"),
          eq(autopilotActions.requiresApproval, true)
        ),
        orderBy: [desc(autopilotActions.createdAt)],
        limit,
        offset,
        with: {
          item: {
            columns: {
              id: true,
              title: true,
              askingPrice: true,
              floorPrice: true,
            },
          },
        },
      });

      // Get total count
      const allPending = await db.query.autopilotActions.findMany({
        where: and(
          eq(autopilotActions.userId, ctx.user.id),
          eq(autopilotActions.status, "pending"),
          eq(autopilotActions.requiresApproval, true)
        ),
        columns: { id: true },
      });

      return {
        actions,
        total: allPending.length,
        hasMore: offset + limit < allPending.length,
      };
    }),

  /**
   * Get count of pending actions
   */
  getPendingCount: protectedProcedure.query(async ({ ctx }) => {
    const pending = await db.query.autopilotActions.findMany({
      where: and(
        eq(autopilotActions.userId, ctx.user.id),
        eq(autopilotActions.status, "pending"),
        eq(autopilotActions.requiresApproval, true)
      ),
      columns: { id: true },
    });

    return { count: pending.length };
  }),

  /**
   * Approve or reject a pending action
   */
  resolveAction: protectedProcedure
    .input(resolveActionInputSchema)
    .mutation(async ({ input, ctx }) => {
      const action = await db.query.autopilotActions.findFirst({
        where: and(
          eq(autopilotActions.id, input.actionId),
          eq(autopilotActions.userId, ctx.user.id),
          eq(autopilotActions.status, "pending")
        ),
        with: {
          item: true,
        },
      });

      if (!action) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Pending action not found",
        });
      }

      const now = new Date();

      if (input.decision === "approve") {
        // Execute the action via channel adapter
        const executionResult = await executeAutopilotAction(ctx.user.id, {
          id: action.id,
          actionType: action.actionType,
          itemId: action.itemId,
          beforeState: action.beforeState,
          afterState: action.afterState,
          payload: action.payload,
        });

        if (!executionResult.success) {
          // Update action as failed
          await db
            .update(autopilotActions)
            .set({
              status: "failed",
              errorMessage: executionResult.error,
              retryCount: (action.retryCount ?? 0) + 1,
            })
            .where(eq(autopilotActions.id, input.actionId));

          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: executionResult.error ?? "Failed to execute action",
          });
        }

        await db
          .update(autopilotActions)
          .set({
            status: "executed",
            executedAt: now,
          })
          .where(eq(autopilotActions.id, input.actionId));

        // Log to audit
        await auditService.log({
          userId: ctx.user.id,
          actionType: action.actionType,
          actionId: action.id,
          itemId: action.itemId ?? undefined,
          source: "USER",
          beforeState: action.beforeState ?? undefined,
          afterState: action.afterState ?? undefined,
          metadata: {
            originalConfidence: action.confidence,
            approvedManually: true,
            requiresManualAction: executionResult.requiresManualAction,
            manualInstructions: executionResult.manualInstructions,
          },
        });

        return {
          success: true,
          status: "executed" as const,
          requiresManualAction: executionResult.requiresManualAction,
          manualInstructions: executionResult.manualInstructions,
        };
      } else {
        // Reject the action
        await db
          .update(autopilotActions)
          .set({
            status: "rejected",
          })
          .where(eq(autopilotActions.id, input.actionId));

        return { success: true, status: "rejected" as const };
      }
    }),

  /**
   * Bulk approve or reject pending actions
   */
  bulkResolveActions: protectedProcedure
    .input(bulkResolveInputSchema)
    .mutation(async ({ input, ctx }) => {
      const now = new Date();
      const newStatus = input.decision === "approve" ? "executed" : "rejected";

      // Verify all actions belong to user and are pending
      const actions = await db.query.autopilotActions.findMany({
        where: and(
          eq(autopilotActions.userId, ctx.user.id),
          eq(autopilotActions.status, "pending"),
          inArray(autopilotActions.id, input.actionIds)
        ),
      });

      if (actions.length !== input.actionIds.length) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Some actions not found or not pending",
        });
      }

      // Update all actions
      await db
        .update(autopilotActions)
        .set({
          status: newStatus,
          executedAt: input.decision === "approve" ? now : null,
        })
        .where(
          and(
            eq(autopilotActions.userId, ctx.user.id),
            inArray(autopilotActions.id, input.actionIds)
          )
        );

      // Log audit entries for approved actions
      if (input.decision === "approve") {
        for (const action of actions) {
          await auditService.log({
            userId: ctx.user.id,
            actionType: action.actionType,
            actionId: action.id,
            itemId: action.itemId ?? undefined,
            source: "USER",
            metadata: {
              originalConfidence: action.confidence,
              approvedManually: true,
              bulkApproval: true,
            },
          });
        }
      }

      return {
        success: true,
        processed: actions.length,
        status: newStatus,
      };
    }),

  // ============ UNDO ============

  /**
   * Undo a recent action
   */
  undoAction: protectedProcedure
    .input(z.object({ actionId: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const action = await db.query.autopilotActions.findFirst({
        where: and(
          eq(autopilotActions.id, input.actionId),
          eq(autopilotActions.userId, ctx.user.id)
        ),
      });

      if (!action) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Action not found",
        });
      }

      if (!action.reversible) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "This action cannot be undone",
        });
      }

      if (action.undoneAt) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "This action has already been undone",
        });
      }

      if (action.undoDeadline && new Date() > action.undoDeadline) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Undo deadline has passed",
        });
      }

      // Execute undo via channel adapter
      const undoResult = await executeUndoAction(ctx.user.id, {
        id: action.id,
        actionType: action.actionType,
        itemId: action.itemId,
        beforeState: action.beforeState,
        afterState: action.afterState,
      });

      if (!undoResult.success) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: undoResult.error ?? "Failed to undo action",
        });
      }

      // Mark as undone
      await db
        .update(autopilotActions)
        .set({
          status: "undone",
          undoneAt: new Date(),
        })
        .where(eq(autopilotActions.id, input.actionId));

      // Log the undo to audit
      await auditService.log({
        userId: ctx.user.id,
        actionType: "UNDO_ACTION",
        actionId: action.id,
        itemId: action.itemId ?? undefined,
        source: "USER",
        beforeState: action.afterState ?? undefined,
        afterState: action.beforeState ?? undefined,
        metadata: {
          originalActionType: action.actionType,
          requiresManualAction: undoResult.requiresManualAction,
          manualInstructions: undoResult.manualInstructions,
        },
      });

      return {
        success: true,
        undone: true,
        requiresManualAction: undoResult.requiresManualAction,
        manualInstructions: undoResult.manualInstructions,
      };
    }),

  /**
   * Get undoable actions
   */
  getUndoableActions: protectedProcedure.query(async ({ ctx }) => {
    const now = new Date();

    const actions = await db.query.autopilotActions.findMany({
      where: and(
        eq(autopilotActions.userId, ctx.user.id),
        eq(autopilotActions.reversible, true),
        eq(autopilotActions.status, "executed")
      ),
      orderBy: [desc(autopilotActions.executedAt)],
      limit: 50,
      with: {
        item: {
          columns: {
            id: true,
            title: true,
          },
        },
      },
    });

    // Filter by undo deadline
    return actions.filter(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (action: any) => !action.undoDeadline || action.undoDeadline > now
    );
  }),

  // ============ RATE LIMITS ============

  /**
   * Get rate limit status
   */
  getRateLimitStatus: protectedProcedure.query(async ({ ctx }) => {
    // Get actual rate limit usage from database
    return getRateLimitUsage(ctx.user.id);
  }),

  // ============ RECENT ACTIONS ============

  /**
   * Get recent autopilot actions (for activity feed)
   */
  getRecentActions: protectedProcedure
    .input(
      z
        .object({
          limit: z.number().min(1).max(100).default(20),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      const limit = input?.limit ?? 20;

      const actions = await db.query.autopilotActions.findMany({
        where: eq(autopilotActions.userId, ctx.user.id),
        orderBy: [desc(autopilotActions.createdAt)],
        limit,
        with: {
          item: {
            columns: {
              id: true,
              title: true,
              askingPrice: true,
            },
          },
        },
      });

      return actions;
    }),
});
