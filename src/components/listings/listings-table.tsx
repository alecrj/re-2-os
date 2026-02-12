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
  ExternalLink,
  Tags,
} from "lucide-react";
import { CHANNEL_NAMES, type Channel } from "@/lib/constants";

type ListingStatus = "draft" | "pending" | "active" | "ended" | "sold" | "error";

interface ListingItem {
  id: string;
  title: string;
  sku: string;
  askingPrice: number;
  imageUrl?: string;
}

interface Listing {
  id: string;
  itemId: string;
  channel: Channel;
  status: ListingStatus;
  price: number;
  externalId: string | null;
  externalUrl: string | null;
  requiresManualAction: boolean;
  createdAt: Date;
  publishedAt: Date | null;
  endedAt: Date | null;
  item: ListingItem | null;
}

interface ListingsTableProps {
  listings: Listing[];
  isLoading?: boolean;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  onPageChange?: (page: number) => void;
  onStatusFilter?: (status: ListingStatus | "all") => void;
  onChannelFilter?: (channel: Channel | "all") => void;
  statusFilter?: ListingStatus | "all";
  channelFilter?: Channel | "all";
}

function getStatusBadgeVariant(
  status: ListingStatus
): "default" | "secondary" | "success" | "warning" | "destructive" | "info" {
  switch (status) {
    case "active":
      return "success";
    case "pending":
      return "warning";
    case "draft":
      return "secondary";
    case "ended":
      return "default";
    case "sold":
      return "info";
    case "error":
      return "destructive";
    default:
      return "default";
  }
}

function getStatusLabel(status: ListingStatus): string {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function formatCurrency(amount: number | null): string {
  if (amount === null) return "-";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
}

function ListingsTableSkeleton() {
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

export function ListingsTable({
  listings,
  isLoading,
  pagination,
  onPageChange,
  onStatusFilter,
  onChannelFilter,
  statusFilter = "all",
  channelFilter = "all",
}: ListingsTableProps) {
  if (isLoading) {
    return <ListingsTableSkeleton />;
  }

  if (listings.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <Tags className="h-12 w-12 text-muted-foreground mb-4" />
        <h3 className="text-lg font-semibold">No listings found</h3>
        <p className="text-muted-foreground">
          {statusFilter !== "all" || channelFilter !== "all"
            ? "Try adjusting your filters."
            : "Create listings from your inventory to see them here."}
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
              onStatusFilter?.(value as ListingStatus | "all")
            }
          >
            <SelectTrigger className="h-11 md:h-9">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="ended">Ended</SelectItem>
              <SelectItem value="sold">Sold</SelectItem>
              <SelectItem value="error">Error</SelectItem>
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
              <TableHead className="text-right">Price</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Listed</TableHead>
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {listings.map((listing) => (
              <TableRow key={listing.id}>
                <TableCell>
                  <div className="flex items-center gap-3">
                    {listing.item?.imageUrl ? (
                      <Image
                        src={listing.item.imageUrl}
                        alt={listing.item.title}
                        className="h-10 w-10 rounded object-cover"
                        width={40}
                        height={40}
                        unoptimized
                      />
                    ) : (
                      <div className="h-10 w-10 rounded bg-muted flex items-center justify-center">
                        <Tags className="h-5 w-5 text-muted-foreground" />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="font-medium truncate">
                        {listing.item?.title ?? "Unknown Item"}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {listing.item?.sku ?? listing.id.slice(0, 8)}
                      </p>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <span>{CHANNEL_NAMES[listing.channel]}</span>
                </TableCell>
                <TableCell className="text-right font-medium">
                  {formatCurrency(listing.price)}
                </TableCell>
                <TableCell>
                  <Badge variant={getStatusBadgeVariant(listing.status)}>
                    {getStatusLabel(listing.status)}
                  </Badge>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {listing.publishedAt
                    ? formatDistanceToNow(new Date(listing.publishedAt), {
                        addSuffix: true,
                      })
                    : listing.createdAt
                      ? formatDistanceToNow(new Date(listing.createdAt), {
                          addSuffix: true,
                        })
                      : "-"}
                </TableCell>
                <TableCell>
                  {listing.externalUrl && (
                    <a
                      href={listing.externalUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <ExternalLink className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                    </a>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Mobile Card View */}
      <div className="md:hidden space-y-3">
        {listings.map((listing) => (
          <div
            key={listing.id}
            className="rounded-lg border p-4"
          >
            <div className="flex gap-3">
              {listing.item?.imageUrl ? (
                <Image
                  src={listing.item.imageUrl}
                  alt={listing.item.title}
                  className="h-14 w-14 rounded object-cover flex-shrink-0"
                  width={56}
                  height={56}
                  unoptimized
                />
              ) : (
                <div className="h-14 w-14 rounded bg-muted flex items-center justify-center flex-shrink-0">
                  <Tags className="h-6 w-6 text-muted-foreground" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-medium line-clamp-2 text-sm">
                    {listing.item?.title ?? "Unknown Item"}
                  </p>
                  <span className="font-semibold text-sm whitespace-nowrap">
                    {formatCurrency(listing.price)}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {CHANNEL_NAMES[listing.channel]} &middot;{" "}
                  {listing.publishedAt
                    ? formatDistanceToNow(new Date(listing.publishedAt), {
                        addSuffix: true,
                      })
                    : listing.createdAt
                      ? formatDistanceToNow(new Date(listing.createdAt), {
                          addSuffix: true,
                        })
                      : "-"}
                </p>
                <div className="flex items-center justify-between mt-2">
                  <Badge variant={getStatusBadgeVariant(listing.status)}>
                    {getStatusLabel(listing.status)}
                  </Badge>
                  {listing.externalUrl && (
                    <a
                      href={listing.externalUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <ExternalLink className="h-4 w-4 text-muted-foreground" />
                    </a>
                  )}
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
            {pagination.total} listings
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
