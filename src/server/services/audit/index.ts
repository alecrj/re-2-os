/**
 * Audit Service
 *
 * Provides comprehensive audit logging for all actions in ResellerOS.
 * Tracks user actions, autopilot decisions, system events, and webhook callbacks.
 */

import { db } from "@/server/db/client";
import { auditLog } from "@/server/db/schema";
import { eq, and, desc, isNull, gt } from "drizzle-orm";

// ============ TYPES ============

export type AuditSource = "AUTOPILOT" | "USER" | "SYSTEM" | "WEBHOOK";

export type AuditActionType =
  | "ITEM_CREATE"
  | "ITEM_UPDATE"
  | "ITEM_DELETE"
  | "ITEM_ARCHIVE"
  | "PRICE_CHANGE"
  | "LISTING_PUBLISH"
  | "LISTING_DELIST"
  | "LISTING_RELIST"
  | "OFFER_ACCEPT"
  | "OFFER_DECLINE"
  | "OFFER_COUNTER"
  | "ORDER_CREATE"
  | "ORDER_SHIP"
  | "RULE_CREATE"
  | "RULE_UPDATE"
  | "RULE_DELETE"
  | "CHANNEL_CONNECT"
  | "CHANNEL_DISCONNECT"
  | "UNDO_ACTION";

export interface AuditEntry {
  userId: string;
  actionType: AuditActionType | string;
  actionId?: string;
  itemId?: string;
  channel?: string;
  source: AuditSource;
  beforeState?: Record<string, unknown>;
  afterState?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  reversible?: boolean;
  undoDeadline?: Date;
}

export interface AuditLogEntry {
  id: string;
  userId: string;
  actionType: string;
  actionId: string | null;
  itemId: string | null;
  channel: string | null;
  source: AuditSource;
  beforeState: Record<string, unknown> | null;
  afterState: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
  reversible: boolean;
  undoDeadline: Date | null;
  reversedAt: Date | null;
  reversedByAuditId: string | null;
  timestamp: Date;
}

export interface ListAuditOptions {
  limit?: number;
  offset?: number;
  actionType?: string;
  source?: AuditSource;
  itemId?: string;
}

// ============ UNDO DEADLINES ============

/**
 * Undo deadlines by action type (in hours)
 * - Price changes: 24 hours
 * - Delist: 30 days (720 hours)
 * - Archive: Unlimited (no deadline, until purged)
 * - Offer accept/decline: Not reversible
 */
export const UNDO_DEADLINES: Record<string, number | null> = {
  PRICE_CHANGE: 24,
  LISTING_DELIST: 720, // 30 days
  ITEM_ARCHIVE: null, // Unlimited
  LISTING_RELIST: 24,
  // Not reversible actions
  OFFER_ACCEPT: 0, // Not reversible
  OFFER_DECLINE: 0, // Not reversible
  ORDER_CREATE: 0, // Not reversible
  ORDER_SHIP: 0, // Not reversible
  ITEM_DELETE: 0, // Not reversible (hard delete)
};

/**
 * Determine if an action type is reversible
 */
export function isActionReversible(actionType: string): boolean {
  const deadline = UNDO_DEADLINES[actionType];
  // If deadline is 0 or not defined, action is not reversible
  // If deadline is null (unlimited) or positive number, action is reversible
  return deadline === null || (deadline !== undefined && deadline > 0);
}

/**
 * Calculate undo deadline for an action type
 */
export function calculateUndoDeadline(actionType: string): Date | undefined {
  const hours = UNDO_DEADLINES[actionType];

  // Not reversible
  if (hours === undefined || hours === 0) {
    return undefined;
  }

  // Unlimited (no deadline)
  if (hours === null) {
    // Set to a far future date (100 years from now)
    const deadline = new Date();
    deadline.setFullYear(deadline.getFullYear() + 100);
    return deadline;
  }

  // Calculate deadline
  const deadline = new Date();
  deadline.setHours(deadline.getHours() + hours);
  return deadline;
}

// ============ AUDIT SERVICE ============

