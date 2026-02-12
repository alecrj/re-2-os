/**
 * eBay Trading API Client for ResellerOS
 *
 * Implements the eBay Trading API for offer management (RespondToBestOffer).
 * The Trading API uses XML format and a different endpoint than the RESTful APIs.
 *
 * API Reference:
 * - RespondToBestOffer: Accepts, declines, or counters a Best Offer on a listing.
 * - Uses IAF (Identity and Access Framework) tokens from the OAuth flow.
 */

import { ChannelApiError } from "../types";

// ============ CONFIGURATION ============

const TRADING_API_URLS = {
  sandbox: "https://api.sandbox.ebay.com/ws/api.dll",
  production: "https://api.ebay.com/ws/api.dll",
} as const;

const COMPATIBILITY_LEVEL = "1349";
const SITE_ID = "0"; // US site

// ============ TYPES ============

export type OfferAction = "Accept" | "Decline" | "Counter";

export interface RespondToBestOfferInput {
  /** The eBay item ID (legacy item ID / listing ID) */
  itemId: string;
  /** The Best Offer ID(s) to respond to */
  bestOfferIds: string[];
  /** The action to take: Accept, Decline, or Counter */
  action: OfferAction;
  /** Counter offer amount (required when action is "Counter") */
  counterOfferPrice?: number;
  /** Currency code for counter offer (default: USD) */
  counterOfferCurrency?: string;
  /** Message to the buyer (optional, max 500 chars) */
  sellerMessage?: string;
}

export interface RespondToBestOfferResult {
  success: boolean;
  responses: Array<{
    bestOfferId: string;
    success: boolean;
    error?: string;
  }>;
  error?: string;
}

// ============ XML BUILDER ============

/**
 * Escape special XML characters in a string
 */
function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Build the RespondToBestOffer XML request body
 */
export function buildRespondToBestOfferXml(input: RespondToBestOfferInput): string {
  const bestOfferElements = input.bestOfferIds
    .map((id) => `    <BestOfferID>${escapeXml(id)}</BestOfferID>`)
    .join("\n");

  let counterOfferXml = "";
  if (input.action === "Counter" && input.counterOfferPrice !== undefined) {
    const currency = input.counterOfferCurrency ?? "USD";
    counterOfferXml = `
    <CounterOfferPrice currencyID="${escapeXml(currency)}">${input.counterOfferPrice.toFixed(2)}</CounterOfferPrice>`;
  }

  let messageXml = "";
  if (input.sellerMessage) {
    // eBay limits seller message to 500 characters
    const message = input.sellerMessage.substring(0, 500);
    messageXml = `
    <SellerResponse>${escapeXml(message)}</SellerResponse>`;
  }

  return `<?xml version="1.0" encoding="utf-8"?>
<RespondToBestOfferRequest xmlns="urn:ebay:apis:eBLBaseComponents">
    <ItemID>${escapeXml(input.itemId)}</ItemID>
${bestOfferElements}
    <Action>${input.action}</Action>${counterOfferXml}${messageXml}
</RespondToBestOfferRequest>`;
}

// ============ XML PARSER ============

/**
 * Extract a single element value from XML by tag name
 */
function extractXmlValue(xml: string, tagName: string): string | null {
  const regex = new RegExp(`<${tagName}[^>]*>([^<]*)</${tagName}>`, "i");
  const match = xml.match(regex);
  return match ? match[1].trim() : null;
}

/**
 * Extract all occurrences of an element from XML
 */
function extractXmlBlocks(xml: string, tagName: string): string[] {
  const regex = new RegExp(`<${tagName}[^>]*>[\\s\\S]*?</${tagName}>`, "gi");
  const matches = xml.match(regex);
  return matches ?? [];
}

/**
 * Parse the RespondToBestOffer XML response
 */
