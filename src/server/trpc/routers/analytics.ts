import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "../init";
import {
  inventoryItems,
  orders,
} from "@/server/db/schema";
import { eq, and, gte, lte, count, sum, avg, desc } from "drizzle-orm";
import {
  subDays,
  startOfYear,
  startOfDay,
  endOfDay,
  format,
  differenceInDays,
  eachDayOfInterval,
  eachWeekOfInterval,
  eachMonthOfInterval,
} from "date-fns";

// Helper to get date range based on period
function getDateRange(period: string): { start: Date; end: Date } {
  const now = new Date();
  const end = endOfDay(now);

  switch (period) {
    case "7d":
      return { start: startOfDay(subDays(now, 7)), end };
    case "30d":
      return { start: startOfDay(subDays(now, 30)), end };
    case "90d":
      return { start: startOfDay(subDays(now, 90)), end };
    case "ytd":
      return { start: startOfYear(now), end };
    case "all":
      return { start: new Date(0), end };
    default:
      return { start: startOfDay(subDays(now, 30)), end };
  }
}

// Helper to get previous period for comparison
function getPreviousPeriodRange(period: string): { start: Date; end: Date } {
  const { start, end } = getDateRange(period);
  const durationMs = end.getTime() - start.getTime();
  const prevEnd = new Date(start.getTime() - 1);
  const prevStart = new Date(prevEnd.getTime() - durationMs);
  return { start: prevStart, end: prevEnd };
}

// Calculate trend percentage
function calculateTrend(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return ((current - previous) / previous) * 100;
}

