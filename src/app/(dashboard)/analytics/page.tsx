"use client";

import { useState } from "react";
import {
  DollarSign,
  TrendingUp,
  ShoppingCart,
  Clock,
  Percent,
  Package,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  StatsCard,
  RevenueChart,
  ChannelChart,
  TopItemsTable,
  SlowMoversTable,
  InventoryValueCard,
  ExportButton,
} from "@/components/analytics";
import { trpc } from "@/lib/trpc/client";

type Period = "7d" | "30d" | "90d" | "ytd" | "all";
type SortBy = "profit" | "revenue" | "margin";

const PERIOD_LABELS: Record<Period, string> = {
  "7d": "Last 7 Days",
  "30d": "Last 30 Days",
  "90d": "Last 90 Days",
  ytd: "Year to Date",
  all: "All Time",
};

export default function AnalyticsPage() {
  const [period, setPeriod] = useState<Period>("30d");
  const [topItemsSort, setTopItemsSort] = useState<SortBy>("profit");

  // Fetch all analytics data
  const dashboardQuery = trpc.analytics.dashboard.useQuery({ period });
  const revenueChartQuery = trpc.analytics.revenueChart.useQuery({
    period: period === "all" ? "ytd" : period,
  });
  const channelQuery = trpc.analytics.channelBreakdown.useQuery();
  const topItemsQuery = trpc.analytics.topItems.useQuery({
    limit: 10,
    sortBy: topItemsSort,
  });
  const slowMoversQuery = trpc.analytics.slowMovers.useQuery({
    daysThreshold: 60,
    limit: 10,
  });
  const inventoryValueQuery = trpc.analytics.inventoryValue.useQuery();

  const dashboard = dashboardQuery.data;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Analytics</h1>
          <p className="text-muted-foreground">
            Track your performance and profit margins
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={period} onValueChange={(v) => setPeriod(v as Period)}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Select period" />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(PERIOD_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <ExportButton period={period} />
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <StatsCard
          title="Total Revenue"
          value={dashboard?.totalRevenue ?? 0}
          trend={dashboard?.trends.revenue}
          trendLabel="vs prev period"
          format="currency"
          loading={dashboardQuery.isLoading}
          icon={<DollarSign className="h-4 w-4 text-muted-foreground" />}
        />
        <StatsCard
          title="Total Profit"
          value={dashboard?.totalProfit ?? 0}
          trend={dashboard?.trends.profit}
          trendLabel="vs prev period"
          format="currency"
          loading={dashboardQuery.isLoading}
          icon={<TrendingUp className="h-4 w-4 text-muted-foreground" />}
        />
        <StatsCard
          title="Items Sold"
          value={dashboard?.totalSold ?? 0}
          trend={dashboard?.trends.sales}
          trendLabel="vs prev period"
          format="number"
          loading={dashboardQuery.isLoading}
          icon={<ShoppingCart className="h-4 w-4 text-muted-foreground" />}
        />
        <StatsCard
          title="Avg Days to Sell"
          value={dashboard?.avgDaysToSell ?? 0}
          format="number"
          loading={dashboardQuery.isLoading}
          icon={<Clock className="h-4 w-4 text-muted-foreground" />}
        />
        <StatsCard
          title="Sell-Through Rate"
          value={dashboard?.sellThroughRate ?? 0}
          format="percent"
          loading={dashboardQuery.isLoading}
          icon={<Percent className="h-4 w-4 text-muted-foreground" />}
        />
        <StatsCard
          title="Active Listings"
          value={dashboard?.activeListings ?? 0}
          format="number"
          loading={dashboardQuery.isLoading}
          icon={<Package className="h-4 w-4 text-muted-foreground" />}
        />
      </div>

      {/* Charts Section */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="inventory">Inventory</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          {/* Charts Row */}
          <div className="grid gap-4 lg:grid-cols-2">
            <RevenueChart
              data={revenueChartQuery.data ?? []}
              loading={revenueChartQuery.isLoading}
            />
            <ChannelChart
              data={channelQuery.data ?? []}
              loading={channelQuery.isLoading}
            />
          </div>

          {/* Top Items Table */}
          <TopItemsTable
            data={topItemsQuery.data ?? []}
            loading={topItemsQuery.isLoading}
            sortBy={topItemsSort}
            onSortChange={setTopItemsSort}
          />
        </TabsContent>

        <TabsContent value="inventory" className="space-y-4">
          {/* Inventory Value Card */}
          <InventoryValueCard
            data={inventoryValueQuery.data}
            loading={inventoryValueQuery.isLoading}
          />

          {/* Slow Movers Table */}
          <SlowMoversTable
            data={slowMoversQuery.data ?? []}
            loading={slowMoversQuery.isLoading}
            daysThreshold={60}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
