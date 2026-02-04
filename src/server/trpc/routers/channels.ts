import { z } from "zod";
import { createTRPCRouter, publicProcedure, protectedProcedure } from "../init";

export const channelsRouter = createTRPCRouter({
  /**
   * Get all connected channels for the current user
   */
  listConnections: publicProcedure.query(async ({ ctx: _ctx }) => {
    // TODO: Implement actual database query
    return [];
  }),

  /**
   * Get connection status for a specific channel
   */
  getConnectionStatus: publicProcedure
    .input(
      z.object({
        channel: z.enum(["ebay", "poshmark", "mercari", "depop"]),
      })
    )
    .query(async ({ input: _input, ctx: _ctx }) => {
      // TODO: Implement connection status check
      return {
        connected: false,
        status: "disconnected" as const,
        externalUsername: null,
        lastSyncAt: null,
      };
    }),

  /**
   * Get OAuth URL for connecting a channel
   */
  getAuthUrl: protectedProcedure
    .input(
      z.object({
        channel: z.enum(["ebay"]), // Only eBay has native OAuth
      })
    )
    .mutation(async ({ input: _input, ctx: _ctx }) => {
      // TODO: Implement OAuth URL generation
      return { url: "" };
    }),

  /**
   * Handle OAuth callback
   */
  handleCallback: protectedProcedure
    .input(
      z.object({
        channel: z.enum(["ebay"]),
        code: z.string(),
      })
    )
    .mutation(async ({ input: _input, ctx: _ctx }) => {
      // TODO: Implement OAuth token exchange
      return { success: true };
    }),

  /**
   * Disconnect a channel
   */
  disconnect: protectedProcedure
    .input(
      z.object({
        channel: z.enum(["ebay", "poshmark", "mercari", "depop"]),
      })
    )
    .mutation(async ({ input: _input, ctx: _ctx }) => {
      // TODO: Implement channel disconnection
      return { success: true };
    }),

  /**
   * Get channel capabilities
   */
  getCapabilities: publicProcedure
    .input(
      z.object({
        channel: z.enum(["ebay", "poshmark", "mercari", "depop"]),
      })
    )
    .query(async ({ input }) => {
      const capabilities = {
        ebay: {
          mode: "native" as const,
          canPublish: true,
          canReprice: true,
          canDelist: true,
          canSyncOrders: true,
          canSyncInventory: true,
          requiresManualAction: false,
        },
        poshmark: {
          mode: "assisted" as const,
          canPublish: false,
          canReprice: false,
          canDelist: false,
          canSyncOrders: false,
          canSyncInventory: false,
          requiresManualAction: true,
        },
        mercari: {
          mode: "assisted" as const,
          canPublish: false,
          canReprice: false,
          canDelist: false,
          canSyncOrders: false,
          canSyncInventory: false,
          requiresManualAction: true,
        },
        depop: {
          mode: "assisted" as const,
          canPublish: false,
          canReprice: false,
          canDelist: false,
          canSyncOrders: false,
          canSyncInventory: false,
          requiresManualAction: true,
        },
      };

      return capabilities[input.channel];
    }),
});
