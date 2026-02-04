/**
 * Audit tRPC Router
 *
 * Provides API endpoints for viewing audit logs and undoing actions.
 */

import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "../init";
import { auditService, type AuditSource, UNDO_DEADLINES } from "@/server/services/audit";
import { undoService } from "@/server/services/audit/undo";
import { TRPCError } from "@trpc/server";

// ============ INPUT SCHEMAS ============

const listInputSchema = z.object({
  limit: z.number().min(1).max(100).default(50),
  offset: z.number().min(0).default(0),
  actionType: z.string().optional(),
  source: z.enum(["AUTOPILOT", "USER", "SYSTEM", "WEBHOOK"]).optional(),
  itemId: z.string().optional(),
});

const getByIdInputSchema = z.object({
  id: z.string(),
});

const undoInputSchema = z.object({
  auditId: z.string(),
});

// ============ ROUTER ============

export const auditRouter = createTRPCRouter({
  /**
   * List audit log entries with filtering and pagination
   */
  list: protectedProcedure
    .input(listInputSchema)
    .query(async ({ input, ctx }) => {
      const userId = ctx.user.id;

      const [entries, totalCount] = await Promise.all([
        auditService.getByUser(userId, {
          limit: input.limit,
          offset: input.offset,
          actionType: input.actionType,
          source: input.source as AuditSource | undefined,
          itemId: input.itemId,
        }),
        auditService.getCount(userId, {
          actionType: input.actionType,
          source: input.source as AuditSource | undefined,
          itemId: input.itemId,
        }),
      ]);

      return {
        entries: entries.map((entry) => ({
          id: entry.id,
          actionType: entry.actionType,
          actionId: entry.actionId,
          itemId: entry.itemId,
          channel: entry.channel,
          source: entry.source,
          beforeState: entry.beforeState,
          afterState: entry.afterState,
          metadata: entry.metadata,
          reversible: entry.reversible,
          undoDeadline: entry.undoDeadline?.toISOString() ?? null,
          reversedAt: entry.reversedAt?.toISOString() ?? null,
          timestamp: entry.timestamp.toISOString(),
          canUndo: entry.reversible &&
            !entry.reversedAt &&
            entry.undoDeadline !== null &&
            new Date() < entry.undoDeadline,
          timeRemaining: undoService.getTimeRemaining(entry),
        })),
        totalCount,
        hasMore: input.offset + entries.length < totalCount,
      };
    }),

  /**
   * Get a single audit entry by ID
   */
  getById: protectedProcedure
    .input(getByIdInputSchema)
    .query(async ({ input, ctx }) => {
      const entry = await auditService.getById(input.id);

      if (!entry) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Audit entry not found",
        });
      }

      // Verify ownership
      if (entry.userId !== ctx.user.id) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You do not have access to this audit entry",
        });
      }

      return {
        id: entry.id,
        actionType: entry.actionType,
        actionId: entry.actionId,
        itemId: entry.itemId,
        channel: entry.channel,
        source: entry.source,
        beforeState: entry.beforeState,
        afterState: entry.afterState,
        metadata: entry.metadata,
        reversible: entry.reversible,
        undoDeadline: entry.undoDeadline?.toISOString() ?? null,
        reversedAt: entry.reversedAt?.toISOString() ?? null,
        reversedByAuditId: entry.reversedByAuditId,
        timestamp: entry.timestamp.toISOString(),
        canUndo: entry.reversible &&
          !entry.reversedAt &&
          entry.undoDeadline !== null &&
          new Date() < entry.undoDeadline,
        timeRemaining: undoService.getTimeRemaining(entry),
      };
    }),

  /**
   * Get actions that can still be undone
   */
  getUndoable: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.user.id;
    const entries = await auditService.getReversibleActions(userId);

    return entries.map((entry) => ({
      id: entry.id,
      actionType: entry.actionType,
      actionId: entry.actionId,
      itemId: entry.itemId,
      channel: entry.channel,
      source: entry.source,
      beforeState: entry.beforeState,
      afterState: entry.afterState,
      timestamp: entry.timestamp.toISOString(),
      undoDeadline: entry.undoDeadline?.toISOString() ?? null,
      timeRemaining: undoService.getTimeRemaining(entry),
    }));
  }),

  /**
   * Undo an action
   */
  undo: protectedProcedure
    .input(undoInputSchema)
    .mutation(async ({ input, ctx }) => {
      const userId = ctx.user.id;

      // First check if we can undo
      const checkResult = await undoService.canUndo(input.auditId);

      if (!checkResult.canUndo) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: checkResult.reason ?? "Cannot undo this action",
        });
      }

      // Verify ownership
      if (checkResult.entry && checkResult.entry.userId !== userId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You do not have permission to undo this action",
        });
      }

      // Perform the undo
      const result = await undoService.undo(input.auditId, userId);

      if (!result.success) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: result.error ?? "Failed to undo action",
        });
      }

      return {
        success: true,
        undoAuditId: result.undoAuditId,
      };
    }),

  /**
   * Check if an action can be undone
   */
  canUndo: protectedProcedure
    .input(undoInputSchema)
    .query(async ({ input, ctx }) => {
      const checkResult = await undoService.canUndo(input.auditId);

      // Verify ownership if entry exists
      if (checkResult.entry && checkResult.entry.userId !== ctx.user.id) {
        return {
          canUndo: false,
          reason: "You do not have permission to undo this action",
        };
      }

      return {
        canUndo: checkResult.canUndo,
        reason: checkResult.reason,
        timeRemaining: checkResult.entry
          ? undoService.getTimeRemaining(checkResult.entry)
          : null,
      };
    }),

  /**
   * Get undo deadlines configuration
   */
  getUndoDeadlines: protectedProcedure.query(() => {
    return Object.entries(UNDO_DEADLINES).map(([actionType, hours]) => ({
      actionType,
      hours,
      reversible: hours === null || (hours !== undefined && hours > 0),
      description: getActionDescription(actionType),
    }));
  }),

  /**
   * Get audit statistics for the user
   */
  getStats: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.user.id;

    const [totalActions, undoableCount, autopilotCount, userCount] = await Promise.all([
      auditService.getCount(userId),
      auditService.getReversibleActions(userId).then((entries) => entries.length),
      auditService.getCount(userId, { source: "AUTOPILOT" }),
      auditService.getCount(userId, { source: "USER" }),
    ]);

    return {
      totalActions,
      undoableCount,
      autopilotCount,
      userCount,
      systemCount: totalActions - autopilotCount - userCount,
    };
  }),
});