export function parseRespondToBestOfferResponse(xml: string): RespondToBestOfferResult {
  const ack = extractXmlValue(xml, "Ack");

  if (ack === "Failure") {
    // Extract error details
    const errorBlocks = extractXmlBlocks(xml, "Errors");
    const errors = errorBlocks.map((block) => {
      const code = extractXmlValue(block, "ErrorCode") ?? "UNKNOWN";
      const shortMessage = extractXmlValue(block, "ShortMessage") ?? "Unknown error";
      const longMessage = extractXmlValue(block, "LongMessage") ?? shortMessage;
      return { code, shortMessage, longMessage };
    });

    const errorMessage = errors.length > 0
      ? errors.map((e) => `${e.code}: ${e.longMessage}`).join("; ")
      : "Unknown Trading API error";

    return {
      success: false,
      responses: [],
      error: errorMessage,
    };
  }

  // Parse individual BestOffer responses
  const respondBlocks = extractXmlBlocks(xml, "RespondToBestOffer");
  const responses = respondBlocks.map((block) => {
    const bestOfferId = extractXmlValue(block, "BestOfferID") ?? "";
    const blockAck = extractXmlValue(block, "Ack");
    const success = blockAck !== "Failure";

    let error: string | undefined;
    if (!success) {
      const errorBlock = extractXmlBlocks(block, "Errors");
      if (errorBlock.length > 0) {
        error = extractXmlValue(errorBlock[0], "LongMessage") ??
          extractXmlValue(errorBlock[0], "ShortMessage") ??
          "Offer response failed";
      }
    }

    return { bestOfferId, success, error };
  });

  return {
    success: ack === "Success" || ack === "Warning",
    responses,
  };
}

// ============ TRADING API CLIENT ============

/**
 * eBay Trading API client
 *
 * Uses the Trading API's XML format for operations not available
 * in the RESTful Inventory/Fulfillment APIs.
 */
export class EbayTradingClient {
  private apiUrl: string;

  constructor(environment: "sandbox" | "production" = "sandbox") {
    this.apiUrl = TRADING_API_URLS[environment];
  }

  /**
   * Make a request to the eBay Trading API
   *
   * @param callName - The API call name (e.g., "RespondToBestOffer")
   * @param accessToken - The user's IAF (OAuth) access token
   * @param xmlBody - The XML request body
   * @returns The raw XML response string
   */
  async makeRequest(
    callName: string,
    accessToken: string,
    xmlBody: string
  ): Promise<string> {
    const response = await fetch(this.apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "text/xml",
        "X-EBAY-API-CALL-NAME": callName,
        "X-EBAY-API-SITEID": SITE_ID,
        "X-EBAY-API-COMPATIBILITY-LEVEL": COMPATIBILITY_LEVEL,
        "X-EBAY-API-IAF-TOKEN": accessToken,
      },
      body: xmlBody,
    });

    const responseText = await response.text();

    if (!response.ok) {
      throw new ChannelApiError(
        `Trading API HTTP error: ${response.status}`,
        "TRADING_API_HTTP_ERROR",
        response.status,
        response.status >= 500 || response.status === 429
      );
    }

    return responseText;
  }

  /**
   * Respond to a Best Offer on an eBay listing
   *
   * Supports accepting, declining, or countering offers.
   * Multiple offer IDs can be processed in a single call.
   *
   * @param accessToken - The seller's OAuth access token
   * @param input - The offer response details
   * @returns The parsed response with per-offer results
   */
  async respondToBestOffer(
    accessToken: string,
    input: RespondToBestOfferInput
  ): Promise<RespondToBestOfferResult> {
    // Validate counter offer has price
    if (input.action === "Counter" && input.counterOfferPrice === undefined) {
      return {
        success: false,
        responses: [],
        error: "Counter offer requires a price",
      };
    }

    const xmlBody = buildRespondToBestOfferXml(input);
    const responseXml = await this.makeRequest(
      "RespondToBestOffer",
      accessToken,
      xmlBody
    );

    return parseRespondToBestOfferResponse(responseXml);
  }
}

// Singleton instance
let tradingClientInstance: EbayTradingClient | null = null;

/**
 * Get the eBay Trading API client singleton
 */
export function getEbayTradingClient(): EbayTradingClient {
  if (!tradingClientInstance) {
    const environment =
      (process.env.EBAY_ENVIRONMENT as "sandbox" | "production") ?? "sandbox";
    tradingClientInstance = new EbayTradingClient(environment);
  }
  return tradingClientInstance;
}
