import { createTRPCRouter } from "./init";
import { inventoryRouter } from "./routers/inventory";
import { listingsRouter } from "./routers/listings";
import { ordersRouter } from "./routers/orders";
import { channelsRouter } from "./routers/channels";
import { autopilotRouter } from "./routers/autopilot";
import { analyticsRouter } from "./routers/analytics";
import { imagesRouter } from "./routers/images";
import { aiRouter } from "./routers/ai";
import { auditRouter } from "./routers/audit";
import { settingsRouter } from "./routers/settings";

/**
 * This is the primary router for the server.
 *
 * All routers added in /server/trpc/routers should be manually added here.
 */
export const appRouter = createTRPCRouter({
  inventory: inventoryRouter,
  listings: listingsRouter,
  orders: ordersRouter,
  channels: channelsRouter,
  autopilot: autopilotRouter,
  analytics: analyticsRouter,
  images: imagesRouter,
  ai: aiRouter,
  audit: auditRouter,
  settings: settingsRouter,
});

// Export type definition of API
export type AppRouter = typeof appRouter;
