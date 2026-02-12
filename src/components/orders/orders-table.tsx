"use client";

import Image from "next/image";
import { formatDistanceToNow } from "date-fns";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ChevronLeft,
  ChevronRight,
  Package,
  ExternalLink,
} from "lucide-react";
import { CHANNEL_NAMES, type Channel, type OrderStatus } from "@/lib/constants";

// Order type from tRPC response
interface OrderItem {
  id: string;
  title: string;
  sku: string;
  costBasis: number | null;
  imageUrl?: string;
}

interface Order {
  id: string;
  userId: string;
  itemId: string;
  channelListingId: string | null;
  channel: Channel;
  externalOrderId: string | null;
  salePrice: number;
  shippingPaid: number | null;
  platformFees: number | null;
  shippingCost: number | null;
  netProfit: number | null;
  buyerUsername: string | null;
  status: OrderStatus;
  orderedAt: Date;
  paidAt: Date | null;
  shippedAt: Date | null;
  deliveredAt: Date | null;
  item: OrderItem | null;
}

interface OrdersTableProps {
  orders: Order[];
  isLoading?: boolean;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  onPageChange?: (page: number) => void;
  onOrderClick?: (order: Order) => void;
  onStatusFilter?: (status: OrderStatus | "all") => void;
  onChannelFilter?: (channel: Channel | "all") => void;
  statusFilter?: OrderStatus | "all";
  channelFilter?: Channel | "all";
}

function getStatusBadgeVariant(
  status: OrderStatus
): "default" | "secondary" | "success" | "warning" | "destructive" | "info" {
  switch (status) {
    case "pending":
      return "warning";
    case "paid":
      return "info";
    case "shipped":
      return "default";
    case "delivered":
      return "success";
    case "returned":
      return "destructive";
    case "cancelled":
      return "secondary";
    default:
      return "default";
  }
}