export const analyticsRouter = createTRPCRouter({
  /**
   * Get dashboard summary with trends
   */
  dashboard: protectedProcedure
    .input(
      z.object({
        period: z.enum(["7d", "30d", "90d", "ytd", "all"]).default("30d"),
      })
    )
    .query(async ({ ctx, input }) => {
      const userId = ctx.user.id;
      const { start, end } = getDateRange(input.period);
      const { start: prevStart, end: prevEnd } = getPreviousPeriodRange(input.period);

      // Current period stats
      const currentOrders = await ctx.db
        .select({
          totalRevenue: sum(orders.salePrice),
          totalProfit: sum(orders.netProfit),
          totalSold: count(),
          avgSalePrice: avg(orders.salePrice),
        })
        .from(orders)
        .where(
          and(
            eq(orders.userId, userId),
            gte(orders.orderedAt, start),
            lte(orders.orderedAt, end)
          )
        );

      // Previous period stats for comparison
      const prevOrders = await ctx.db
        .select({
          totalRevenue: sum(orders.salePrice),
          totalProfit: sum(orders.netProfit),
          totalSold: count(),
        })
        .from(orders)
        .where(
          and(
            eq(orders.userId, userId),
            gte(orders.orderedAt, prevStart),
            lte(orders.orderedAt, prevEnd)
          )
        );

      // Active listings count
      const activeListingsResult = await ctx.db
        .select({ count: count() })
        .from(inventoryItems)
        .where(
          and(
            eq(inventoryItems.userId, userId),
            eq(inventoryItems.status, "active")
          )
        );

      // Calculate avg days to sell for sold items in period
      const soldItems = await ctx.db
        .select({
          listedAt: inventoryItems.listedAt,
          soldAt: inventoryItems.soldAt,
        })
        .from(inventoryItems)
        .where(
          and(
            eq(inventoryItems.userId, userId),
            eq(inventoryItems.status, "sold"),
            gte(inventoryItems.soldAt, start),
            lte(inventoryItems.soldAt, end)
          )
        );

      let avgDaysToSell = 0;
      if (soldItems.length > 0) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const totalDays = soldItems.reduce((acc: any, item: any) => {
          if (item.listedAt && item.soldAt) {
            return acc + differenceInDays(item.soldAt, item.listedAt);
          }
          return acc;
        }, 0);
        avgDaysToSell = Math.round(totalDays / soldItems.length);
      }

      // Calculate sell-through rate
      // (items sold / items that were active at start of period)
      const totalListedInPeriod = await ctx.db
        .select({ count: count() })
        .from(inventoryItems)
        .where(
          and(
            eq(inventoryItems.userId, userId),
            lte(inventoryItems.createdAt, end)
          )
        );

      const sellThroughRate =
        totalListedInPeriod[0]?.count > 0
          ? ((currentOrders[0]?.totalSold ?? 0) / totalListedInPeriod[0].count) *
            100
          : 0;

      // Extract values
      const totalRevenue = Number(currentOrders[0]?.totalRevenue ?? 0);
      const totalProfit = Number(currentOrders[0]?.totalProfit ?? 0);
      const totalSold = Number(currentOrders[0]?.totalSold ?? 0);
      const prevRevenue = Number(prevOrders[0]?.totalRevenue ?? 0);
      const prevProfit = Number(prevOrders[0]?.totalProfit ?? 0);
      const prevSold = Number(prevOrders[0]?.totalSold ?? 0);

      return {
        totalRevenue,
        totalProfit,
        totalSold,
        avgDaysToSell,
        sellThroughRate: Math.round(sellThroughRate * 10) / 10,
        activeListings: activeListingsResult[0]?.count ?? 0,
        trends: {
          revenue: Math.round(calculateTrend(totalRevenue, prevRevenue) * 10) / 10,
          profit: Math.round(calculateTrend(totalProfit, prevProfit) * 10) / 10,
          sales: Math.round(calculateTrend(totalSold, prevSold) * 10) / 10,
        },
      };
    }),

  /**
   * Get revenue and profit chart data over time
   */
  revenueChart: protectedProcedure
    .input(
      z.object({
        period: z.enum(["7d", "30d", "90d", "ytd"]).default("30d"),
      })
    )
    .query(async ({ ctx, input }) => {
      const userId = ctx.user.id;
      const { start, end } = getDateRange(input.period);

      // Determine grouping interval based on period
      let intervals: Date[];
      let dateFormat: string;

      if (input.period === "7d") {
        intervals = eachDayOfInterval({ start, end });
        dateFormat = "EEE"; // Mon, Tue, etc
      } else if (input.period === "30d") {
        intervals = eachDayOfInterval({ start, end });
        dateFormat = "MMM d"; // Jan 1
      } else if (input.period === "90d") {
        intervals = eachWeekOfInterval({ start, end });
        dateFormat = "MMM d"; // Week of Jan 1
      } else {
        intervals = eachMonthOfInterval({ start, end });
        dateFormat = "MMM"; // Jan, Feb, etc
      }

      // Get all orders in the period
      const orderData = await ctx.db
        .select({
          salePrice: orders.salePrice,
          netProfit: orders.netProfit,
          orderedAt: orders.orderedAt,
        })
        .from(orders)
        .where(
          and(
            eq(orders.userId, userId),
            gte(orders.orderedAt, start),
            lte(orders.orderedAt, end)
          )
        );

      // Group orders by interval
      const chartData = intervals.map((intervalStart, idx) => {
        const intervalEnd =
          idx < intervals.length - 1
            ? intervals[idx + 1]
            : end;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const ordersInInterval = orderData.filter((order: any) => {
          if (!order.orderedAt) return false;
          return order.orderedAt >= intervalStart && order.orderedAt < intervalEnd;
        });

        const revenue = ordersInInterval.reduce(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (sum: any, o: any) => sum + (o.salePrice ?? 0),
          0
        );
        const profit = ordersInInterval.reduce(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (sum: any, o: any) => sum + (o.netProfit ?? 0),
          0
        );
        const sales = ordersInInterval.length;

        return {
          date: format(intervalStart, dateFormat),
          revenue: Math.round(revenue * 100) / 100,
          profit: Math.round(profit * 100) / 100,
          sales,
        };
      });

      return chartData;
    }),

  /**
   * Get sales breakdown by channel
   */
  channelBreakdown: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.user.id;

    const channelData = await ctx.db
      .select({
        channel: orders.channel,
        sales: count(),
        revenue: sum(orders.salePrice),
        profit: sum(orders.netProfit),
        avgPrice: avg(orders.salePrice),
      })
      .from(orders)
      .where(eq(orders.userId, userId))
      .groupBy(orders.channel);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return channelData.map((c: any) => ({
      channel: c.channel,
      sales: Number(c.sales ?? 0),
      revenue: Math.round(Number(c.revenue ?? 0) * 100) / 100,
      profit: Math.round(Number(c.profit ?? 0) * 100) / 100,
      avgPrice: Math.round(Number(c.avgPrice ?? 0) * 100) / 100,
    }));
  }),

  /**
   * Get top performing items
   */
  topItems: protectedProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(50).default(10),
        sortBy: z.enum(["profit", "revenue", "margin"]).default("profit"),
      })
    )
    .query(async ({ ctx, input }) => {
      const userId = ctx.user.id;

      // Get sold items with order data
      const itemsWithOrders = await ctx.db
        .select({
          id: inventoryItems.id,
          title: inventoryItems.title,
          sku: inventoryItems.sku,
          costBasis: inventoryItems.costBasis,
          salePrice: orders.salePrice,
          netProfit: orders.netProfit,
          soldAt: orders.orderedAt,
          channel: orders.channel,
        })
        .from(orders)
        .innerJoin(inventoryItems, eq(orders.itemId, inventoryItems.id))
        .where(eq(orders.userId, userId))
        .limit(500); // Get a larger set to sort properly

      // Calculate margin and sort
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const itemsWithMetrics = itemsWithOrders.map((item: any) => {
        const margin =
          item.salePrice && item.costBasis
            ? ((item.salePrice - item.costBasis) / item.salePrice) * 100
            : 0;

        return {
          id: item.id,
          title: item.title,
          sku: item.sku,
          costBasis: item.costBasis ?? 0,
          salePrice: item.salePrice ?? 0,
          profit: item.netProfit ?? 0,
          margin: Math.round(margin * 10) / 10,
          soldAt: item.soldAt,
          channel: item.channel,
        };
      });

      // Sort by selected metric
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sorted = itemsWithMetrics.sort((a: any, b: any) => {
        switch (input.sortBy) {
          case "profit":
            return b.profit - a.profit;
          case "revenue":
            return b.salePrice - a.salePrice;
          case "margin":
            return b.margin - a.margin;
          default:
            return b.profit - a.profit;
        }
      });

      return sorted.slice(0, input.limit);
    }),

  /**
   * Get inventory value summary
   */
  inventoryValue: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.user.id;

    const activeItems = await ctx.db
      .select({
        totalCost: sum(inventoryItems.costBasis),
        totalAskingPrice: sum(inventoryItems.askingPrice),
        itemCount: count(),
      })
      .from(inventoryItems)
      .where(
        and(
          eq(inventoryItems.userId, userId),
          eq(inventoryItems.status, "active")
        )
      );

    const totalCost = Number(activeItems[0]?.totalCost ?? 0);
    const totalAskingPrice = Number(activeItems[0]?.totalAskingPrice ?? 0);
    const itemCount = Number(activeItems[0]?.itemCount ?? 0);
    const potentialProfit = totalAskingPrice - totalCost;

    return {
      totalCost: Math.round(totalCost * 100) / 100,
      totalAskingPrice: Math.round(totalAskingPrice * 100) / 100,
      potentialProfit: Math.round(potentialProfit * 100) / 100,
      itemCount,
    };
  }),

  /**
   * Get slow-moving inventory (items listed > X days)
   */
  slowMovers: protectedProcedure
    .input(
      z.object({
        daysThreshold: z.number().default(60),
        limit: z.number().min(1).max(50).default(10),
      })
    )
    .query(async ({ ctx, input }) => {
      const userId = ctx.user.id;
      const thresholdDate = subDays(new Date(), input.daysThreshold);

      const slowItems = await ctx.db
        .select({
          id: inventoryItems.id,
          title: inventoryItems.title,
          sku: inventoryItems.sku,
          askingPrice: inventoryItems.askingPrice,
          costBasis: inventoryItems.costBasis,
          listedAt: inventoryItems.listedAt,
        })
        .from(inventoryItems)
        .where(
          and(
            eq(inventoryItems.userId, userId),
            eq(inventoryItems.status, "active"),
            lte(inventoryItems.listedAt, thresholdDate)
          )
        )
        .orderBy(inventoryItems.listedAt)
        .limit(input.limit);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return slowItems.map((item: any) => ({
        id: item.id,
        title: item.title,
        sku: item.sku,
        askingPrice: item.askingPrice,
        costBasis: item.costBasis ?? 0,
        listedAt: item.listedAt,
        daysListed: item.listedAt
          ? differenceInDays(new Date(), item.listedAt)
          : 0,
      }));
    }),

  /**
   * Get inventory aging report
   */
  inventoryAging: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.user.id;
    const now = new Date();
    const thirtyDaysAgo = subDays(now, 30);
    const sixtyDaysAgo = subDays(now, 60);
    const ninetyDaysAgo = subDays(now, 90);

    // Get all active items with listing dates
    const activeItems = await ctx.db
      .select({
        id: inventoryItems.id,
        askingPrice: inventoryItems.askingPrice,
        costBasis: inventoryItems.costBasis,
        listedAt: inventoryItems.listedAt,
      })
      .from(inventoryItems)
      .where(
        and(
          eq(inventoryItems.userId, userId),
          eq(inventoryItems.status, "active")
        )
      );

    // Categorize by age
    const fresh = { count: 0, value: 0 }; // 0-30 days
    const aging = { count: 0, value: 0 }; // 31-60 days
    const stale = { count: 0, value: 0 }; // 61-90 days
    const dead = { count: 0, value: 0 }; // 90+ days

    for (const item of activeItems) {
      const value = item.costBasis ?? item.askingPrice ?? 0;
      const listedAt = item.listedAt ?? now;

      if (listedAt > thirtyDaysAgo) {
        fresh.count++;
        fresh.value += value;
      } else if (listedAt > sixtyDaysAgo) {
        aging.count++;
        aging.value += value;
      } else if (listedAt > ninetyDaysAgo) {
        stale.count++;
        stale.value += value;
      } else {
        dead.count++;
        dead.value += value;
      }
    }

    return {
      fresh: { count: fresh.count, value: Math.round(fresh.value * 100) / 100 },
      aging: { count: aging.count, value: Math.round(aging.value * 100) / 100 },
      stale: { count: stale.count, value: Math.round(stale.value * 100) / 100 },
      dead: { count: dead.count, value: Math.round(dead.value * 100) / 100 },
    };
  }),

  /**
   * Get autopilot performance stats
   */
  autopilotStats: protectedProcedure
    .input(
      z.object({
        period: z.enum(["7d", "30d", "90d"]).default("30d"),
      })
    )
    .query(async ({ ctx, input }) => {
      const userId = ctx.user.id;
      const { start, end } = getDateRange(input.period);

      // Import autopilotActions table dynamically to avoid circular dependency
      const { autopilotActions } = await import("@/server/db/schema");

      // Get all autopilot actions in period
      const actions = await ctx.db
        .select({
          actionType: autopilotActions.actionType,
          status: autopilotActions.status,
          confidence: autopilotActions.confidence,
        })
        .from(autopilotActions)
        .where(
          and(
            eq(autopilotActions.userId, userId),
            gte(autopilotActions.createdAt, start),
            lte(autopilotActions.createdAt, end)
          )
        );

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const executed = actions.filter((a: any) => a.status === "executed");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const undone = actions.filter((a: any) => a.status === "undone");

      return {
        actionsExecuted: executed.length,
        offersAutoAccepted: executed.filter(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (a: any) => a.actionType === "OFFER_ACCEPT"
        ).length,
        offersAutoDeclined: executed.filter(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (a: any) => a.actionType === "OFFER_DECLINE"
        ).length,
        offersAutoCountered: executed.filter(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (a: any) => a.actionType === "OFFER_COUNTER"
        ).length,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        repricesExecuted: executed.filter((a: any) => a.actionType === "REPRICE")
          .length,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        delistsOnSale: executed.filter((a: any) => a.actionType === "DELIST").length,
        undosPerformed: undone.length,
        accuracyRate:
          executed.length > 0
            ? Math.round(
                ((executed.length - undone.length) / executed.length) * 100
              )
            : 100,
      };
    }),

  /**
   * Export sales data as CSV
   */
  exportSalesCSV: protectedProcedure
    .input(
      z.object({
        period: z.enum(["7d", "30d", "90d", "ytd", "all"]).default("all"),
      })
    )
    .query(async ({ ctx, input }) => {
      const userId = ctx.user.id;
      const { start, end } = getDateRange(input.period);

      const salesData = await ctx.db
        .select({
          orderId: orders.id,
          itemTitle: inventoryItems.title,
          sku: inventoryItems.sku,
          channel: orders.channel,
          salePrice: orders.salePrice,
          platformFees: orders.platformFees,
          shippingCost: orders.shippingCost,
          costBasis: inventoryItems.costBasis,
          netProfit: orders.netProfit,
          orderedAt: orders.orderedAt,
          status: orders.status,
        })
        .from(orders)
        .innerJoin(inventoryItems, eq(orders.itemId, inventoryItems.id))
        .where(
          and(
            eq(orders.userId, userId),
            gte(orders.orderedAt, start),
            lte(orders.orderedAt, end)
          )
        )
        .orderBy(desc(orders.orderedAt));

      // Generate CSV content
      const headers = [
        "Order ID",
        "Item Title",
        "SKU",
        "Channel",
        "Sale Price",
        "Platform Fees",
        "Shipping Cost",
        "Cost Basis",
        "Net Profit",
        "Order Date",
        "Status",
      ];

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rows = salesData.map((row: any) => [
        row.orderId,
        `"${(row.itemTitle ?? "").replace(/"/g, '""')}"`,
        row.sku ?? "",
        row.channel,
        row.salePrice?.toFixed(2) ?? "0.00",
        row.platformFees?.toFixed(2) ?? "0.00",
        row.shippingCost?.toFixed(2) ?? "0.00",
        row.costBasis?.toFixed(2) ?? "0.00",
        row.netProfit?.toFixed(2) ?? "0.00",
        row.orderedAt ? format(row.orderedAt, "yyyy-MM-dd") : "",
        row.status,
      ]);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const csv = [headers.join(","), ...rows.map((r: any) => r.join(","))].join(
        "\n"
      );

      return {
        filename: `sales-report-${format(new Date(), "yyyy-MM-dd")}.csv`,
        content: csv,
      };
    }),

  /**
   * Export inventory data as CSV
   */
  exportInventoryCSV: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.user.id;

    const inventoryData = await ctx.db
      .select({
        id: inventoryItems.id,
        sku: inventoryItems.sku,
        title: inventoryItems.title,
        condition: inventoryItems.condition,
        askingPrice: inventoryItems.askingPrice,
        floorPrice: inventoryItems.floorPrice,
        costBasis: inventoryItems.costBasis,
        status: inventoryItems.status,
        quantity: inventoryItems.quantity,
        listedAt: inventoryItems.listedAt,
        createdAt: inventoryItems.createdAt,
      })
      .from(inventoryItems)
      .where(eq(inventoryItems.userId, userId))
      .orderBy(desc(inventoryItems.createdAt));

    // Generate CSV content
    const headers = [
      "ID",
      "SKU",
      "Title",
      "Condition",
      "Asking Price",
      "Floor Price",
      "Cost Basis",
      "Status",
      "Quantity",
      "Listed Date",
      "Created Date",
    ];

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rows = inventoryData.map((row: any) => [
      row.id,
      row.sku,
      `"${(row.title ?? "").replace(/"/g, '""')}"`,
      row.condition,
      row.askingPrice?.toFixed(2) ?? "0.00",
      row.floorPrice?.toFixed(2) ?? "",
      row.costBasis?.toFixed(2) ?? "",
      row.status,
      row.quantity?.toString() ?? "1",
      row.listedAt ? format(row.listedAt, "yyyy-MM-dd") : "",
      row.createdAt ? format(row.createdAt, "yyyy-MM-dd") : "",
    ]);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const csv = [headers.join(","), ...rows.map((r: any) => r.join(","))].join("\n");

    return {
      filename: `inventory-report-${format(new Date(), "yyyy-MM-dd")}.csv`,
      content: csv,
    };
  }),

  /**
   * Export profit report as CSV
   */
  exportProfitCSV: protectedProcedure
    .input(
      z.object({
        period: z.enum(["7d", "30d", "90d", "ytd", "all"]).default("30d"),
      })
    )
    .query(async ({ ctx, input }) => {
      const userId = ctx.user.id;
      const { start, end } = getDateRange(input.period);

      const profitData = await ctx.db
        .select({
          itemTitle: inventoryItems.title,
          sku: inventoryItems.sku,
          channel: orders.channel,
          costBasis: inventoryItems.costBasis,
          salePrice: orders.salePrice,
          platformFees: orders.platformFees,
          shippingCost: orders.shippingCost,
          netProfit: orders.netProfit,
          orderedAt: orders.orderedAt,
        })
        .from(orders)
        .innerJoin(inventoryItems, eq(orders.itemId, inventoryItems.id))
        .where(
          and(
            eq(orders.userId, userId),
            gte(orders.orderedAt, start),
            lte(orders.orderedAt, end)
          )
        )
        .orderBy(desc(orders.orderedAt));

      // Calculate totals
      const totalRevenue = profitData.reduce(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (sum: any, r: any) => sum + (r.salePrice ?? 0),
        0
      );
      const totalCost = profitData.reduce(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (sum: any, r: any) => sum + (r.costBasis ?? 0),
        0
      );
      const totalFees = profitData.reduce(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (sum: any, r: any) => sum + (r.platformFees ?? 0) + (r.shippingCost ?? 0),
        0
      );
      const totalProfit = profitData.reduce(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (sum: any, r: any) => sum + (r.netProfit ?? 0),
        0
      );

      // Generate CSV content
      const headers = [
        "Item Title",
        "SKU",
        "Channel",
        "Cost Basis",
        "Sale Price",
        "Platform Fees",
        "Shipping Cost",
        "Net Profit",
        "Margin %",
        "Sale Date",
      ];

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rows = profitData.map((row: any) => {
        const margin =
          row.salePrice && row.salePrice > 0
            ? (((row.netProfit ?? 0) / row.salePrice) * 100).toFixed(1)
            : "0.0";
        return [
          `"${(row.itemTitle ?? "").replace(/"/g, '""')}"`,
          row.sku ?? "",
          row.channel,
          row.costBasis?.toFixed(2) ?? "0.00",
          row.salePrice?.toFixed(2) ?? "0.00",
          row.platformFees?.toFixed(2) ?? "0.00",
          row.shippingCost?.toFixed(2) ?? "0.00",
          row.netProfit?.toFixed(2) ?? "0.00",
          margin,
          row.orderedAt ? format(row.orderedAt, "yyyy-MM-dd") : "",
        ];
      });

      // Add summary row
      const summaryRow = [
        '"TOTALS"',
        "",
        "",
        totalCost.toFixed(2),
        totalRevenue.toFixed(2),
        totalFees.toFixed(2),
        "",
        totalProfit.toFixed(2),
        totalRevenue > 0
          ? ((totalProfit / totalRevenue) * 100).toFixed(1)
          : "0.0",
        "",
      ];

      const csv = [
        headers.join(","),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ...rows.map((r: any) => r.join(",")),
        "",
        summaryRow.join(","),
      ].join("\n");

      return {
        filename: `profit-report-${format(new Date(), "yyyy-MM-dd")}.csv`,
        content: csv,
      };
    }),
});