export const auditService = {
  /**
   * Log an audit entry
   */
  async log(entry: AuditEntry): Promise<string> {
    const id = crypto.randomUUID();
    const now = new Date();

    // Determine if action is reversible
    const reversible = entry.reversible ?? isActionReversible(entry.actionType);

    // Calculate undo deadline if reversible
    const undoDeadline = reversible
      ? entry.undoDeadline ?? calculateUndoDeadline(entry.actionType)
      : undefined;

    await db.insert(auditLog).values({
      id,
      userId: entry.userId,
      actionType: entry.actionType,
      actionId: entry.actionId ?? null,
      itemId: entry.itemId ?? null,
      channel: entry.channel ?? null,
      source: entry.source,
      beforeState: entry.beforeState ?? null,
      afterState: entry.afterState ?? null,
      metadata: entry.metadata ?? null,
      reversible,
      undoDeadline: undoDeadline ?? null,
      reversedAt: null,
      reversedByAuditId: null,
      timestamp: now,
    });

    return id;
  },

  /**
   * Get audit log entries for a user
   */
  async getByUser(
    userId: string,
    options: ListAuditOptions = {}
  ): Promise<AuditLogEntry[]> {
    const { limit = 50, offset = 0, actionType, source, itemId } = options;

    // Build conditions
    const conditions = [eq(auditLog.userId, userId)];

    if (actionType) {
      conditions.push(eq(auditLog.actionType, actionType));
    }

    if (source) {
      conditions.push(eq(auditLog.source, source));
    }

    if (itemId) {
      conditions.push(eq(auditLog.itemId, itemId));
    }

    const results = await db
      .select()
      .from(auditLog)
      .where(and(...conditions))
      .orderBy(desc(auditLog.timestamp))
      .limit(limit)
      .offset(offset);

    return results.map((row) => ({
      id: row.id,
      userId: row.userId,
      actionType: row.actionType,
      actionId: row.actionId,
      itemId: row.itemId,
      channel: row.channel,
      source: row.source as AuditSource,
      beforeState: row.beforeState,
      afterState: row.afterState,
      metadata: row.metadata,
      reversible: row.reversible,
      undoDeadline: row.undoDeadline,
      reversedAt: row.reversedAt,
      reversedByAuditId: row.reversedByAuditId,
      timestamp: row.timestamp,
    }));
  },

  /**
   * Get a single audit entry by ID
   */
  async getById(auditId: string): Promise<AuditLogEntry | null> {
    const result = await db
      .select()
      .from(auditLog)
      .where(eq(auditLog.id, auditId))
      .limit(1);

    if (result.length === 0) {
      return null;
    }

    const row = result[0];
    return {
      id: row.id,
      userId: row.userId,
      actionType: row.actionType,
      actionId: row.actionId,
      itemId: row.itemId,
      channel: row.channel,
      source: row.source as AuditSource,
      beforeState: row.beforeState,
      afterState: row.afterState,
      metadata: row.metadata,
      reversible: row.reversible,
      undoDeadline: row.undoDeadline,
      reversedAt: row.reversedAt,
      reversedByAuditId: row.reversedByAuditId,
      timestamp: row.timestamp,
    };
  },

  /**
   * Get actions that can still be undone
   */
  async getReversibleActions(userId: string): Promise<AuditLogEntry[]> {
    const now = new Date();

    const results = await db
      .select()
      .from(auditLog)
      .where(
        and(
          eq(auditLog.userId, userId),
          eq(auditLog.reversible, true),
          isNull(auditLog.reversedAt),
          gt(auditLog.undoDeadline, now)
        )
      )
      .orderBy(desc(auditLog.timestamp))
      .limit(100);

    return results.map((row) => ({
      id: row.id,
      userId: row.userId,
      actionType: row.actionType,
      actionId: row.actionId,
      itemId: row.itemId,
      channel: row.channel,
      source: row.source as AuditSource,
      beforeState: row.beforeState,
      afterState: row.afterState,
      metadata: row.metadata,
      reversible: row.reversible,
      undoDeadline: row.undoDeadline,
      reversedAt: row.reversedAt,
      reversedByAuditId: row.reversedByAuditId,
      timestamp: row.timestamp,
    }));
  },

  /**
   * Mark an action as reversed
   */
  async markReversed(auditId: string, reversedByAuditId: string): Promise<void> {
    await db
      .update(auditLog)
      .set({
        reversedAt: new Date(),
        reversedByAuditId,
      })
      .where(eq(auditLog.id, auditId));
  },

  /**
   * Get count of audit entries for a user
   */
  async getCount(userId: string, options: Omit<ListAuditOptions, "limit" | "offset"> = {}): Promise<number> {
    const { actionType, source, itemId } = options;

    const conditions = [eq(auditLog.userId, userId)];

    if (actionType) {
      conditions.push(eq(auditLog.actionType, actionType));
    }

    if (source) {
      conditions.push(eq(auditLog.source, source));
    }

    if (itemId) {
      conditions.push(eq(auditLog.itemId, itemId));
    }

    const result = await db
      .select({ id: auditLog.id })
      .from(auditLog)
      .where(and(...conditions));

    return result.length;
  },
};

export default auditService;
