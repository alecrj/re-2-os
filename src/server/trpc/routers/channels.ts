import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "../init";
import { TRPCError } from "@trpc/server";
import { db } from "@/server/db/client";
import { channelConnections } from "@/server/db/schema";
import { eq, and } from "drizzle-orm";
import { getEbayAdapter } from "@/server/services/channels/ebay";

const ChannelEnum = z.enum(["ebay", "poshmark", "mercari", "depop"]);
type Channel = z.infer<typeof ChannelEnum>;

export const channelsRouter = createTRPCRouter({
  /**
   * Get all connected channels for the current user
   */
  listConnections: protectedProcedure.query(async ({ ctx }) => {
    const connections = await db
      .select({
        id: channelConnections.id,
        channel: channelConnections.channel,
        status: channelConnections.status,
        externalUsername: channelConnections.externalUsername,
        lastSyncAt: channelConnections.lastSyncAt,
        createdAt: channelConnections.createdAt,
      })
      .from(channelConnections)
      .where(eq(channelConnections.userId, ctx.session.user.id));

    return connections;
  }),

  /**
   * Get connection status for a specific channel
   */
  getConnectionStatus: protectedProcedure
    .input(
      z.object({
        channel: ChannelEnum,
      })
    )
    .query(async ({ input, ctx }) => {
      const connection = await db
        .select()
        .from(channelConnections)
        .where(
          and(
            eq(channelConnections.userId, ctx.session.user.id),
            eq(channelConnections.channel, input.channel)
          )
        )
        .limit(1);

      if (connection.length === 0) {
        return {
          connected: false,
          status: "disconnected" as const,
          externalUsername: null,
          lastSyncAt: null,
        };
      }

      const conn = connection[0];
      const isExpired = conn.tokenExpiresAt && conn.tokenExpiresAt < new Date();

      return {
        connected: conn.status === "active" && !isExpired,
        status: isExpired ? ("expired" as const) : (conn.status as "active" | "expired" | "revoked"),
        externalUsername: conn.externalUsername,
        lastSyncAt: conn.lastSyncAt,
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
    .mutation(async ({ input, ctx }) => {
      if (input.channel === "ebay") {
        const adapter = getEbayAdapter();
        const url = await adapter.getAuthUrl(ctx.session.user.id);
        return { url };
      }

      throw new TRPCError({
        code: "BAD_REQUEST",
        message: `OAuth not supported for ${input.channel}`,
      });
    }),

  /**
   * Handle OAuth callback - exchange code for tokens
   */
  handleCallback: protectedProcedure
    .input(
      z.object({
        channel: z.enum(["ebay"]),
        code: z.string(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      if (input.channel === "ebay") {
        try {
          const adapter = getEbayAdapter();
          await adapter.handleCallback(ctx.session.user.id, input.code);
          return { success: true };
        } catch (error) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: error instanceof Error ? error.message : "Failed to connect eBay account",
          });
        }
      }

      throw new TRPCError({
        code: "BAD_REQUEST",
        message: `OAuth not supported for ${input.channel}`,
      });
    }),

  /**
   * Disconnect a channel
   */
  disconnect: protectedProcedure
    .input(
      z.object({
        channel: ChannelEnum,
      })
    )
    .mutation(async ({ input, ctx }) => {
      // Find the connection
      const connection = await db
        .select()
        .from(channelConnections)
        .where(
          and(
            eq(channelConnections.userId, ctx.session.user.id),
            eq(channelConnections.channel, input.channel)
          )
        )
        .limit(1);

      if (connection.length === 0) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `No ${input.channel} connection found`,
        });
      }

      // Update status to revoked (keep record for audit purposes)
      await db
        .update(channelConnections)
        .set({
          status: "revoked",
          accessToken: null,
          refreshToken: null,
        })
        .where(eq(channelConnections.id, connection[0].id));

      return { success: true };
    }),

  /**
   * Refresh channel connection tokens
   */
  refreshConnection: protectedProcedure
    .input(
      z.object({
        channel: z.enum(["ebay"]),
      })
    )
    .mutation(async ({ input, ctx }) => {
      if (input.channel === "ebay") {
        try {
          const adapter = getEbayAdapter();
          await adapter.refreshToken(ctx.session.user.id);
          return { success: true };
        } catch (error) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: error instanceof Error ? error.message : "Failed to refresh connection",
          });
        }
      }

      throw new TRPCError({
        code: "BAD_REQUEST",
        message: `Token refresh not supported for ${input.channel}`,
      });
    }),

  /**
   * Get channel capabilities
   */
  getCapabilities: protectedProcedure
    .input(
      z.object({
        channel: ChannelEnum,
      })
    )
    .query(async ({ input }) => {
      const capabilities: Record<Channel, {
        mode: "native" | "assisted";
        canPublish: boolean;
        canReprice: boolean;
        canDelist: boolean;
        canSyncOrders: boolean;
        canSyncInventory: boolean;
        requiresManualAction: boolean;
      }> = {
        ebay: {
          mode: "native",
          canPublish: true,
          canReprice: true,
          canDelist: true,
          canSyncOrders: true,
          canSyncInventory: true,
          requiresManualAction: false,
        },
        poshmark: {
          mode: "assisted",
          canPublish: false,
          canReprice: false,
          canDelist: false,
          canSyncOrders: false,
          canSyncInventory: false,
          requiresManualAction: true,
        },
        mercari: {
          mode: "assisted",
          canPublish: false,
          canReprice: false,
          canDelist: false,
          canSyncOrders: false,
          canSyncInventory: false,
          requiresManualAction: true,
        },
        depop: {
          mode: "assisted",
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
