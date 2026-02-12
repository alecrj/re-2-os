"use client";

import {
  DollarSign,
  Package,
  ShoppingCart,
  Zap,
  TrendingUp,
  TrendingDown,
  AlertCircle,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc/client";

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(value);
}

function TrendBadge({ value }: { value: number }) {
  if (value === 0) return null;
  const isPositive = value > 0;
  return (
    <span
      className={`inline-flex items-center gap-0.5 text-xs font-medium ${
        isPositive ? "text-green-600" : "text-red-600"
      }`}
    >
      {isPositive ? (
        <TrendingUp className="h-3 w-3" />
      ) : (
        <TrendingDown className="h-3 w-3" />
      )}
      {Math.abs(value).toFixed(1)}%
    </span>
  );
}

export default function DashboardPage() {
  const { data: analytics, isLoading: analyticsLoading } =
    trpc.analytics.dashboard.useQuery({ period: "30d" });
  const { data: pendingActions, isLoading: pendingLoading } =
    trpc.autopilot.getPendingCount.useQuery();
  const { data: orderStats, isLoading: ordersLoading } =
    trpc.orders.getStats.useQuery();
  const { data: inventoryStats, isLoading: inventoryLoading } =
    trpc.inventory.getStats.useQuery();
  const { data: recentActions, isLoading: actionsLoading } =
    trpc.autopilot.getRecentActions.useQuery({ limit: 5 });

  const needsShipment =
    orderStats?.counts?.paid ?? 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">
          Your reselling business at a glance
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        {/* Revenue */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Revenue (30d)</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {analyticsLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <>
                <div className="text-2xl font-bold">
                  {formatCurrency(analytics?.totalRevenue ?? 0)}
                </div>
                {analytics?.trends && (
                  <TrendBadge value={analytics.trends.revenue} />
                )}
              </>
            )}
          </CardContent>
        </Card>

        {/* Items Sold */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Sold (30d)</CardTitle>
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {analyticsLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <>
                <div className="text-2xl font-bold">
                  {analytics?.totalSold ?? 0}
                </div>
                {analytics?.trends && (
                  <TrendBadge value={analytics.trends.sales} />
                )}
              </>
            )}
          </CardContent>
        </Card>

        {/* Active Listings */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Listings</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {inventoryLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="text-2xl font-bold">
                {inventoryStats?.active ?? 0}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Profit */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Profit (30d)</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {analyticsLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <>
                <div className="text-2xl font-bold">
                  {formatCurrency(analytics?.totalProfit ?? 0)}
                </div>
                {analytics?.trends && (
                  <TrendBadge value={analytics.trends.profit} />
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Action Items */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Needs Attention */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5" />
              Needs Attention
            </CardTitle>
            <CardDescription>Items requiring your action</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm">Pending autopilot actions</span>
                {pendingLoading ? (
                  <Skeleton className="h-5 w-8" />
                ) : (
                  <Badge variant={pendingActions?.count ? "destructive" : "secondary"}>
                    {pendingActions?.count ?? 0}
                  </Badge>
                )}
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Orders to ship</span>
                {ordersLoading ? (
                  <Skeleton className="h-5 w-8" />
                ) : (
                  <Badge variant={needsShipment > 0 ? "destructive" : "secondary"}>
                    {needsShipment}
                  </Badge>
                )}
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Draft items</span>
                {inventoryLoading ? (
                  <Skeleton className="h-5 w-8" />
                ) : (
                  <Badge variant="secondary">
                    {inventoryStats?.draft ?? 0}
                  </Badge>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5" />
              Recent Autopilot Activity
            </CardTitle>
            <CardDescription>Latest automated actions</CardDescription>
          </CardHeader>
          <CardContent>
            {actionsLoading ? (
              <div className="space-y-3">
                {[...Array(3)].map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : recentActions && recentActions.length > 0 ? (
              <div className="space-y-3">
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                {recentActions.map((action: any) => (
                  <div
                    key={action.id}
                    className="flex items-center justify-between text-sm"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-medium truncate">
                        {action.actionType.replace(/_/g, " ")}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {action.item?.title ?? "Unknown item"}
                      </p>
                    </div>
                    <Badge
                      variant={
                        action.status === "executed"
                          ? "default"
                          : action.status === "pending"
                          ? "secondary"
                          : "outline"
                      }
                      className="ml-2 shrink-0"
                    >
                      {action.status}
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                No recent autopilot activity
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick Stats Row */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Avg Days to Sell</CardTitle>
          </CardHeader>
          <CardContent>
            {analyticsLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="text-2xl font-bold">
                {analytics?.avgDaysToSell ?? 0}
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Sell-Through Rate</CardTitle>
          </CardHeader>
          <CardContent>
            {analyticsLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="text-2xl font-bold">
                {analytics?.sellThroughRate ?? 0}%
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Inventory</CardTitle>
          </CardHeader>
          <CardContent>
            {inventoryLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="text-2xl font-bold">
                {inventoryStats?.total ?? 0}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
