"use client";

import { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { trpc } from "@/lib/trpc/client";
import { ListingsTable } from "@/components/listings";
import { type Channel } from "@/lib/constants";

type ListingStatus = "draft" | "pending" | "active" | "ended" | "sold" | "error";

export default function ListingsPage() {
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<ListingStatus | "all">("all");
  const [channelFilter, setChannelFilter] = useState<Channel | "all">("all");

  // Fetch listings
  const listingsQuery = trpc.listings.list.useQuery({
    page,
    limit: 25,
    status: statusFilter === "all" ? undefined : statusFilter,
    channel: channelFilter === "all" ? undefined : channelFilter,
  });

  // Fetch stats
  const statsQuery = trpc.listings.getStats.useQuery();

  const channelCounts = statsQuery.data?.channelCounts ?? {
    ebay: 0,
    poshmark: 0,
    mercari: 0,
    depop: 0,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Listings</h1>
        <p className="text-muted-foreground">
          View and manage your active listings across all channels
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">eBay</CardTitle>
          </CardHeader>
          <CardContent>
            {statsQuery.isLoading ? (
              <Skeleton className="h-8 w-12" />
            ) : (
              <>
                <div className="text-2xl font-bold">{channelCounts.ebay}</div>
                <p className="text-xs text-muted-foreground">active listings</p>
              </>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Poshmark</CardTitle>
          </CardHeader>
          <CardContent>
            {statsQuery.isLoading ? (
              <Skeleton className="h-8 w-12" />
            ) : (
              <>
                <div className="text-2xl font-bold">{channelCounts.poshmark}</div>
                <p className="text-xs text-muted-foreground">tracked listings</p>
              </>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Mercari</CardTitle>
          </CardHeader>
          <CardContent>
            {statsQuery.isLoading ? (
              <Skeleton className="h-8 w-12" />
            ) : (
              <>
                <div className="text-2xl font-bold">{channelCounts.mercari}</div>
                <p className="text-xs text-muted-foreground">tracked listings</p>
              </>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Depop</CardTitle>
          </CardHeader>
          <CardContent>
            {statsQuery.isLoading ? (
              <Skeleton className="h-8 w-12" />
            ) : (
              <>
                <div className="text-2xl font-bold">{channelCounts.depop}</div>
                <p className="text-xs text-muted-foreground">tracked listings</p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Listings Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Listings</CardTitle>
          <CardDescription>
            View all your listings across all marketplace channels.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ListingsTable
            listings={listingsQuery.data?.listings ?? []}
            isLoading={listingsQuery.isLoading}
            pagination={listingsQuery.data?.pagination}
            onPageChange={setPage}
            onStatusFilter={setStatusFilter}
            onChannelFilter={setChannelFilter}
            statusFilter={statusFilter}
            channelFilter={channelFilter}
          />
        </CardContent>
      </Card>
    </div>
  );
}
