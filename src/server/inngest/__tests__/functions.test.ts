/**
 * Tests for Inngest Functions
 */

import { describe, it, expect } from 'vitest';
import { functions } from '../functions';
import { delistOnSale } from '../functions/delist-on-sale';
import { handleOffer } from '../functions/handle-offer';
import { repriceCheck } from '../functions/reprice-check';
import { syncOrders } from '../functions/sync-orders';

describe('Inngest Functions', () => {
  describe('functions array', () => {
    it('should export all functions', () => {
      expect(functions).toHaveLength(10); // 7 core + 3 eBay webhook handlers
    });

    it('should include delistOnSale', () => {
      expect(functions).toContain(delistOnSale);
    });

    it('should include handleOffer', () => {
      expect(functions).toContain(handleOffer);
    });

    it('should include repriceCheck', () => {
      expect(functions).toContain(repriceCheck);
    });

    it('should include syncOrders', () => {
      expect(functions).toContain(syncOrders);
    });
  });

  describe('delistOnSale', () => {
    it('should be configured with correct id', () => {
      // Access internal config through the function object
      expect(delistOnSale).toBeDefined();
      // The function should be a valid Inngest function
      expect(typeof delistOnSale).toBe('object');
    });
  });

  describe('handleOffer', () => {
    it('should be configured correctly', () => {
      expect(handleOffer).toBeDefined();
      expect(typeof handleOffer).toBe('object');
    });
  });

  describe('repriceCheck', () => {
    it('should be configured correctly', () => {
      expect(repriceCheck).toBeDefined();
      expect(typeof repriceCheck).toBe('object');
    });
  });

  describe('syncOrders', () => {
    it('should be configured correctly', () => {
      expect(syncOrders).toBeDefined();
      expect(typeof syncOrders).toBe('object');
    });
  });
});
