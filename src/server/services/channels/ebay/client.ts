/**
 * eBay API Client for ResellerOS
 *
 * Handles OAuth token management, request signing, error handling, and retries.
 * Uses the channelConnections table for token storage.
 */

import { db } from "@/server/db/client";
import { channelConnections } from "@/server/db/schema";
import { eq, and } from "drizzle-orm";
import {
  ChannelApiError,
  AuthenticationError,
  TokenExpiredError,
  RateLimitError,
} from "../types";

// ============ CONFIGURATION ============

export interface EbayClientConfig {
  environment: "sandbox" | "production";
  clientId: string;
  clientSecret: string;
}

const EBAY_API_URLS = {
  sandbox: {
    inventory: "https://api.sandbox.ebay.com/sell/inventory/v1",
    fulfillment: "https://api.sandbox.ebay.com/sell/fulfillment/v1",
    account: "https://api.sandbox.ebay.com/sell/account/v1",
    token: "https://api.sandbox.ebay.com/identity/v1/oauth2/token",
  },
  production: {
    inventory: "https://api.ebay.com/sell/inventory/v1",
    fulfillment: "https://api.ebay.com/sell/fulfillment/v1",
    account: "https://api.ebay.com/sell/account/v1",
    token: "https://api.ebay.com/identity/v1/oauth2/token",
  },
};

// Default configuration from environment
const getDefaultConfig = (): EbayClientConfig => ({
  environment: (process.env.EBAY_ENVIRONMENT as "sandbox" | "production") ?? "sandbox",
  clientId: process.env.EBAY_CLIENT_ID ?? "",
  clientSecret: process.env.EBAY_CLIENT_SECRET ?? "",
});

// ============ RATE LIMITER ============

/**
 * In-memory rate limiter for eBay revisions (250/day, we use 200 safe limit)
 * In production, this should be stored in the database for persistence across restarts.
 */
interface UserRevisionCount {
  count: number;
  resetsAt: Date;
}

const revisionCounts = new Map<string, UserRevisionCount>();

const SAFE_REVISION_LIMIT = 200; // eBay allows 250, we use 200 as buffer

/**
 * Get the next midnight Pacific Time as a Date
 */
function getMidnightPT(): Date {
  const now = new Date();
  // Convert to Pacific Time by using toLocaleString
  const ptString = now.toLocaleString("en-US", { timeZone: "America/Los_Angeles" });
  const ptDate = new Date(ptString);

  // Get tomorrow at midnight PT
  const midnight = new Date(ptDate);
  midnight.setDate(midnight.getDate() + 1);
  midnight.setHours(0, 0, 0, 0);

  // Convert back to UTC
  const ptOffset = now.getTime() - ptDate.getTime();
  return new Date(midnight.getTime() + ptOffset);
}

/**
 * Check if a revision is allowed under the rate limit
 */
export function checkRevisionLimit(userId: string): {
  allowed: boolean;
  remaining: number;
  resetsAt: Date;
} {
  const now = new Date();
  let userCount = revisionCounts.get(userId);

  // Reset if past reset time or no record exists
  if (!userCount || now >= userCount.resetsAt) {
    userCount = {
      count: 0,
      resetsAt: getMidnightPT(),
    };
    revisionCounts.set(userId, userCount);
  }

  return {
    allowed: userCount.count < SAFE_REVISION_LIMIT,
    remaining: Math.max(0, SAFE_REVISION_LIMIT - userCount.count),
    resetsAt: userCount.resetsAt,
  };
}

/**
 * Increment the revision count for a user
 */
export function incrementRevisionCount(userId: string): void {
  const now = new Date();
  let userCount = revisionCounts.get(userId);

  if (!userCount || now >= userCount.resetsAt) {
    userCount = {
      count: 1,
      resetsAt: getMidnightPT(),
    };
  } else {
    userCount.count++;
  }

  revisionCounts.set(userId, userCount);
}

// ============ TOKEN MANAGEMENT ============

interface TokenData {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
}

/**
 * Get tokens for a user from the database
 */
