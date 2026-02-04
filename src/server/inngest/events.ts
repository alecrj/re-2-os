/**
 * Inngest Event Types
 *
 * Defines all events that can trigger background jobs in ResellerOS.
 * These events are sent by various parts of the application and processed
 * by Inngest functions.
 */

// Channel types for consistency
export type Channel = 'ebay' | 'poshmark' | 'mercari' | 'depop';

// ============ ORDER EVENTS ============

export interface OrderConfirmedEvent {
  data: {
    orderId: string;
    userId: string;
    itemId: string;
    channel: Channel;
    salePrice: number;
  };
}

export interface OrderShippedEvent {
  data: {
    orderId: string;
    userId: string;
    trackingNumber?: string;
    carrier?: string;
  };
}

// ============ AUTOPILOT EVENTS ============

export interface OfferReceivedEvent {
  data: {
    userId: string;
    offerId: string;
    itemId: string;
    channelListingId: string;
    channel: Channel;
    offerAmount: number;
    askingPrice: number;
    floorPrice?: number;
    buyerUsername?: string;
  };
}

export interface RepriceCheckEvent {
  data: {
    userId: string;
    itemId?: string; // Optional: if not provided, check all items for user
  };
}

export interface StaleCheckEvent {
  data: {
    userId: string;
    daysThreshold?: number;
  };
}

// ============ SYNC EVENTS ============

export interface SyncOrdersEvent {
  data: {
    userId: string;
    channel: Channel;
    since?: string; // ISO date string
  };
}

export interface SyncInventoryEvent {
  data: {
    userId: string;
    channel: Channel;
  };
}

// ============ DELIST EVENTS ============

export interface DelistOnSaleEvent {
  data: {
    userId: string;
    itemId: string;
    soldOnChannel: Channel;
    orderId: string;
  };
}

// ============ SCHEDULED EVENTS ============

export interface ScheduledRepriceEvent {
  data: Record<string, never>; // Empty data, runs for all users
}

export interface ScheduledStaleCheckEvent {
  data: Record<string, never>; // Empty data, runs for all users
}

export interface ScheduledSyncEvent {
  data: Record<string, never>; // Empty data, syncs all active connections
}

// ============ COMBINED EVENT MAP ============

export type Events = {
  // Order events
  'order/confirmed': OrderConfirmedEvent;
  'order/shipped': OrderShippedEvent;

  // Autopilot events
  'autopilot/offer-received': OfferReceivedEvent;
  'autopilot/reprice-check': RepriceCheckEvent;
  'autopilot/stale-check': StaleCheckEvent;

  // Sync events
  'sync/orders': SyncOrdersEvent;
  'sync/inventory': SyncInventoryEvent;

  // Delist events
  'autopilot/delist-on-sale': DelistOnSaleEvent;

  // Scheduled events (triggered by cron)
  'scheduled/reprice': ScheduledRepriceEvent;
  'scheduled/stale-check': ScheduledStaleCheckEvent;
  'scheduled/sync': ScheduledSyncEvent;
};
