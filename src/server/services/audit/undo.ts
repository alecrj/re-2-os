/**
 * Undo Service
 *
 * Handles reversal of actions that support undo functionality.
 * Works in conjunction with the audit service to track and reverse changes.
 */

import { db } from "@/server/db/client";
import { inventoryItems, channelListings } from "@/server/db/schema";
import { eq, and } from "drizzle-orm";
import { auditService, type AuditLogEntry, UNDO_DEADLINES } from "./index";

// ============ TYPES ============

export interface UndoCheckResult {
  canUndo: boolean;
  reason?: string;
  entry?: AuditLogEntry;
}

export interface UndoResult {
  success: boolean;
  error?: string;
  undoAuditId?: string;
}

// ============ UNDO SERVICE ============

export const undoService = {
  /**
   * Check if an action can be undone
   */
  async canUndo(auditId: string): Promise<UndoCheckResult> {
    // Get the audit entry
    const entry = await auditService.getById(auditId);

    if (!entry) {
      return {
        canUndo: false,
        reason: "Audit entry not found",
      };
    }

    // Check if the action type is reversible
    const deadline = UNDO_DEADLINES[entry.actionType];
    if (deadline === 0 || (deadline === undefined && !entry.reversible)) {
      return {
        canUndo: false,
        reason: `${entry.actionType} actions cannot be undone`,
        entry,
      };
    }

    // Check if already reversed
    if (entry.reversedAt) {
      return {
        canUndo: false,
        reason: "This action has already been undone",
        entry,
      };
    }

    // Check if within deadline
    if (entry.undoDeadline && new Date() > entry.undoDeadline) {
      return {
        canUndo: false,
        reason: "The undo window for this action has expired",
        entry,
      };
    }

    // Check if there's a before state to restore
    if (!entry.beforeState) {
      return {
        canUndo: false,
        reason: "No previous state available to restore",
        entry,
      };
    }

    return {
      canUndo: true,
      entry,
    };
  },

  /**
   * Undo an action
   */
  async undo(auditId: string, userId: string): Promise<UndoResult> {
    // First check if we can undo
    const checkResult = await this.canUndo(auditId);

    if (!checkResult.canUndo) {
      return {
        success: false,
        error: checkResult.reason,
      };
    }

    const entry = checkResult.entry!;

    // Verify ownership
    if (entry.userId !== userId) {
      return {
        success: false,
        error: "You do not have permission to undo this action",
      };
    }

    try {
      // Perform the undo based on action type
      const undoResult = await this.performUndo(entry);

      if (!undoResult.success) {
        return undoResult;
      }

      // Log the undo as a new audit entry
      const undoAuditId = await auditService.log({
        userId,
        actionType: "UNDO_ACTION",
        actionId: entry.actionId ?? undefined,
        itemId: entry.itemId ?? undefined,
        channel: entry.channel ?? undefined,
        source: "USER",
        beforeState: entry.afterState ?? undefined,
        afterState: entry.beforeState ?? undefined,
        metadata: {
          originalAuditId: auditId,
          originalActionType: entry.actionType,
        },
        reversible: false,
      });

      // Mark the original action as reversed
      await auditService.markReversed(auditId, undoAuditId);

      return {
        success: true,
        undoAuditId,
      };
    } catch (error) {
      console.error("Error performing undo:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to undo action",
      };
    }
  },

  /**
   * Perform the actual undo operation based on action type
   */
  async performUndo(entry: AuditLogEntry): Promise<UndoResult> {
    const beforeState = entry.beforeState;

    if (!beforeState) {
      return {
        success: false,
        error: "No previous state to restore",
      };
    }

    switch (entry.actionType) {
      case "PRICE_CHANGE":
        return this.undoPriceChange(entry);

      case "LISTING_DELIST":
        return this.undoDelist(entry);

      case "ITEM_ARCHIVE":
        return this.undoArchive(entry);

      case "LISTING_RELIST":
        return this.undoRelist(entry);

      case "ITEM_UPDATE":
        return this.undoItemUpdate(entry);

      default:
        return {
          success: false,
          error: `Undo not implemented for action type: ${entry.actionType}`,
        };
    }
  },

  /**
   * Undo a price change
   */
  async undoPriceChange(entry: AuditLogEntry): Promise<UndoResult> {
    const beforeState = entry.beforeState;
    const itemId = entry.itemId;

    if (!itemId || !beforeState) {
      return {
        success: false,
        error: "Missing item ID or previous state",
      };
    }

    const previousPrice = beforeState.askingPrice as number | undefined;
    const previousFloorPrice = beforeState.floorPrice as number | undefined;

    if (previousPrice === undefined) {
      return {
        success: false,
        error: "Previous price not found in state",
      };
    }

    // Update the inventory item price
    await db
      .update(inventoryItems)
      .set({
        askingPrice: previousPrice,
        floorPrice: previousFloorPrice ?? null,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(inventoryItems.id, itemId),
          eq(inventoryItems.userId, entry.userId)
        )
      );

    // Also update any active channel listings
    if (entry.channel) {
      const channel = entry.channel as "ebay" | "poshmark" | "mercari" | "depop";
      await db
        .update(channelListings)
        .set({ price: previousPrice })
        .where(
          and(
            eq(channelListings.itemId, itemId),
            eq(channelListings.channel, channel)
          )
        );
    }

    return { success: true };
  },

  /**
   * Undo a delist action (relist the item)
   */
  async undoDelist(entry: AuditLogEntry): Promise<UndoResult> {
    const beforeState = entry.beforeState;
    const itemId = entry.itemId;

    if (!itemId || !beforeState) {
      return {
        success: false,
        error: "Missing item ID or previous state",
      };
    }

    const previousStatus = beforeState.status as string | undefined;

    if (!previousStatus || previousStatus === "sold") {
      return {
        success: false,
        error: "Cannot relist: item was sold or previous status unknown",
      };
    }

    // Restore the inventory item status
    await db
      .update(inventoryItems)
      .set({
        status: previousStatus as "draft" | "active" | "sold" | "shipped" | "archived",
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(inventoryItems.id, itemId),
          eq(inventoryItems.userId, entry.userId)
        )
      );

    // Restore channel listing if applicable
    if (entry.channel && beforeState.listingStatus) {
      const channel = entry.channel as "ebay" | "poshmark" | "mercari" | "depop";
      await db
        .update(channelListings)
        .set({
          status: beforeState.listingStatus as "draft" | "pending" | "active" | "ended" | "sold" | "error",
        })
        .where(
          and(
            eq(channelListings.itemId, itemId),
            eq(channelListings.channel, channel)
          )
        );
    }

    return { success: true };
  },

  /**
   * Undo an archive action
   */
  async undoArchive(entry: AuditLogEntry): Promise<UndoResult> {
    const beforeState = entry.beforeState;
    const itemId = entry.itemId;

    if (!itemId || !beforeState) {
      return {
        success: false,
        error: "Missing item ID or previous state",
      };
    }

    const previousStatus = beforeState.status as string | undefined;

    if (!previousStatus) {
      return {
        success: false,
        error: "Previous status unknown",
      };
    }

    // Restore the inventory item status
    await db
      .update(inventoryItems)
      .set({
        status: previousStatus as "draft" | "active" | "sold" | "shipped" | "archived",
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(inventoryItems.id, itemId),
          eq(inventoryItems.userId, entry.userId)
        )
      );

    return { success: true };
  },

  /**
   * Undo a relist action (delist the item again)
   */
  async undoRelist(entry: AuditLogEntry): Promise<UndoResult> {
    const beforeState = entry.beforeState;
    const itemId = entry.itemId;

    if (!itemId || !beforeState) {
      return {
        success: false,
        error: "Missing item ID or previous state",
      };
    }

    const previousStatus = beforeState.status as string | undefined;

    // Restore to the previous status (likely "ended" or "archived")
    await db
      .update(inventoryItems)
      .set({
        status: (previousStatus as "draft" | "active" | "sold" | "shipped" | "archived") ?? "draft",
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(inventoryItems.id, itemId),
          eq(inventoryItems.userId, entry.userId)
        )
      );

    // Update channel listing status
    if (entry.channel) {
      const channel = entry.channel as "ebay" | "poshmark" | "mercari" | "depop";
      await db
        .update(channelListings)
        .set({
          status: "ended",
          endedAt: new Date(),
        })
        .where(
          and(
            eq(channelListings.itemId, itemId),
            eq(channelListings.channel, channel)
          )
        );
    }

    return { success: true };
  },

  /**
   * Undo a general item update
   */
  async undoItemUpdate(entry: AuditLogEntry): Promise<UndoResult> {
    const beforeState = entry.beforeState;
    const itemId = entry.itemId;

    if (!itemId || !beforeState) {
      return {
        success: false,
        error: "Missing item ID or previous state",
      };
    }

    // Build update object from before state
    const updateData: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    // Only restore fields that were in the before state
    if ("title" in beforeState) updateData.title = beforeState.title;
    if ("description" in beforeState) updateData.description = beforeState.description;
    if ("condition" in beforeState) updateData.condition = beforeState.condition;
    if ("askingPrice" in beforeState) updateData.askingPrice = beforeState.askingPrice;
    if ("floorPrice" in beforeState) updateData.floorPrice = beforeState.floorPrice;
    if ("costBasis" in beforeState) updateData.costBasis = beforeState.costBasis;
    if ("quantity" in beforeState) updateData.quantity = beforeState.quantity;
    if ("status" in beforeState) updateData.status = beforeState.status;
    if ("itemSpecifics" in beforeState) updateData.itemSpecifics = beforeState.itemSpecifics;
    if ("suggestedCategory" in beforeState) updateData.suggestedCategory = beforeState.suggestedCategory;

    await db
      .update(inventoryItems)
      .set(updateData)
      .where(
        and(
          eq(inventoryItems.id, itemId),
          eq(inventoryItems.userId, entry.userId)
        )
      );

    return { success: true };
  },

  /**
   * Get the remaining time to undo an action
   */
  getTimeRemaining(entry: AuditLogEntry): { hours: number; minutes: number } | null {
    if (!entry.reversible || entry.reversedAt || !entry.undoDeadline) {
      return null;
    }

    const now = new Date();
    const deadline = new Date(entry.undoDeadline);

    if (now > deadline) {
      return null;
    }

    const diffMs = deadline.getTime() - now.getTime();
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

    return { hours, minutes };
  },
};

export default undoService;
