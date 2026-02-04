/**
 * Channel Adapters Index for ResellerOS
 *
 * Factory function to get the appropriate channel adapter.
 * Currently supports:
 * - eBay (native integration)
 * - Poshmark, Mercari, Depop (assisted mode - future implementation)
 */

import type { ChannelId, ChannelAdapter, ChannelCapabilities } from "./types";
import { getEbayAdapter } from "./ebay";

// Re-export all types
export * from "./types";

// Re-export eBay module
export * from "./ebay";

/**
 * Channel capabilities for all supported channels
 */
export const CHANNEL_CAPABILITIES: Record<ChannelId, ChannelCapabilities> = {
  ebay: {
    canPublish: true,
    canReprice: true,
    canDelist: true,
    canSyncOrders: true,
    canSyncInventory: true,
    requiresManualAction: false,
  },
  poshmark: {
    canPublish: false,
    canReprice: false,
    canDelist: false,
    canSyncOrders: false,
    canSyncInventory: false,
    requiresManualAction: true,
  },
  mercari: {
    canPublish: false,
    canReprice: false,
    canDelist: false,
    canSyncOrders: false,
    canSyncInventory: false,
    requiresManualAction: true,
  },
  depop: {
    canPublish: false,
    canReprice: false,
    canDelist: false,
    canSyncOrders: false,
    canSyncInventory: false,
    requiresManualAction: true,
  },
};

/**
 * Get the channel adapter for a specific channel
 *
 * @param channel - The channel ID to get the adapter for
 * @returns The channel adapter instance
 * @throws Error if the channel is not supported or not implemented
 */
export function getAdapter(channel: ChannelId): ChannelAdapter {
  switch (channel) {
    case "ebay":
      return getEbayAdapter();

    case "poshmark":
    case "mercari":
    case "depop":
      throw new Error(
        `Channel "${channel}" is in assisted mode. Use generateCrossListTemplate() for manual listing assistance.`
      );

    default:
      throw new Error(`Unknown channel: ${channel}`);
  }
}

/**
 * Check if a channel has native integration support
 */
export function isNativeChannel(channel: ChannelId): boolean {
  return channel === "ebay";
}

/**
 * Check if a channel requires manual action
 */
export function isAssistedChannel(channel: ChannelId): boolean {
  return CHANNEL_CAPABILITIES[channel].requiresManualAction;
}

/**
 * Get capabilities for a channel
 */
export function getChannelCapabilities(channel: ChannelId): ChannelCapabilities {
  return CHANNEL_CAPABILITIES[channel];
}

/**
 * Generate a cross-list template for assisted channels
 * Formats listing data for easy copy-paste to Poshmark, Mercari, or Depop
 */
export function generateCrossListTemplate(
  channel: ChannelId,
  listing: {
    title: string;
    description: string;
    price: number;
    condition: string;
    itemSpecifics?: Record<string, string>;
  }
): {
  title: string;
  description: string;
  price: number;
  copyableFields: Record<string, string>;
  instructions: string[];
} {
  switch (channel) {
    case "poshmark":
      return generatePoshmarkTemplate(listing);
    case "mercari":
      return generateMercariTemplate(listing);
    case "depop":
      return generateDepopTemplate(listing);
    default:
      throw new Error(`Cross-list template not available for ${channel}`);
  }
}

/**
 * Generate Poshmark-optimized template
 */
