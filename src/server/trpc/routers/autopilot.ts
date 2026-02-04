import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "../init";
import { db } from "@/server/db/client";
import {
  autopilotRules,
  autopilotActions,
  type OfferRuleConfig,
  type RepriceRuleConfig,
} from "@/server/db/schema";
import { eq, and, desc, inArray } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { auditService } from "@/server/services/audit";
import {
  validateOfferRuleConfig,
  DEFAULT_OFFER_RULE_CONFIG,
} from "@/server/services/autopilot";

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
        // Execute the action
        // TODO: Call channel adapter to execute the actual action

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
          },
        });

        return { success: true, status: "executed" as const };
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

      // Mark as undone
      await db
        .update(autopilotActions)
        .set({
          status: "undone",
          undoneAt: new Date(),
        })
        .where(eq(autopilotActions.id, input.actionId));

      // TODO: Execute undo via channel adapter

      return { success: true, undone: true };
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
      (action) => !action.undoDeadline || action.undoDeadline > now
    );
  }),

  // ============ RATE LIMITS ============

  /**
   * Get rate limit status
   */
  getRateLimitStatus: protectedProcedure.query(async ({ ctx: _ctx }) => {
    // TODO: Implement actual rate limit tracking
    // For now, return defaults
    return {
      ebayRevisions: { daily: 200, used: 0, remaining: 200 },
      reprices: { daily: 100, used: 0, remaining: 100 },
      autoAccepts: { daily: 50, used: 0, remaining: 50 },
    };
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
