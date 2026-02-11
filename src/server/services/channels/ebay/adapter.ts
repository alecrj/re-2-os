/**
 * eBay Channel Adapter for ResellerOS
 *
 * Native integration with eBay's Inventory and Fulfillment APIs.
 * Implements the ChannelAdapter interface for full automation support.
 */

import {
  type ChannelAdapter,
  type ChannelCapabilities,
  type ListingData,
  type PublishResult,
  type DelistResult,
  type UpdateResult,
  type ChannelOrder,
  ChannelApiError,
  RateLimitError,
  CONDITION_TO_EBAY,
} from "../types";
import { EbayClient, getEbayClient } from "./client";

// ============ EBAY API TYPES ============

interface EbayInventoryItem {
  sku: string;
  locale: string;
  product: {
    title: string;
    description: string;
    imageUrls: string[];
    aspects?: Record<string, string[]>;
  };
  condition: string;
  conditionDescription?: string;
  availability: {
    shipToLocationAvailability: {
      quantity: number;
    };
  };
}

interface EbayOffer {
  sku: string;
  marketplaceId: string;
  format: "FIXED_PRICE" | "AUCTION";
  availableQuantity: number;
  categoryId?: string;
  listingDescription?: string;
  listingPolicies: {
    fulfillmentPolicyId: string;
    paymentPolicyId: string;
    returnPolicyId: string;
  };
  pricingSummary: {
    price: {
      value: string;
      currency: string;
    };
  };
  merchantLocationKey: string;
}

interface EbayPublishResponse {
  listingId: string;
  warnings?: Array<{
    warningId: number;
    message: string;
  }>;
}

interface EbayOfferResponse {
  offerId: string;
  sku: string;
  marketplaceId: string;
  format: string;
  listingId?: string;
  status?: string;
}

interface EbayOrderResponse {
  orders: Array<{
    orderId: string;
    creationDate: string;
    orderFulfillmentStatus: string;
    orderPaymentStatus: string;
    buyer: {
      username: string;
    };
    pricingSummary: {
      total: {
        value: string;
        currency: string;
      };
      deliveryCost?: {
        value: string;
        currency: string;
      };
    };
    lineItems: Array<{
      lineItemId: string;
      title: string;
      quantity: number;
      lineItemCost: {
        value: string;
        currency: string;
      };
      sku?: string;
      legacyItemId?: string;
    }>;
    fulfillmentStartInstructions?: Array<{
      shippingStep?: {
        shipTo?: {
          fullName?: string;
          contactAddress?: {
            addressLine1?: string;
            addressLine2?: string;
            city?: string;
            stateOrProvince?: string;
            postalCode?: string;
            countryCode?: string;
          };
        };
      };
    }>;
  }>;
  total: number;
  offset: number;
  limit: number;
}

// ============ INVENTORY TYPES ============

interface EbayInventoryItemsResponse {
  inventoryItems: Array<{
    sku: string;
    locale: string;
    product: {
      title: string;
      description: string;
      imageUrls?: string[];
      aspects?: Record<string, string[]>;
    };
    condition: string;
    conditionDescription?: string;
    availability: {
      shipToLocationAvailability: {
        quantity: number;
      };
    };
  }>;
  total: number;
  size: number;
  offset: number;
  limit: number;
  next?: string;
}

interface EbayOffersResponse {
  offers: Array<{
    offerId: string;
    sku: string;
    marketplaceId: string;
    format: string;
    availableQuantity: number;
    categoryId?: string;
    listingId?: string;
    status: string;
    pricingSummary: {
      price: {
        value: string;
        currency: string;
      };
    };
  }>;
  total: number;
  size: number;
  offset: number;
  limit: number;
  next?: string;
}

/**
 * Inventory item data returned from syncInventory
 */
export interface EbayInventoryItemData {
  sku: string;
  title: string;
  description: string;
  condition: string;
  quantity: number;
  imageUrls: string[];
  aspects?: Record<string, string[]>;
  price?: number;
  listingId?: string;
  offerId?: string;
  offerStatus?: string;
}

// ============ EBAY ADAPTER ============

export class EbayAdapter implements ChannelAdapter {
  readonly channelId = "ebay" as const;
  readonly mode = "native" as const;
  readonly capabilities: ChannelCapabilities = {
    canPublish: true,
    canReprice: true,
    canDelist: true,
    canSyncOrders: true,
    canSyncInventory: true,
    requiresManualAction: false,
  };

  private client: EbayClient;

