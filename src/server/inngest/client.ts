/**
 * Inngest Client
 *
 * Central client for sending and receiving Inngest events.
 * All background jobs in ResellerOS are powered by Inngest.
 */

import { Inngest, EventSchemas } from 'inngest';
import type { Events } from './events';

/**
 * The Inngest client instance.
 *
 * Use this to:
 * - Send events: `inngest.send({ name: 'order/confirmed', data: {...} })`
 * - Define functions that respond to events
 */
export const inngest = new Inngest({
  id: 'reselleros',
  schemas: new EventSchemas().fromRecord<Events>(),
});