function getStatusLabel(status: OrderStatus): string {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function formatCurrency(amount: number | null): string {
  if (amount === null) return "-";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
}

function OrdersTableSkeleton() {
  return (
    <div className="space-y-4">
      {[...Array(5)].map((_, i) => (
        <div key={i} className="flex items-center space-x-4 py-4">
          <Skeleton className="h-12 w-12 rounded" />
          <div className="space-y-2 flex-1">
            <Skeleton className="h-4 w-[250px]" />
            <Skeleton className="h-4 w-[200px]" />
          </div>
          <Skeleton className="h-4 w-[80px]" />
          <Skeleton className="h-4 w-[80px]" />
          <Skeleton className="h-6 w-[70px] rounded-full" />
        </div>
      ))}
    </div>
  );
}

export function OrdersTable({
  orders,
  isLoading,
  pagination,
  onPageChange,
  onOrderClick,
  onStatusFilter,
  onChannelFilter,
  statusFilter = "all",
  channelFilter = "all",
}: OrdersTableProps) {
  if (isLoading) {
    return <OrdersTableSkeleton />;
  }

  if (orders.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <Package className="h-12 w-12 text-muted-foreground mb-4" />
        <h3 className="text-lg font-semibold">No orders found</h3>
        <p className="text-muted-foreground">
          {statusFilter !== "all" || channelFilter !== "all"
            ? "Try adjusting your filters."
            : "Orders will appear here when you make sales."}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex gap-4">
        <div className="w-[180px]">
          <Select
            value={statusFilter}
            onValueChange={(value) =>
              onStatusFilter?.(value as OrderStatus | "all")
            }
          >
            <SelectTrigger className="h-11 md:h-9">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="paid">Paid</SelectItem>
              <SelectItem value="shipped">Shipped</SelectItem>
              <SelectItem value="delivered">Delivered</SelectItem>
              <SelectItem value="returned">Returned</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="w-[180px]">
          <Select
            value={channelFilter}
            onValueChange={(value) =>
              onChannelFilter?.(value as Channel | "all")
            }
          >
            <SelectTrigger className="h-11 md:h-9">
              <SelectValue placeholder="Filter by channel" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Channels</SelectItem>
              <SelectItem value="ebay">eBay</SelectItem>
              <SelectItem value="poshmark">Poshmark</SelectItem>
              <SelectItem value="mercari">Mercari</SelectItem>
              <SelectItem value="depop">Depop</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Desktop Table */}
      <div className="rounded-md border hidden md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[300px]">Item</TableHead>
              <TableHead>Channel</TableHead>
              <TableHead className="text-right">Sale Price</TableHead>
              <TableHead className="text-right">Fees</TableHead>
              <TableHead className="text-right">Profit</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Date</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {orders.map((order) => (
              <TableRow
                key={order.id}
                className="cursor-pointer"
                onClick={() => onOrderClick?.(order)}
              >
                <TableCell>
                  <div className="flex items-center gap-3">
                    {order.item?.imageUrl ? (
                      <Image
                        src={order.item.imageUrl}
                        alt={order.item.title}
                        className="h-10 w-10 rounded object-cover"
                        width={40}
                        height={40}
                        unoptimized
                      />
                    ) : (
                      <div className="h-10 w-10 rounded bg-muted flex items-center justify-center">
                        <Package className="h-5 w-5 text-muted-foreground" />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="font-medium truncate">
                        {order.item?.title ?? "Unknown Item"}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {order.item?.sku ?? order.externalOrderId ?? order.id.slice(0, 8)}
                      </p>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    <span>{CHANNEL_NAMES[order.channel]}</span>
                    {order.externalOrderId && (
                      <ExternalLink className="h-3 w-3 text-muted-foreground" />
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-right font-medium">
                  {formatCurrency(order.salePrice)}
                </TableCell>
                <TableCell className="text-right text-muted-foreground">
                  {formatCurrency(order.platformFees)}
                </TableCell>
                <TableCell
                  className={`text-right font-medium ${
                    (order.netProfit ?? 0) >= 0
                      ? "text-green-600 dark:text-green-400"
                      : "text-red-600 dark:text-red-400"
                  }`}
                >
                  {formatCurrency(order.netProfit)}
                </TableCell>
                <TableCell>
                  <Badge variant={getStatusBadgeVariant(order.status)}>
                    {getStatusLabel(order.status)}
                  </Badge>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {formatDistanceToNow(new Date(order.orderedAt), {
                    addSuffix: true,
                  })}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Mobile Card View */}
      <div className="md:hidden space-y-3">
        {orders.map((order) => (
          <div
            key={order.id}
            className="rounded-lg border p-4 cursor-pointer active:bg-muted/50"
            onClick={() => onOrderClick?.(order)}
          >
            <div className="flex gap-3">
              {order.item?.imageUrl ? (
                <Image
                  src={order.item.imageUrl}
                  alt={order.item.title}
                  className="h-14 w-14 rounded object-cover flex-shrink-0"
                  width={56}
                  height={56}
                  unoptimized
                />
              ) : (
                <div className="h-14 w-14 rounded bg-muted flex items-center justify-center flex-shrink-0">
                  <Package className="h-6 w-6 text-muted-foreground" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-medium line-clamp-2 text-sm">
                    {order.item?.title ?? "Unknown Item"}
                  </p>
                  <span className="font-semibold text-sm whitespace-nowrap">
                    {formatCurrency(order.salePrice)}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {CHANNEL_NAMES[order.channel]} &middot;{" "}
                  {formatDistanceToNow(new Date(order.orderedAt), {
                    addSuffix: true,
                  })}
                </p>
                <div className="flex items-center justify-between mt-2">
                  <Badge variant={getStatusBadgeVariant(order.status)}>
                    {getStatusLabel(order.status)}
                  </Badge>
                  <span
                    className={`text-sm font-medium ${
                      (order.netProfit ?? 0) >= 0
                        ? "text-green-600 dark:text-green-400"
                        : "text-red-600 dark:text-red-400"
                    }`}
                  >
                    {formatCurrency(order.netProfit)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {(pagination.page - 1) * pagination.limit + 1} to{" "}
            {Math.min(pagination.page * pagination.limit, pagination.total)} of{" "}
            {pagination.total} orders
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange?.(pagination.page - 1)}
              disabled={pagination.page <= 1}
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </Button>
            <span className="text-sm">
              Page {pagination.page} of {pagination.totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange?.(pagination.page + 1)}
              disabled={pagination.page >= pagination.totalPages}
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