  // Default policy IDs - these should be configured per user in production
  private defaultPolicies = {
    fulfillmentPolicyId: process.env.EBAY_FULFILLMENT_POLICY_ID ?? "",
    paymentPolicyId: process.env.EBAY_PAYMENT_POLICY_ID ?? "",
    returnPolicyId: process.env.EBAY_RETURN_POLICY_ID ?? "",
    merchantLocationKey: process.env.EBAY_MERCHANT_LOCATION_KEY ?? "",
  };

  constructor(client?: EbayClient) {
    this.client = client ?? getEbayClient();
  }

  // ============ AUTHENTICATION ============

  async isConnected(userId: string): Promise<boolean> {
    return this.client.isConnected(userId);
  }

  async getAuthUrl(_userId: string): Promise<string> {
    // Authentication is handled via NextAuth.js OAuth flow
    // This would return the eBay OAuth URL if implementing standalone
    const clientId = process.env.EBAY_CLIENT_ID;
    const redirectUri = process.env.EBAY_REDIRECT_URI ?? `${process.env.NEXTAUTH_URL}/api/auth/callback/ebay`;
    const environment = process.env.EBAY_ENVIRONMENT === "production" ? "" : "sandbox.";
    const scopes = [
      "https://api.ebay.com/oauth/api_scope",
      "https://api.ebay.com/oauth/api_scope/sell.inventory",
      "https://api.ebay.com/oauth/api_scope/sell.fulfillment",
      "https://api.ebay.com/oauth/api_scope/sell.account",
    ].join(" ");

    return `https://auth.${environment}ebay.com/oauth2/authorize?client_id=${clientId}&response_type=code&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scopes)}`;
  }

  async handleCallback(_userId: string, _code: string): Promise<void> {
    // Token exchange is handled by NextAuth.js
    // Implementation would go here for standalone OAuth
    throw new Error("OAuth callback is handled by NextAuth.js");
  }

  async refreshToken(userId: string): Promise<boolean> {
    // Token refresh is automatic in the client
    // This method forces a refresh check
    try {
      await this.client.request(userId, {
        method: "GET",
        path: "/inventory_item?limit=1",
      });
      return true;
    } catch (error) {
      console.error("[EbayAdapter] Token refresh check failed:", error);
      return false;
    }
  }

  // ============ LISTING OPERATIONS ============

  /**
   * Publish a listing to eBay
   * Flow: 1. Create inventory item, 2. Create offer, 3. Publish offer
   */
  async publish(userId: string, listing: ListingData): Promise<PublishResult> {
    // Check rate limit before making revisions
    const rateStatus = this.client.getRevisionStatus(userId);
    if (!rateStatus.allowed) {
      return {
        success: false,
        error: `Daily revision limit reached (${200 - rateStatus.remaining}/200). Resets at ${rateStatus.resetsAt.toISOString()}`,
        errorCode: "RATE_LIMIT_EXCEEDED",
      };
    }

    try {
      // Step 1: Create inventory item
      const inventoryItem = this.buildInventoryItem(listing);
      await this.client.request(userId, {
        method: "PUT",
        path: `/inventory_item/${encodeURIComponent(listing.sku)}`,
        body: inventoryItem,
      });

      // Track revision
      this.client.trackRevision(userId);

      // Step 2: Create offer
      const offer = this.buildOffer(listing);
      const offerResponse = await this.client.request<EbayOfferResponse>(userId, {
        method: "POST",
        path: "/offer",
        body: offer,
      });

      // Track revision
      this.client.trackRevision(userId);

      // Step 3: Publish offer
      const publishResponse = await this.client.request<EbayPublishResponse>(userId, {
        method: "POST",
        path: `/offer/${offerResponse.offerId}/publish`,
      });

      // Track revision
      this.client.trackRevision(userId);

      const listingId = publishResponse.listingId;
      const environment = process.env.EBAY_ENVIRONMENT === "production" ? "" : "sandbox.";

      return {
        success: true,
        externalId: listingId,
        externalUrl: `https://www.${environment}ebay.com/itm/${listingId}`,
      };
    } catch (error) {
      return this.handleError(error, "publish");
    }
  }

