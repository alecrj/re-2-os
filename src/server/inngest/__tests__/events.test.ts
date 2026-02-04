/**
 * Tests for Inngest Event Types
 *
 * These tests verify the type exports are correct.
 * TypeScript compilation will catch type errors.
 */

import { describe, it, expect } from 'vitest';
import type {
  Events,
  Channel,
  OrderConfirmedEvent,
  OfferReceivedEvent,
  RepriceCheckEvent,
  SyncOrdersEvent,
  DelistOnSaleEvent,
} from '../events';

describe('Event Types', () => {
  describe('Channel type', () => {
    it('should accept valid channel values', () => {
      const ebay: Channel = 'ebay';
      const poshmark: Channel = 'poshmark';
      const mercari: Channel = 'mercari';
      const depop: Channel = 'depop';

      expect(ebay).toBe('ebay');
      expect(poshmark).toBe('poshmark');
      expect(mercari).toBe('mercari');
      expect(depop).toBe('depop');
    });
  });

  describe('OrderConfirmedEvent', () => {
    it('should have correct structure', () => {
      const event: OrderConfirmedEvent = {
        data: {
          orderId: 'order-123',
          userId: 'user-456',
          itemId: 'item-789',
          channel: 'ebay',
          salePrice: 99.99,
        },
      };

      expect(event.data.orderId).toBe('order-123');
      expect(event.data.channel).toBe('ebay');
      expect(event.data.salePrice).toBe(99.99);
    });
  });

  describe('OfferReceivedEvent', () => {
    it('should have correct structure', () => {
      const event: OfferReceivedEvent = {
        data: {
          userId: 'user-123',
          offerId: 'offer-456',
          itemId: 'item-789',
          channelListingId: 'listing-123',
          channel: 'ebay',
          offerAmount: 80,
          askingPrice: 100,
          floorPrice: 70,
          buyerUsername: 'buyer123',
        },
      };

      expect(event.data.offerAmount).toBe(80);
      expect(event.data.askingPrice).toBe(100);
      expect(event.data.floorPrice).toBe(70);
    });

    it('should allow optional fields to be undefined', () => {
      const event: OfferReceivedEvent = {
        data: {
          userId: 'user-123',
          offerId: 'offer-456',
          itemId: 'item-789',
          channelListingId: 'listing-123',
          channel: 'ebay',
          offerAmount: 80,
          askingPrice: 100,
        },
      };

      expect(event.data.floorPrice).toBeUndefined();
      expect(event.data.buyerUsername).toBeUndefined();
    });
  });

  describe('RepriceCheckEvent', () => {
    it('should have correct structure', () => {
      const event: RepriceCheckEvent = {
        data: {
          userId: 'user-123',
          itemId: 'item-456',
        },
      };

      expect(event.data.userId).toBe('user-123');
      expect(event.data.itemId).toBe('item-456');
    });

    it('should allow itemId to be undefined', () => {
      const event: RepriceCheckEvent = {
        data: {
          userId: 'user-123',
        },
      };

      expect(event.data.itemId).toBeUndefined();
    });
  });

  describe('SyncOrdersEvent', () => {
    it('should have correct structure', () => {
      const event: SyncOrdersEvent = {
        data: {
          userId: 'user-123',
          channel: 'ebay',
          since: '2024-01-01T00:00:00Z',
        },
      };

      expect(event.data.channel).toBe('ebay');
      expect(event.data.since).toBe('2024-01-01T00:00:00Z');
    });
  });

  describe('DelistOnSaleEvent', () => {
    it('should have correct structure', () => {
      const event: DelistOnSaleEvent = {
        data: {
          userId: 'user-123',
          itemId: 'item-456',
          soldOnChannel: 'ebay',
          orderId: 'order-789',
        },
      };

      expect(event.data.soldOnChannel).toBe('ebay');
      expect(event.data.orderId).toBe('order-789');
    });
  });

  describe('Events type', () => {
    it('should map event names to event types', () => {
      // Type-level test - TypeScript will fail compilation if incorrect
      type _OrderConfirmedEventType = Events['order/confirmed'];
      type _OfferReceivedEventType = Events['autopilot/offer-received'];

      // Runtime check that these are object types
      const eventNames: (keyof Events)[] = [
        'order/confirmed',
        'order/shipped',
        'autopilot/offer-received',
        'autopilot/reprice-check',
        'autopilot/stale-check',
        'autopilot/delist-on-sale',
        'sync/orders',
        'sync/inventory',
        'scheduled/reprice',
        'scheduled/stale-check',
        'scheduled/sync',
      ];

      expect(eventNames).toHaveLength(11);
    });
  });
});
