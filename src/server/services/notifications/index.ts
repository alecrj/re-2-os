/**
 * Notification Service for ResellerOS
 *
 * Handles user notifications for critical events that require attention.
 * Currently logs to console; will be extended with email, push, and in-app
 * notifications in the future.
 */

import { db } from "@/server/db/client";
import { auditLog } from "@/server/db/schema";

// ============ TYPES ============

export type NotificationType =
  | "MANUAL_DELIST_REQUIRED"
  | "DELIST_FAILED"
  | "DELIST_SUCCESS"
  | "ACTION_REQUIRED"
  | "OFFER_RECEIVED"
  | "SALE_CONFIRMED"
  | "SYNC_ERROR";

export type NotificationPriority = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";

export interface Notification {
  type: NotificationType;
  channel?: string;
  itemId?: string;
  itemTitle?: string;
  message?: string;
  priority?: NotificationPriority;
  metadata?: Record<string, unknown>;
}

export interface NotificationResult {
  success: boolean;
  notificationId?: string;
  deliveryMethods: string[];
}

// ============ NOTIFICATION SERVICE ============

/**
 * Send a notification to a user
 *
 * @param userId - The user ID to notify
 * @param notification - The notification details
 * @returns Result of the notification delivery
 */
export async function notifyUser(
  userId: string,
  notification: Notification
): Promise<NotificationResult> {
  const priority = notification.priority ?? "MEDIUM";
  const deliveryMethods: string[] = [];

  // Format the notification message
  const formattedMessage = formatNotificationMessage(notification);

  // Log to console (always)
  console.log(
    `[NOTIFICATION] [${priority}] User ${userId}: ${formattedMessage}`
  );
  deliveryMethods.push("console");

  // Log to audit for tracking
  try {
    await logNotificationToAudit(userId, notification, formattedMessage);
    deliveryMethods.push("audit_log");
  } catch (error) {
    console.error("[NOTIFICATION] Failed to log to audit:", error);
  }

  // TODO: Future delivery methods
  // - Email: For CRITICAL and HIGH priority
  // - Push: For real-time alerts
  // - In-app: For persistent notifications in the dashboard

  // For CRITICAL notifications, we would trigger additional alerts
  if (priority === "CRITICAL") {
    console.error(
      `[CRITICAL NOTIFICATION] User ${userId}: ${formattedMessage}`
    );
    // TODO: Send immediate email, SMS, or push notification
  }

  return {
    success: true,
    deliveryMethods,
  };
}

/**
 * Send bulk notifications to a user
 */
export async function notifyUserBulk(
  userId: string,
  notifications: Notification[]
): Promise<NotificationResult[]> {
  return Promise.all(
    notifications.map((notification) => notifyUser(userId, notification))
  );
}

// ============ HELPER FUNCTIONS ============

/**
 * Format a notification into a human-readable message
 */
function formatNotificationMessage(notification: Notification): string {
  switch (notification.type) {
    case "MANUAL_DELIST_REQUIRED":
      return `Please manually delist "${notification.itemTitle ?? "item"}" from ${notification.channel ?? "the marketplace"}. The item has sold on another channel.`;

    case "DELIST_FAILED":
      return `Failed to automatically delist "${notification.itemTitle ?? "item"}" from ${notification.channel ?? "the marketplace"}. ${notification.message ?? "Please delist manually to prevent overselling."}`;

    case "DELIST_SUCCESS":
      return `Successfully delisted "${notification.itemTitle ?? "item"}" from ${notification.channel ?? "the marketplace"} after sale on another channel.`;

    case "ACTION_REQUIRED":
      return notification.message ?? "Action required. Please check your dashboard.";

    case "OFFER_RECEIVED":
      return `New offer received on "${notification.itemTitle ?? "item"}" via ${notification.channel ?? "marketplace"}.`;

    case "SALE_CONFIRMED":
      return `Sale confirmed for "${notification.itemTitle ?? "item"}" on ${notification.channel ?? "marketplace"}.`;

    case "SYNC_ERROR":
      return `Sync error with ${notification.channel ?? "marketplace"}: ${notification.message ?? "Please reconnect your account."}`;

    default:
      return notification.message ?? `Notification: ${notification.type}`;
  }
}

/**
 * Log notification to audit log for tracking
 */
async function logNotificationToAudit(
  userId: string,
  notification: Notification,
  formattedMessage: string
): Promise<void> {
  const id = crypto.randomUUID();
  const now = new Date();

  await db.insert(auditLog).values({
    id,
    userId,
    actionType: `NOTIFICATION_${notification.type}`,
    itemId: notification.itemId ?? null,
    channel: notification.channel ?? null,
    source: "SYSTEM",
    beforeState: null,
    afterState: {
      notificationType: notification.type,
      priority: notification.priority ?? "MEDIUM",
      message: formattedMessage,
    },
    metadata: notification.metadata ?? null,
    reversible: false,
    undoDeadline: null,
    reversedAt: null,
    reversedByAuditId: null,
    timestamp: now,
  });
}

const notificationService = { notifyUser, notifyUserBulk };

export default notificationService;
