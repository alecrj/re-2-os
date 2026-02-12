"use client";

import Image from "next/image";
import { format } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import {
  Package,
  ExternalLink,
  MapPin,
  User,
  Calendar,
  Truck,
  DollarSign,
  Warehouse,
} from "lucide-react";
import { CHANNEL_NAMES, type Channel, type OrderStatus } from "@/lib/constants";
import { ShipOrderForm } from "./ship-order-form";
import { useState } from "react";

interface OrderDetailItem {
  id: string;
  title: string;
  description: string;
  sku: string;
  condition: string;
  askingPrice: number;
  costBasis: number | null;
  storageLocation: string | null;
  bin: string | null;
  shelf: string | null;
  images?: string[];
}

interface ShippingAddress {
  name?: string;
  street1?: string;
  street2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
}

interface OrderDetail {
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
  shippingAddress: ShippingAddress | null;
  status: OrderStatus;
  orderedAt: Date;
  paidAt: Date | null;
  shippedAt: Date | null;
  deliveredAt: Date | null;
  item: OrderDetailItem | null;
}

interface OrderDetailDialogProps {
  order: OrderDetail | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onMarkShipped?: (data: {
    orderId: string;
    trackingNumber: string;
    carrier: string;
    shippingCost?: number;
  }) => Promise<void>;
  isShipping?: boolean;
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

function formatCurrency(amount: number | null): string {
  if (amount === null) return "-";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
}

function formatDate(date: Date | null): string {
  if (!date) return "-";
  return format(new Date(date), "PPp");
}

function formatAddress(address: ShippingAddress | null): string[] {
  if (!address) return [];
  const lines: string[] = [];
  if (address.name) lines.push(address.name);
  if (address.street1) lines.push(address.street1);
  if (address.street2) lines.push(address.street2);
  const cityLine = [address.city, address.state, address.postalCode]
    .filter(Boolean)
    .join(", ");
  if (cityLine) lines.push(cityLine);
  if (address.country) lines.push(address.country);
  return lines;
}

export function OrderDetailDialog({
  order,
  open,
  onOpenChange,
  onMarkShipped,
  isShipping = false,
}: OrderDetailDialogProps) {
  const [showShipForm, setShowShipForm] = useState(false);

  if (!order) return null;

  const canShip = order.status === "paid" && !order.shippedAt;
  const addressLines = formatAddress(order.shippingAddress);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Order Details
            <Badge variant={getStatusBadgeVariant(order.status)}>
              {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
            </Badge>
          </DialogTitle>
          <DialogDescription>
            {CHANNEL_NAMES[order.channel]} Order{" "}
            {order.externalOrderId && `#${order.externalOrderId}`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Item Info */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Item</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-4">
                {order.item?.images && order.item.images.length > 0 ? (
                  <Image
                    src={order.item.images[0]}
                    alt={order.item.title}
                    className="h-24 w-24 rounded-lg object-cover"
                    width={96}
                    height={96}
                    unoptimized
                  />
                ) : (
                  <div className="h-24 w-24 rounded-lg bg-muted flex items-center justify-center">
                    <Package className="h-8 w-8 text-muted-foreground" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold truncate">
                    {order.item?.title ?? "Unknown Item"}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    SKU: {order.item?.sku ?? "-"}
                  </p>
                  <p className="text-sm text-muted-foreground capitalize">
                    Condition: {order.item?.condition.replace("_", " ") ?? "-"}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Cost Basis: {formatCurrency(order.item?.costBasis ?? null)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Storage Location Alert */}
          {order.item &&
            (order.item.storageLocation || order.item.bin || order.item.shelf) && (
              <Card className="border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Warehouse className="h-4 w-4" />
                    Find This Item
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
                    {order.item.storageLocation && (
                      <div>
                        <span className="text-muted-foreground">Location: </span>
                        <span className="font-semibold">
                          {order.item.storageLocation}
                        </span>
                      </div>
                    )}
                    {order.item.shelf && (
                      <div>
                        <span className="text-muted-foreground">Shelf: </span>
                        <span className="font-semibold">{order.item.shelf}</span>
                      </div>
                    )}
                    {order.item.bin && (
                      <div>
                        <span className="text-muted-foreground">Bin: </span>
                        <span className="font-semibold">{order.item.bin}</span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

          {/* Financial Breakdown */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <DollarSign className="h-4 w-4" />
                Financials
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Sale Price</span>
                  <span className="font-medium">
                    {formatCurrency(order.salePrice)}
                  </span>
                </div>
                {order.shippingPaid !== null && order.shippingPaid > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">
                      Shipping Paid (by buyer)
                    </span>
                    <span className="text-green-600 dark:text-green-400">
                      +{formatCurrency(order.shippingPaid)}
                    </span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Platform Fees</span>
                  <span className="text-red-600 dark:text-red-400">
                    -{formatCurrency(order.platformFees)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Shipping Cost</span>
                  <span className="text-red-600 dark:text-red-400">
                    -{formatCurrency(order.shippingCost)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Cost Basis</span>
                  <span className="text-red-600 dark:text-red-400">
                    -{formatCurrency(order.item?.costBasis ?? null)}
                  </span>
                </div>
                <Separator />
                <div className="flex justify-between font-semibold">
                  <span>Net Profit</span>
                  <span
                    className={
                      (order.netProfit ?? 0) >= 0
                        ? "text-green-600 dark:text-green-400"
                        : "text-red-600 dark:text-red-400"
                    }
                  >
                    {formatCurrency(order.netProfit)}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Order Timeline */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Timeline
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Ordered</span>
                  <span className="text-sm">{formatDate(order.orderedAt)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Paid</span>
                  <span className="text-sm">{formatDate(order.paidAt)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Shipped</span>
                  <span className="text-sm">{formatDate(order.shippedAt)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Delivered</span>
                  <span className="text-sm">
                    {formatDate(order.deliveredAt)}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Shipping Address */}
          {addressLines.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  Ship To
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-sm">
                  {addressLines.map((line, i) => (
                    <p key={i}>{line}</p>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Buyer Info */}
          {order.buyerUsername && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <User className="h-4 w-4" />
                  Buyer
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm">{order.buyerUsername}</p>
              </CardContent>
            </Card>
          )}

          {/* Ship Order Form */}
          {canShip && !showShipForm && (
            <Button
              className="w-full"
              onClick={() => setShowShipForm(true)}
            >
              <Truck className="mr-2 h-4 w-4" />
              Mark as Shipped
            </Button>
          )}

          {canShip && showShipForm && onMarkShipped && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Truck className="h-4 w-4" />
                  Ship Order
                </CardTitle>
                <CardDescription>
                  Enter tracking information to mark this order as shipped.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ShipOrderForm
                  orderId={order.id}
                  onSubmit={async (data) => {
                    await onMarkShipped(data);
                    setShowShipForm(false);
                  }}
                  onCancel={() => setShowShipForm(false)}
                  isLoading={isShipping}
                />
              </CardContent>
            </Card>
          )}

          {/* External Link */}
          {order.externalOrderId && order.channel === "ebay" && (
            <Button variant="outline" className="w-full" asChild>
              <a
                href={`https://www.ebay.com/sh/ord/?orderid=${order.externalOrderId}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <ExternalLink className="mr-2 h-4 w-4" />
                View on eBay
              </a>
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