async function getTokens(userId: string): Promise<TokenData | null> {
  const connection = await db
    .select()
    .from(channelConnections)
    .where(
      and(eq(channelConnections.userId, userId), eq(channelConnections.channel, "ebay"))
    )
    .limit(1);

  if (connection.length === 0) {
    return null;
  }

  const conn = connection[0];
  if (!conn.accessToken || !conn.refreshToken) {
    return null;
  }

  return {
    accessToken: conn.accessToken,
    refreshToken: conn.refreshToken,
    expiresAt: conn.tokenExpiresAt ?? new Date(0),
  };
}

/**
 * Update tokens in the database
 */
async function updateTokens(
  userId: string,
  tokens: { accessToken: string; refreshToken: string; expiresAt: Date }
): Promise<void> {
  await db
    .update(channelConnections)
    .set({
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      tokenExpiresAt: tokens.expiresAt,
      status: "active",
      lastSyncAt: new Date(),
    })
    .where(
      and(eq(channelConnections.userId, userId), eq(channelConnections.channel, "ebay"))
    );
}

/**
 * Refresh an expired token
 */
async function refreshToken(
  userId: string,
  refreshTokenValue: string,
  config: EbayClientConfig
): Promise<TokenData | null> {
  const urls = EBAY_API_URLS[config.environment];
  const credentials = Buffer.from(`${config.clientId}:${config.clientSecret}`).toString(
    "base64"
  );

  try {
    const response = await fetch(urls.token, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${credentials}`,
      },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: refreshTokenValue,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[EbayClient] Token refresh failed:", errorText);
      return null;
    }

    const data = await response.json();
    const newTokens = {
      accessToken: data.access_token,
      refreshToken: data.refresh_token || refreshTokenValue,
      expiresAt: new Date(Date.now() + data.expires_in * 1000),
    };

    // Persist to database
    await updateTokens(userId, newTokens);

    return newTokens;
  } catch (error) {
    console.error("[EbayClient] Token refresh error:", error);
    return null;
  }
}

/**
 * Get a valid access token, refreshing if necessary
 */
async function getValidToken(
  userId: string,
  config: EbayClientConfig
): Promise<string> {
  const tokens = await getTokens(userId);

  if (!tokens) {
    throw new AuthenticationError("No eBay connection found for user");
  }

  // Check if token is expired or will expire in the next 5 minutes
  const bufferTime = 5 * 60 * 1000; // 5 minutes
  const isExpired = tokens.expiresAt.getTime() - Date.now() < bufferTime;

  if (isExpired) {
    const newTokens = await refreshToken(userId, tokens.refreshToken, config);
    if (!newTokens) {
      throw new TokenExpiredError();
    }
    return newTokens.accessToken;
  }

  return tokens.accessToken;
}

// ============ HTTP CLIENT ============

interface RequestOptions {
  method: "GET" | "POST" | "PUT" | "DELETE";
  path: string;
  body?: unknown;
  headers?: Record<string, string>;
  api?: "inventory" | "fulfillment" | "account";
}

interface EbayErrorResponse {
  errors?: Array<{
    errorId: number;
    domain: string;
    category: string;
    message: string;
    longMessage?: string;
    parameters?: Array<{ name: string; value: string }>;
  }>;
}

/**
 * Parse eBay API error response
 */
function parseEbayError(response: EbayErrorResponse, statusCode: number): ChannelApiError {
  const firstError = response.errors?.[0];

  if (!firstError) {
    return new ChannelApiError("Unknown eBay API error", "UNKNOWN", statusCode);
  }

  const message = firstError.longMessage || firstError.message;
  const errorCode = `${firstError.domain}.${firstError.category}.${firstError.errorId}`;

  // Determine if retryable
  const retryable =
    statusCode >= 500 ||
    statusCode === 429 ||
    firstError.category === "REQUEST" ||
    firstError.category === "SYSTEM";

  return new ChannelApiError(message, errorCode, statusCode, retryable);
}

/**
 * Sleep for a given number of milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * eBay API Client class
 */
export class EbayClient {
  private config: EbayClientConfig;
  private urls: typeof EBAY_API_URLS.sandbox;

  constructor(config?: Partial<EbayClientConfig>) {
    const defaultConfig = getDefaultConfig();
    this.config = {
      ...defaultConfig,
      ...config,
    };
    this.urls = EBAY_API_URLS[this.config.environment];
  }

  /**
   * Make an authenticated request to the eBay API with retries
   */
  async request<T>(userId: string, options: RequestOptions): Promise<T> {
    const maxRetries = 3;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        return await this.executeRequest<T>(userId, options);
      } catch (error) {
        lastError = error as Error;

        // Don't retry authentication errors
        if (error instanceof AuthenticationError) {
          throw error;
        }

        // Handle rate limiting with exponential backoff
        if (error instanceof RateLimitError) {
          if (attempt < maxRetries - 1) {
            const backoff = Math.min(1000 * Math.pow(2, attempt), 30000);
            console.log(`[EbayClient] Rate limited, waiting ${backoff}ms before retry`);
            await sleep(backoff);
            continue;
          }
        }

        // Retry on retryable errors
        if (error instanceof ChannelApiError && error.retryable) {
          if (attempt < maxRetries - 1) {
            const backoff = Math.min(1000 * Math.pow(2, attempt), 10000);
            console.log(`[EbayClient] Retryable error, attempt ${attempt + 1}, waiting ${backoff}ms`);
            await sleep(backoff);
            continue;
          }
        }

        throw error;
      }
    }

    throw lastError ?? new Error("Request failed after retries");
  }

  /**
   * Execute a single request to the eBay API
   */
  private async executeRequest<T>(userId: string, options: RequestOptions): Promise<T> {
    const accessToken = await getValidToken(userId, this.config);
    const baseUrl = this.urls[options.api ?? "inventory"];
    const url = `${baseUrl}${options.path}`;

    const headers: Record<string, string> = {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      "Content-Language": "en-US",
      "X-EBAY-C-MARKETPLACE-ID": "EBAY_US",
      ...options.headers,
    };

    const fetchOptions: RequestInit = {
      method: options.method,
      headers,
    };

    if (options.body && options.method !== "GET") {
      fetchOptions.body = JSON.stringify(options.body);
    }

    const response = await fetch(url, fetchOptions);

    // Handle rate limiting
    if (response.status === 429) {
      const retryAfter = response.headers.get("Retry-After");
      const resetsAt = retryAfter
        ? new Date(Date.now() + parseInt(retryAfter, 10) * 1000)
        : new Date(Date.now() + 60000);
      throw new RateLimitError("eBay API rate limit exceeded", resetsAt);
    }

    // Handle no content responses (successful deletes, etc.)
    if (response.status === 204) {
      return {} as T;
    }

    // Parse response body
    const contentType = response.headers.get("Content-Type");
    let data: unknown;

    if (contentType?.includes("application/json")) {
      data = await response.json();
    } else {
      const text = await response.text();
      if (text) {
        try {
          data = JSON.parse(text);
        } catch {
          data = { message: text };
        }
      }
    }

    // Handle errors
    if (!response.ok) {
      throw parseEbayError(data as EbayErrorResponse, response.status);
    }

    return data as T;
  }

  /**
   * Check if a user has a valid eBay connection
   */
  async isConnected(userId: string): Promise<boolean> {
    try {
      const tokens = await getTokens(userId);
      return tokens !== null;
    } catch {
      return false;
    }
  }

  /**
   * Get the user's current revision count status
   */
  getRevisionStatus(userId: string): {
    allowed: boolean;
    remaining: number;
    resetsAt: Date;
  } {
    return checkRevisionLimit(userId);
  }

  /**
   * Increment revision count after a successful modification
   */
  trackRevision(userId: string): void {
    incrementRevisionCount(userId);
  }
}

// Singleton instance
let clientInstance: EbayClient | null = null;

/**
 * Get the eBay client singleton instance
 */
export function getEbayClient(): EbayClient {
  if (!clientInstance) {
    clientInstance = new EbayClient();
  }
  return clientInstance;
}

export default EbayClient;