  /**
   * Update an existing eBay listing
   */
  async update(
    userId: string,
    externalId: string,
    updates: Partial<ListingData>
  ): Promise<UpdateResult> {
    // Check rate limit
    const rateStatus = this.client.getRevisionStatus(userId);
    if (!rateStatus.allowed) {
      return {
        success: false,
        error: `Daily revision limit reached. Resets at ${rateStatus.resetsAt.toISOString()}`,
        errorCode: "RATE_LIMIT_EXCEEDED",
      };
    }

    try {
      // For eBay, we need to update via the SKU, not the listing ID
      // The externalId passed here should be the listing ID, so we need to
      // find the associated offer and SKU

      // Get the offer for this listing
      const offers = await this.client.request<{ offers: EbayOfferResponse[] }>(userId, {
        method: "GET",
        path: `/offer?listing_id=${externalId}`,
      });

      if (!offers.offers || offers.offers.length === 0) {
        return {
          success: false,
          error: "No offer found for listing",
          errorCode: "OFFER_NOT_FOUND",
        };
      }

      const offer = offers.offers[0];

      // Update inventory item if title, description, condition, or images changed
      if (updates.title || updates.description || updates.condition || updates.imageUrls) {
        const currentItem = await this.client.request<EbayInventoryItem>(userId, {
          method: "GET",
          path: `/inventory_item/${encodeURIComponent(offer.sku)}`,
        });

        const updatedItem: Partial<EbayInventoryItem> = {
          ...currentItem,
          product: {
            ...currentItem.product,
            title: updates.title ?? currentItem.product.title,
            description: updates.description ?? currentItem.product.description,
            imageUrls: updates.imageUrls ?? currentItem.product.imageUrls,
          },
        };

        if (updates.condition) {
          updatedItem.condition = CONDITION_TO_EBAY[updates.condition];
        }

        await this.client.request(userId, {
          method: "PUT",
          path: `/inventory_item/${encodeURIComponent(offer.sku)}`,
          body: updatedItem,
        });

        this.client.trackRevision(userId);
      }

      // Update price via offer update
      if (updates.price !== undefined) {
        await this.client.request(userId, {
          method: "PUT",
          path: `/offer/${offer.offerId}`,
          body: {
            pricingSummary: {
              price: {
                value: updates.price.toFixed(2),
                currency: "USD",
              },
            },
          },
        });

        this.client.trackRevision(userId);
      }

      // Update quantity
      if (updates.quantity !== undefined) {
        await this.client.request(userId, {
          method: "PUT",
          path: `/offer/${offer.offerId}`,
          body: {
            availableQuantity: updates.quantity,
          },
        });

        this.client.trackRevision(userId);
      }

      return { success: true };
    } catch (error) {
      return this.handleError(error, "update");
    }
  }

  /**
   * Update the price of an eBay listing
   */
  async updatePrice(
    userId: string,
    externalId: string,
    newPrice: number
  ): Promise<UpdateResult> {
    // Check rate limit
    const rateStatus = this.client.getRevisionStatus(userId);
    if (!rateStatus.allowed) {
      return {
        success: false,
        error: `Daily revision limit reached. Resets at ${rateStatus.resetsAt.toISOString()}`,
        errorCode: "RATE_LIMIT_EXCEEDED",
      };
    }

    try {
      // Get the offer for this listing
      const offers = await this.client.request<{ offers: EbayOfferResponse[] }>(userId, {
        method: "GET",
        path: `/offer?listing_id=${externalId}`,
      });

      if (!offers.offers || offers.offers.length === 0) {
        return {
          success: false,
          error: "No offer found for listing",
          errorCode: "OFFER_NOT_FOUND",
        };
      }

      const offer = offers.offers[0];

      // Update price
      await this.client.request(userId, {
        method: "PUT",
        path: `/offer/${offer.offerId}`,
        body: {
          pricingSummary: {
            price: {
              value: newPrice.toFixed(2),
              currency: "USD",
            },
          },
        },
      });

      this.client.trackRevision(userId);

      return { success: true };
    } catch (error) {
      return this.handleError(error, "updatePrice");
    }
  }

  /**
   * Delist an item from eBay (set quantity to 0)
   */
  async delist(userId: string, externalId: string): Promise<DelistResult> {
    // Check rate limit
    const rateStatus = this.client.getRevisionStatus(userId);
    if (!rateStatus.allowed) {
      return {
        success: false,
        error: `Daily revision limit reached. Resets at ${rateStatus.resetsAt.toISOString()}`,
        errorCode: "RATE_LIMIT_EXCEEDED",
      };
    }

    try {
      // Get the offer for this listing
      const offers = await this.client.request<{ offers: EbayOfferResponse[] }>(userId, {
        method: "GET",
        path: `/offer?listing_id=${externalId}`,
      });

      if (!offers.offers || offers.offers.length === 0) {
        return {
          success: false,
          error: "No offer found for listing",
          errorCode: "OFFER_NOT_FOUND",
        };
      }

      const offer = offers.offers[0];

      // Set quantity to 0 (fastest delist method)
      await this.client.request(userId, {
        method: "PUT",
        path: `/offer/${offer.offerId}`,
        body: {
          availableQuantity: 0,
        },
      });

      this.client.trackRevision(userId);

      return { success: true };
    } catch (error) {
      return this.handleError(error, "delist");
    }
  }

