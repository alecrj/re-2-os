import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "../init";
import {
  notificationPreferences,
  DEFAULT_NOTIFICATION_PREFS,
  type NotificationPrefs,
} from "@/server/db/schema";
import { eq } from "drizzle-orm";

const notificationChannelSchema = z.object({
  inApp: z.boolean(),
  email: z.boolean(),
});

const notificationPrefsSchema = z.object({
  offerReceived: notificationChannelSchema,
  offerAutoActioned: notificationChannelSchema,
  saleConfirmed: notificationChannelSchema,
  delistAlert: notificationChannelSchema,
  repriceAlert: notificationChannelSchema,
  staleListingAlert: notificationChannelSchema,
  syncError: notificationChannelSchema,
});

export const settingsRouter = createTRPCRouter({
  /**
   * Get notification preferences for the current user
   */
  getNotificationPrefs: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.user.id;

    const result = await ctx.db.query.notificationPreferences.findFirst({
      where: eq(notificationPreferences.userId, userId),
    });

    if (!result) {
      return DEFAULT_NOTIFICATION_PREFS;
    }

    return result.preferences as NotificationPrefs;
  }),

  /**
   * Update notification preferences for the current user
   */
  updateNotificationPrefs: protectedProcedure
    .input(notificationPrefsSchema)
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.user.id;
      const now = new Date();

      const existing = await ctx.db.query.notificationPreferences.findFirst({
        where: eq(notificationPreferences.userId, userId),
      });

      if (existing) {
        await ctx.db
          .update(notificationPreferences)
          .set({
            preferences: input,
            updatedAt: now,
          })
          .where(eq(notificationPreferences.id, existing.id));
      } else {
        await ctx.db.insert(notificationPreferences).values({
          id: crypto.randomUUID(),
          userId,
          preferences: input,
          updatedAt: now,
        });
      }

      return { success: true };
    }),
});
