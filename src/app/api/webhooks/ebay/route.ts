/**
 * eBay Platform Notifications Webhook Handler
 *
 * Receives real-time notifications from eBay for:
 * - Order creation/updates (MARKETPLACE_ACCOUNT_DELETION, ORDER_*)
 * - Item sold notifications
 *
 * https://developer.ebay.com/api-docs/sell/notification/overview.html
 */
import { NextRequest, NextResponse } from "next/server";
import { inngest } from "@/server/inngest/client";

/**
 * eBay notification payload structure
 */
interface EbayNotification {
  metadata: {
    topic: string;
    schemaVersion: string;
    deprecated: boolean;
  };
  notification: {
    notificationId: string;
    eventDate: string;
    publishDate: string;
    publishAttemptCount: number;
    data: Record<string, unknown>;
  };
}

/**
 * Supported notification topics
 */
const SUPPORTED_TOPICS = [
  "MARKETPLACE.ORDER.CREATED",
  "MARKETPLACE.ORDER.PAYMENT_COMPLETE",
  "MARKETPLACE.ORDER.SHIPPED",
  "MARKETPLACE.ITEM.SOLD",
];

/**
 * POST /api/webhooks/ebay
 *
 * Handles incoming eBay platform notifications
 */
export async function POST(request: NextRequest) {
  try {
    // eBay sends a challenge for endpoint verification
    const challengeCode = request.nextUrl.searchParams.get("challenge_code");
    if (challengeCode) {
      // Verification handshake - return the challenge code
      // https://developer.ebay.com/api-docs/sell/notification/resources/destination/methods/getDestination
      const verificationToken = process.env.EBAY_VERIFICATION_TOKEN || "";
      const endpoint = process.env.EBAY_WEBHOOK_ENDPOINT || request.url;

      // Create hash for verification response
      const crypto = await import("crypto");
      const hash = crypto
        .createHash("sha256")
        .update(challengeCode + verificationToken + endpoint)
        .digest("hex");

      return NextResponse.json({ challengeResponse: hash });
    }

    // Parse the notification payload
    const payload: EbayNotification = await request.json();

    // Validate required fields
    if (!payload.metadata?.topic || !payload.notification?.notificationId) {
      return NextResponse.json(
        { error: "Invalid notification payload" },
        { status: 400 }
      );
    }

    const { topic } = payload.metadata;
    const { notificationId, data } = payload.notification;

    console.log(`[eBay Webhook] Received: ${topic} (${notificationId})`);

    // Check if we handle this topic
    if (!SUPPORTED_TOPICS.includes(topic)) {
      console.log(`[eBay Webhook] Ignoring unsupported topic: ${topic}`);
      return NextResponse.json({ status: "ignored", topic });
    }

    // Route to appropriate Inngest event
    switch (topic) {
      case "MARKETPLACE.ORDER.CREATED":
      case "MARKETPLACE.ORDER.PAYMENT_COMPLETE":
        await inngest.send({
          name: "ebay/order.received",
          data: {
            notificationId,
            topic,
            orderId: (data as { orderId?: string }).orderId,
            payload: data,
          },
        });
        break;

      case "MARKETPLACE.ITEM.SOLD":
        await inngest.send({
          name: "ebay/item.sold",
          data: {
            notificationId,
            topic,
            itemId: (data as { itemId?: string }).itemId,
            payload: data,
          },
        });
        break;

      case "MARKETPLACE.ORDER.SHIPPED":
        await inngest.send({
          name: "ebay/order.shipped",
          data: {
            notificationId,
            topic,
            orderId: (data as { orderId?: string }).orderId,
            payload: data,
          },
        });
        break;
    }

    return NextResponse.json({
      status: "processed",
      notificationId,
      topic,
    });
  } catch (error) {
    console.error("[eBay Webhook] Error processing notification:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/webhooks/ebay
 *
 * eBay may send GET requests to verify the endpoint
 */
export async function GET(request: NextRequest) {
  const challengeCode = request.nextUrl.searchParams.get("challenge_code");

  if (challengeCode) {
    const verificationToken = process.env.EBAY_VERIFICATION_TOKEN || "";
    const endpoint = process.env.EBAY_WEBHOOK_ENDPOINT || request.url;

    const crypto = await import("crypto");
    const hash = crypto
      .createHash("sha256")
      .update(challengeCode + verificationToken + endpoint)
      .digest("hex");

    return NextResponse.json({ challengeResponse: hash });
  }

  return NextResponse.json({ status: "ok", endpoint: "ebay-webhook" });
}
