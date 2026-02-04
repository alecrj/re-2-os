/**
 * Handle Offer Function
 *
 * Processes incoming offers according to user's autopilot rules.
 * Supports auto-accept, auto-decline, and auto-counter strategies.
 *
 * Decision Flow:
 * 1. Load user's offer rules
 * 2. Evaluate offer using autopilot engine
 * 3. Based on confidence:
 *    - HIGH/MEDIUM: Execute immediately
 *    - LOW: Queue for approval
 *    - VERY_LOW: Log only, don't act
 * 4. Log to audit
 * 5. Create autopilotAction record
 */

import { inngest } from "../client";
import { db } from "@/server/db/client";
import { autopilotActions, inventoryItems } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import { evaluateOffer, type OfferContext } from "@/server/services/autopilot";
import { auditService } from "@/server/services/audit";

export const handleOffer = inngest.createFunction(
  {
    id: "handle-offer",
    name: "Process Offer with Autopilot Rules",
    retries: 2,
  },
  { event: "autopilot/offer-received" },
  async ({ event, step }) => {
    const {
      userId,
      offerId,
      itemId,
      channelListingId,
      channel,
      offerAmount,
      askingPrice,
      floorPrice,
      buyerUsername,
    } = event.data;

    // Step 1: Load item details for context
    const item = await step.run("load-item", async () => {
      const result = await db.query.inventoryItems.findFirst({
        where: eq(inventoryItems.id, itemId),
      });

      if (!result) {
        throw new Error(`Item not found: ${itemId}`);
      }

      // Calculate days listed
      const daysListed = result.listedAt
        ? Math.floor((Date.now() - result.listedAt.getTime()) / (1000 * 60 * 60 * 24))
        : 0;

      return {
        askingPrice: result.askingPrice,
        floorPrice: result.floorPrice,
        itemValue: result.askingPrice, // Use asking price as item value
        daysListed,
      };
    });

    // Step 2: Evaluate offer using autopilot engine
    const evaluation = await step.run("evaluate-offer", async () => {
      const context: OfferContext = {
        userId,
        itemId,
        offerId,
        offerAmount,
        askingPrice: askingPrice ?? item.askingPrice,
        floorPrice: floorPrice ?? item.floorPrice ?? undefined,
        itemValue: item.itemValue,
        channel,
        buyerUsername,
        daysListed: item.daysListed,
      };

      const result = await evaluateOffer(context);

      console.log(
        `[handle-offer] Offer: $${offerAmount} (${(result.offerPercent * 100).toFixed(1)}% of $${context.askingPrice})`
      );
      console.log(
        `[handle-offer] Decision: ${result.decision}, Confidence: ${result.confidenceLevel} (${(result.confidence * 100).toFixed(0)}%)`
      );

      return result;
    });

    // Step 3: Create autopilot action record
    const actionId = await step.run("create-action-record", async () => {
      const id = crypto.randomUUID();
      const now = new Date();

      // Determine status based on confidence
      let status: "pending" | "executed" | "approved";
      if (evaluation.autoExecute) {
        status = "executed";
      } else if (evaluation.requiresApproval) {
        status = "pending";
      } else {
        // VERY_LOW confidence or MANUAL_REVIEW - log only
        status = "pending";
      }

      // Determine if reversible based on action type
      const reversible = evaluation.decision !== "ACCEPT" && evaluation.decision !== "DECLINE";

      await db.insert(autopilotActions).values({
        id,
        userId,
        itemId,
        ruleId: null, // TODO: Link to actual rule when available
        actionType:
          evaluation.decision === "ACCEPT"
            ? "OFFER_ACCEPT"
            : evaluation.decision === "DECLINE"
              ? "OFFER_DECLINE"
              : evaluation.decision === "COUNTER"
                ? "OFFER_COUNTER"
                : "OFFER_ACCEPT", // MANUAL_REVIEW defaults to accept type
        confidence: evaluation.confidence,
        confidenceLevel: evaluation.confidenceLevel,
        beforeState: {
          offerId,
          offerAmount,
          askingPrice: askingPrice ?? item.askingPrice,
          channel,
          buyerUsername,
        },
        afterState: {
          decision: evaluation.decision,
          counterAmount: evaluation.counterAmount,
        },
        payload: {
          offerId,
          channelListingId,
          channel,
          offerAmount,
          askingPrice: askingPrice ?? item.askingPrice,
          floorPrice: floorPrice ?? item.floorPrice,
          counterAmount: evaluation.counterAmount,
          reason: evaluation.reason,
          ruleConfig: evaluation.ruleConfig,
        },
        status,
        requiresApproval: evaluation.requiresApproval || evaluation.decision === "MANUAL_REVIEW",
        reversible,
        undoDeadline: null, // Offers are not reversible once executed
        createdAt: now,
        executedAt: evaluation.autoExecute ? now : null,
        undoneAt: null,
        errorMessage: null,
        retryCount: 0,
      });

      return id;
    });

    // Step 4: Execute the decision (if auto-execute is enabled)
    const executionResult = await step.run("execute-decision", async () => {
      if (!evaluation.autoExecute) {
        console.log(
          `[handle-offer] Action queued for approval (confidence: ${evaluation.confidenceLevel})`
        );
        return {
          executed: false,
          reason: evaluation.requiresApproval
            ? "Action queued for manual approval"
            : "Low confidence - logged only",
        };
      }

      // TODO: Execute via channel adapter
      // This would call the actual marketplace API
      console.log(`[handle-offer] Executing: ${evaluation.decision}`);

      switch (evaluation.decision) {
        case "ACCEPT":
          // await channelAdapter.acceptOffer(channel, offerId);
          console.log(`[handle-offer] Would accept offer ${offerId}`);
          break;
        case "DECLINE":
          // await channelAdapter.declineOffer(channel, offerId);
          console.log(`[handle-offer] Would decline offer ${offerId}`);
          break;
        case "COUNTER":
          // await channelAdapter.counterOffer(channel, offerId, evaluation.counterAmount);
          console.log(
            `[handle-offer] Would counter offer ${offerId} with $${evaluation.counterAmount}`
          );
          break;
      }

      return {
        executed: true,
        reason: "Auto-executed based on confidence level",
      };
    });

    // Step 5: Log to audit
    await step.run("log-audit", async () => {
      await auditService.log({
        userId,
        actionType:
          evaluation.decision === "ACCEPT"
            ? "OFFER_ACCEPT"
            : evaluation.decision === "DECLINE"
              ? "OFFER_DECLINE"
              : "OFFER_COUNTER",
        actionId,
        itemId,
        channel,
        source: "AUTOPILOT",
        beforeState: {
          offerId,
          offerAmount,
          askingPrice: askingPrice ?? item.askingPrice,
        },
        afterState: {
          decision: evaluation.decision,
          counterAmount: evaluation.counterAmount,
          executed: executionResult.executed,
        },
        metadata: {
          confidence: evaluation.confidence,
          confidenceLevel: evaluation.confidenceLevel,
          reason: evaluation.reason,
          buyerUsername,
        },
        reversible: false, // Offer actions are not reversible
      });

      console.log(`[handle-offer] Logged audit entry for ${evaluation.decision}`);
    });

    return {
      success: true,
      actionId,
      offerId,
      decision: evaluation.decision,
      confidence: evaluation.confidence,
      confidenceLevel: evaluation.confidenceLevel,
      executed: executionResult.executed,
      counterAmount: evaluation.counterAmount,
      reason: evaluation.reason,
    };
  }
);
