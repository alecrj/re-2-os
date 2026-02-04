/**
 * Inngest Functions Index
 *
 * Exports all Inngest functions to be registered with the Inngest handler.
 * Add new functions to this array as they are created.
 */

import { delistOnSale } from './delist-on-sale';
import { handleOffer } from './handle-offer';
import { repriceCheck, scheduledRepriceCheck } from './reprice-check';
import { staleCheck, scheduledStaleCheck } from './stale-check';
import { syncOrders } from './sync-orders';

/**
 * All Inngest functions for ResellerOS.
 * This array is passed to the Inngest serve() handler.
 */
export const functions = [
  // Autopilot functions
  delistOnSale,
  handleOffer,
  repriceCheck,
  scheduledRepriceCheck,
  staleCheck,
  scheduledStaleCheck,

  // Sync functions
  syncOrders,
];
