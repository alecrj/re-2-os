"use client";

import { useState } from "react";
import {
  RefreshCw,
  Plus,
  DollarSign,
  TrendingUp,
  Loader2,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { trpc } from "@/lib/trpc/client";
import {
  OrdersTable,
  OrderDetailDialog,
  RecordSaleDialog,
} from "@/components/orders";
import { type Channel, type OrderStatus } from "@/lib/constants";

function formatCurrency(amount: number | null | undefined): string {
  if (amount === null || amount === undefined) return "$0.00";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
}

export default function OrdersPage() {
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<OrderStatus | "all">("all");
  const [channelFilter, setChannelFilter] = useState<Channel | "all">("all");
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [isRecordSaleOpen, setIsRecordSaleOpen] = useState(false);

  const utils = trpc.useUtils();

  // Fetch orders
  const ordersQuery = trpc.orders.list.useQuery({
    page,
    limit: 25,
    status: statusFilter === "all" ? undefined : statusFilter,
    channel: channelFilter === "all" ? undefined : channelFilter,
  });

  // Fetch stats
  const statsQuery = trpc.orders.getStats.useQuery();

  // Fetch order detail when selected
  const orderDetailQuery = trpc.orders.getById.useQuery(
    { id: selectedOrderId! },
    { enabled: !!selectedOrderId }
  );

  // Fetch active inventory items for record sale dialog
  const inventoryQuery = trpc.inventory.list.useQuery(
    { status: "active", limit: 100 },
    { enabled: isRecordSaleOpen }
  );

  // Sync from eBay mutation
  const syncMutation = trpc.orders.syncFromEbay.useMutation({
    onSuccess: () => {
      utils.orders.list.invalidate();
      utils.orders.getStats.invalidate();
      // TODO: Show success toast with sync results
    },
  });

  // Mark shipped mutation
  const markShippedMutation = trpc.orders.markShipped.useMutation({
    onSuccess: () => {
      utils.orders.list.invalidate();
      utils.orders.getStats.invalidate();
      if (selectedOrderId) {
        utils.orders.getById.invalidate({ id: selectedOrderId });
      }
    },
  });

  // Record sale mutation
  const recordSaleMutation = trpc.orders.recordSale.useMutation({
    onSuccess: () => {
      utils.orders.list.invalidate();
      utils.orders.getStats.invalidate();
      utils.inventory.list.invalidate();
    },
  });

  const stats = statsQuery.data?.counts ?? {
    pending: 0,
    paid: 0,
    shipped: 0,
    delivered: 0,
    returned: 0,
    cancelled: 0,
  };

  const handleOrderClick = (order: { id: string }) => {
    setSelectedOrderId(order.id);
  };

  const handleMarkShipped = async (data: {
    orderId: string;
    trackingNumber: string;
    carrier: string;
    shippingCost?: number;
  }) => {
    await markShippedMutation.mutateAsync({
      orderId: data.orderId,
      trackingNumber: data.trackingNumber,
      carrier: data.carrier as "usps" | "ups" | "fedex" | "dhl" | "other",
      shippingCost: data.shippingCost,
    });
  };

  const handleRecordSale = async (data: {
    itemId: string;
    channel: Channel;
    salePrice: number;
    platformFees?: number;
    shippingCost?: number;
    buyerUsername?: string;
  }) => {
    const result = await recordSaleMutation.mutateAsync({
      itemId: data.itemId,
      channel: data.channel as "poshmark" | "mercari" | "depop",
      salePrice: data.salePrice,
      platformFees: data.platformFees,
      shippingCost: data.shippingCost,
      buyerUsername: data.buyerUsername,
    });
    // Delist notifications are now handled automatically by the delist-on-sale Inngest function
    return { orderId: result.id, netProfit: result.netProfit };
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Orders</h1>
          <p className="text-muted-foreground">
            Track your sales and manage orders
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => syncMutation.mutate()}
            disabled={syncMutation.isPending}
          >
            {syncMutation.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 h-4 w-4" />
            )}
            Sync from eBay
          </Button>
          <Button onClick={() => setIsRecordSaleOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Record Sale
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending</CardTitle>
          </CardHeader>
          <CardContent>
            {statsQuery.isLoading ? (
              <Skeleton className="h-8 w-12" />
            ) : (
              <div className="text-2xl font-bold">{stats.pending}</div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">To Ship</CardTitle>
          </CardHeader>
          <CardContent>
            {statsQuery.isLoading ? (
              <Skeleton className="h-8 w-12" />
            ) : (
              <div className="text-2xl font-bold">{stats.paid}</div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Shipped</CardTitle>
          </CardHeader>
          <CardContent>
            {statsQuery.isLoading ? (
              <Skeleton className="h-8 w-12" />
            ) : (
              <div className="text-2xl font-bold">{stats.shipped}</div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Delivered</CardTitle>
          </CardHeader>
          <CardContent>
            {statsQuery.isLoading ? (
              <Skeleton className="h-8 w-12" />
            ) : (
              <div className="text-2xl font-bold">{stats.delivered}</div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-1">
              <DollarSign className="h-4 w-4" />
              Revenue
            </CardTitle>
          </CardHeader>
          <CardContent>
            {statsQuery.isLoading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <div className="text-2xl font-bold">
                {formatCurrency(statsQuery.data?.totalRevenue)}
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-1">
              <TrendingUp className="h-4 w-4" />
              Profit
            </CardTitle>
          </CardHeader>
          <CardContent>
            {statsQuery.isLoading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <div
                className={`text-2xl font-bold ${
                  (statsQuery.data?.totalProfit ?? 0) >= 0
                    ? "text-green-600 dark:text-green-400"
                    : "text-red-600 dark:text-red-400"
                }`}
              >
                {formatCurrency(statsQuery.data?.totalProfit)}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Orders Table */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Orders</CardTitle>
          <CardDescription>
            A list of all your orders across all channels.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <OrdersTable
            orders={ordersQuery.data?.orders ?? []}
            isLoading={ordersQuery.isLoading}
            pagination={ordersQuery.data?.pagination}
            onPageChange={setPage}
            onOrderClick={handleOrderClick}
            onStatusFilter={setStatusFilter}
            onChannelFilter={setChannelFilter}
            statusFilter={statusFilter}
            channelFilter={channelFilter}
          />
        </CardContent>
      </Card>

      {/* Order Detail Dialog */}
      <OrderDetailDialog
        order={orderDetailQuery.data as Parameters<typeof OrderDetailDialog>[0]["order"]}
        open={!!selectedOrderId}
        onOpenChange={(open) => !open && setSelectedOrderId(null)}
        onMarkShipped={handleMarkShipped}
        isShipping={markShippedMutation.isPending}
      />

      {/* Record Sale Dialog */}
      <RecordSaleDialog
        open={isRecordSaleOpen}
        onOpenChange={setIsRecordSaleOpen}
        items={
          (inventoryQuery.data?.items ?? []).map((item) => ({
            id: item.id,
            title: item.title,
            sku: item.sku,
            askingPrice: item.askingPrice,
            costBasis: item.costBasis,
          })) as Parameters<typeof RecordSaleDialog>[0]["items"]
        }
        isLoadingItems={inventoryQuery.isLoading}
        onSubmit={handleRecordSale}
        isSubmitting={recordSaleMutation.isPending}
      />
    </div>
  );
}