  // ============ SYNC OPERATIONS ============

  /**
   * Sync orders from eBay Fulfillment API
   */
  async syncOrders(userId: string, since: Date): Promise<ChannelOrder[]> {
    try {
      const sinceIso = since.toISOString();
      const response = await this.client.request<EbayOrderResponse>(userId, {
        method: "GET",
        path: `/order?filter=creationdate:[${sinceIso}..] &limit=50`,
        api: "fulfillment",
      });

      return response.orders.map((order) => this.mapEbayOrder(order));
    } catch (error) {
      console.error("[EbayAdapter] Order sync failed:", error);
      return [];
    }
  }

  /**
   * Sync inventory items from eBay Inventory API
   * Fetches all inventory items and their associated offers (for pricing)
   */
  async syncInventory(userId: string): Promise<EbayInventoryItemData[]> {
    const allItems: EbayInventoryItemData[] = [];
    let offset = 0;
    const limit = 100; // eBay max is 200, we use 100 for safety
    let hasMore = true;

    try {
      // Step 1: Fetch all inventory items with pagination
      while (hasMore) {
        console.log(`[EbayAdapter] Fetching inventory items, offset: ${offset}`);

        const response = await this.client.request<EbayInventoryItemsResponse>(userId, {
          method: "GET",
          path: `/inventory_item?limit=${limit}&offset=${offset}`,
        });

        if (!response.inventoryItems || response.inventoryItems.length === 0) {
          hasMore = false;
          break;
        }

        // Map inventory items
        for (const item of response.inventoryItems) {
          allItems.push({
            sku: item.sku,
            title: item.product.title,
            description: item.product.description,
            condition: item.condition,
            quantity: item.availability.shipToLocationAvailability.quantity,
            imageUrls: item.product.imageUrls ?? [],
            aspects: item.product.aspects,
          });
        }

        offset += response.inventoryItems.length;

        // Check if there are more items
        if (!response.next || response.inventoryItems.length < limit) {
          hasMore = false;
        }
      }

      console.log(`[EbayAdapter] Fetched ${allItems.length} inventory items`);

      // If no inventory items, return early
      if (allItems.length === 0) {
        return allItems;
      }

      // Step 2: Fetch all offers to get pricing and listing IDs
      const offersMap = new Map<string, {
        price: number;
        listingId?: string;
        offerId: string;
        offerStatus: string;
      }>();

      offset = 0;
      hasMore = true;

      while (hasMore) {
        console.log(`[EbayAdapter] Fetching offers, offset: ${offset}`);

        const offersResponse = await this.client.request<EbayOffersResponse>(userId, {
          method: "GET",
          path: `/offer?limit=${limit}&offset=${offset}`,
        });

        if (!offersResponse.offers || offersResponse.offers.length === 0) {
          hasMore = false;
          break;
        }

        for (const offer of offersResponse.offers) {
          offersMap.set(offer.sku, {
            price: parseFloat(offer.pricingSummary.price.value),
            listingId: offer.listingId,
            offerId: offer.offerId,
            offerStatus: offer.status,
          });
        }

        offset += offersResponse.offers.length;

        if (!offersResponse.next || offersResponse.offers.length < limit) {
          hasMore = false;
        }
      }

      console.log(`[EbayAdapter] Fetched ${offersMap.size} offers`);

      // Step 3: Merge offer data into inventory items
      for (const item of allItems) {
        const offerData = offersMap.get(item.sku);
        if (offerData) {
          item.price = offerData.price;
          item.listingId = offerData.listingId;
          item.offerId = offerData.offerId;
          item.offerStatus = offerData.offerStatus;
        }
      }

      return allItems;
    } catch (error) {
      console.error("[EbayAdapter] Inventory sync failed:", error);
      throw error;
    }
  }

  // ============ HELPER METHODS ============