function generatePoshmarkTemplate(listing: {
  title: string;
  description: string;
  price: number;
  condition: string;
  itemSpecifics?: Record<string, string>;
}): {
  title: string;
  description: string;
  price: number;
  copyableFields: Record<string, string>;
  instructions: string[];
} {
  // Poshmark has 80 char title limit
  const title = listing.title.substring(0, 80);

  // Poshmark description format
  let description = listing.description;

  // Add size and brand if available
  const specifics = listing.itemSpecifics ?? {};
  if (specifics.brand || specifics.size) {
    description = `${description}\n\n`;
    if (specifics.brand) description += `Brand: ${specifics.brand}\n`;
    if (specifics.size) description += `Size: ${specifics.size}\n`;
  }

  // Poshmark condition mapping
  const conditionMap: Record<string, string> = {
    new: "NWT",
    like_new: "NWOT",
    good: "Good",
    fair: "Fair",
    poor: "Poor",
  };

  return {
    title,
    description,
    price: listing.price,
    copyableFields: {
      title,
      description,
      brand: specifics.brand ?? "",
      size: specifics.size ?? "",
      condition: conditionMap[listing.condition] ?? "Good",
    },
    instructions: [
      "1. Open Poshmark app or poshmark.com",
      "2. Tap 'Sell' to create new listing",
      "3. Upload photos from your device",
      "4. Copy the title and description from the fields above",
      "5. Select the appropriate category and brand",
      `6. Set price to $${listing.price.toFixed(2)}`,
      "7. Add relevant hashtags for better visibility",
      "8. Complete and share your listing",
    ],
  };
}

/**
 * Generate Mercari-optimized template
 */
function generateMercariTemplate(listing: {
  title: string;
  description: string;
  price: number;
  condition: string;
  itemSpecifics?: Record<string, string>;
}): {
  title: string;
  description: string;
  price: number;
  copyableFields: Record<string, string>;
  instructions: string[];
} {
  // Mercari has 40 char title limit
  const title = listing.title.substring(0, 40);

  // Mercari description - keep it concise
  const description = listing.description.substring(0, 1000);

  // Mercari condition mapping
  const conditionMap: Record<string, string> = {
    new: "New",
    like_new: "Like new",
    good: "Good",
    fair: "Fair",
    poor: "Poor",
  };

  const specifics = listing.itemSpecifics ?? {};

  return {
    title,
    description,
    price: listing.price,
    copyableFields: {
      title,
      description,
      brand: specifics.brand ?? "",
      condition: conditionMap[listing.condition] ?? "Good",
    },
    instructions: [
      "1. Open Mercari app or mercari.com",
      "2. Tap 'Sell' to create new listing",
      "3. Upload photos from your device",
      "4. Copy the title and description from the fields above",
      "5. Select condition and category",
      `6. Set price to $${listing.price.toFixed(2)}`,
      "7. Set shipping weight and method",
      "8. Complete your listing",
      "",
      "TIP: You can also use Mercari's import feature to import directly from your eBay listing!",
    ],
  };
}

/**
 * Generate Depop-optimized template
 */
function generateDepopTemplate(listing: {
  title: string;
  description: string;
  price: number;
  condition: string;
  itemSpecifics?: Record<string, string>;
}): {
  title: string;
  description: string;
  price: number;
  copyableFields: Record<string, string>;
  instructions: string[];
} {
  // Depop focuses on hashtags and brief descriptions
  const title = listing.title.substring(0, 150);

  // Build hashtag-friendly description
  const specifics = listing.itemSpecifics ?? {};
  let description = listing.description;

  // Add relevant hashtags
  const hashtags: string[] = [];
  if (specifics.brand) hashtags.push(`#${specifics.brand.replace(/\s+/g, "")}`);
  if (specifics.color) hashtags.push(`#${specifics.color.toLowerCase()}`);
  hashtags.push("#vintage", "#thrifted");

  description = `${description}\n\n${hashtags.join(" ")}`;

  // Depop condition mapping
  const conditionMap: Record<string, string> = {
    new: "Brand New",
    like_new: "Like New",
    good: "Good",
    fair: "Fair",
    poor: "Poor",
  };

  return {
    title,
    description: description.substring(0, 1000),
    price: listing.price,
    copyableFields: {
      title,
      description: description.substring(0, 1000),
      brand: specifics.brand ?? "",
      condition: conditionMap[listing.condition] ?? "Good",
      hashtags: hashtags.join(" "),
    },
    instructions: [
      "1. Open Depop app",
      "2. Tap the camera icon to create new listing",
      "3. Upload photos (square format works best)",
      "4. Copy the description from above",
      "5. Add relevant hashtags for discoverability",
      `6. Set price to $${listing.price.toFixed(2)}`,
      "7. Select shipping option",
      "8. List your item",
    ],
  };
}