/**
 * Get human-readable description for an action type
 */
function getActionDescription(actionType: string): string {
  const descriptions: Record<string, string> = {
    ITEM_CREATE: "Created a new inventory item",
    ITEM_UPDATE: "Updated an inventory item",
    ITEM_DELETE: "Deleted an inventory item",
    ITEM_ARCHIVE: "Archived an inventory item",
    PRICE_CHANGE: "Changed the price of an item",
    LISTING_PUBLISH: "Published a listing to a channel",
    LISTING_DELIST: "Removed a listing from a channel",
    LISTING_RELIST: "Relisted an item on a channel",
    OFFER_ACCEPT: "Accepted an offer",
    OFFER_DECLINE: "Declined an offer",
    OFFER_COUNTER: "Countered an offer",
    ORDER_CREATE: "Created a new order",
    ORDER_SHIP: "Marked an order as shipped",
    RULE_CREATE: "Created an autopilot rule",
    RULE_UPDATE: "Updated an autopilot rule",
    RULE_DELETE: "Deleted an autopilot rule",
    CHANNEL_CONNECT: "Connected a marketplace channel",
    CHANNEL_DISCONNECT: "Disconnected a marketplace channel",
    UNDO_ACTION: "Undid a previous action",
  };

  return descriptions[actionType] ?? actionType;
}

export default auditRouter;