  /**
   * Build eBay inventory item from ListingData
   */
  private buildInventoryItem(listing: ListingData): EbayInventoryItem {
    const item: EbayInventoryItem = {
      sku: listing.sku,
      locale: "en_US",
      product: {
        title: listing.title.substring(0, 80), // eBay title limit
        description: listing.description.substring(0, 4000), // eBay description limit
        imageUrls: listing.imageUrls.slice(0, 24), // eBay image limit
      },
      condition: CONDITION_TO_EBAY[listing.condition],
      availability: {
        shipToLocationAvailability: {
          quantity: listing.quantity,
        },
      },
    };

    // Add item specifics as aspects if provided
    if (listing.itemSpecifics && Object.keys(listing.itemSpecifics).length > 0) {
      item.product.aspects = {};
      for (const [key, value] of Object.entries(listing.itemSpecifics)) {
        item.product.aspects[key] = [value];
      }
    }

    return item;
  }

  /**
   * Build eBay offer from ListingData
   */
  private buildOffer(listing: ListingData): EbayOffer {
    return {
      sku: listing.sku,
      marketplaceId: "EBAY_US",
      format: "FIXED_PRICE",
      availableQuantity: listing.quantity,
      categoryId: listing.category,
      listingPolicies: {
        fulfillmentPolicyId: this.defaultPolicies.fulfillmentPolicyId,
        paymentPolicyId: this.defaultPolicies.paymentPolicyId,
        returnPolicyId: this.defaultPolicies.returnPolicyId,
      },
      pricingSummary: {
        price: {
          value: listing.price.toFixed(2),
          currency: "USD",
        },
      },
      merchantLocationKey: this.defaultPolicies.merchantLocationKey,
    };
  }

  /**
   * Map eBay order to ChannelOrder
   */
  private mapEbayOrder(ebayOrder: EbayOrderResponse["orders"][0]): ChannelOrder {
    const shippingInfo =
      ebayOrder.fulfillmentStartInstructions?.[0]?.shippingStep?.shipTo;
    const address = shippingInfo?.contactAddress;

    let status: ChannelOrder["status"] = "PENDING";
    if (ebayOrder.orderPaymentStatus === "PAID") {
      status = "PAID";
    }
    if (ebayOrder.orderFulfillmentStatus === "FULFILLED") {
      status = "SHIPPED";
    }
    if (ebayOrder.orderFulfillmentStatus === "IN_PROGRESS") {
      status = "SHIPPED";
    }

    return {
      externalOrderId: ebayOrder.orderId,
      channel: "ebay",
      buyerUsername: ebayOrder.buyer?.username,
      status,
      salePrice: parseFloat(ebayOrder.pricingSummary.total.value),
      shippingPaid: ebayOrder.pricingSummary.deliveryCost
        ? parseFloat(ebayOrder.pricingSummary.deliveryCost.value)
        : undefined,
      shippingAddress: address
        ? {
            name: shippingInfo?.fullName,
            street1: address.addressLine1,
            street2: address.addressLine2,
            city: address.city,
            state: address.stateOrProvince,
            postalCode: address.postalCode,
            country: address.countryCode,
          }
        : undefined,
      lineItems: ebayOrder.lineItems.map((item) => ({
        sku: item.sku ?? "",
        title: item.title,
        quantity: item.quantity,
        price: parseFloat(item.lineItemCost.value),
        externalListingId: item.legacyItemId,
      })),
      orderedAt: new Date(ebayOrder.creationDate),
      paidAt:
        ebayOrder.orderPaymentStatus === "PAID"
          ? new Date(ebayOrder.creationDate)
          : undefined,
    };
  }

  /**
   * Handle errors and convert to appropriate result type
   */
  private handleError(
    error: unknown,
    operation: string
  ): PublishResult | DelistResult | UpdateResult {
    if (error instanceof RateLimitError) {
      return {
        success: false,
        error: `Rate limit exceeded. Try again after ${error.retryAfter ?? 60} seconds.`,
        errorCode: "RATE_LIMIT_EXCEEDED",
      };
    }

    if (error instanceof ChannelApiError) {
      console.error(`[EbayAdapter] ${operation} error:`, error.message, error.code);
      return {
        success: false,
        error: error.message,
        errorCode: error.code,
      };
    }

    console.error(`[EbayAdapter] ${operation} unexpected error:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "An unexpected error occurred",
      errorCode: "UNKNOWN",
    };
  }
}

// Singleton instance
let adapterInstance: EbayAdapter | null = null;

/**
 * Get the eBay adapter singleton instance
 */
export function getEbayAdapter(): EbayAdapter {
  if (!adapterInstance) {
    adapterInstance = new EbayAdapter();
  }
  return adapterInstance;
}

export default EbayAdapter;
