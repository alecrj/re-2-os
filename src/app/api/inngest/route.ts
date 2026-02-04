/**
 * Inngest API Route
 *
 * This route serves the Inngest handler which:
 * - Registers all functions with Inngest
 * - Receives events from Inngest Cloud
 * - Executes function steps
 *
 * In development, use `npm run inngest:dev` to start the Inngest dev server.
 */

import { serve } from 'inngest/next';
import { inngest, functions } from '@/server/inngest';

/**
 * Create the Inngest handler for Next.js App Router.
 * Exports GET, POST, and PUT handlers for the Inngest protocol.
 */
export const { GET, POST, PUT } = serve({
  client: inngest,
  functions,
});
