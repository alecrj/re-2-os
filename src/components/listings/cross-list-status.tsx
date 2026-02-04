"use client";

/**
 * Cross-List Status Component
 *
 * Displays which platforms an item is listed on with status indicators
 * and action buttons for cross-listing to additional platforms.
 */

import * as React from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ExternalLink,
  Plus,
  CheckCircle2,
  Clock,
  AlertCircle,
  ShoppingBag,
} from "lucide-react";

// ============ TYPES ============

export type ChannelId = "ebay" | "poshmark" | "mercari" | "depop";
export type ListingStatus = "draft" | "pending" | "active" | "ended" | "sold" | "error";

export interface ChannelListing {
  channel: ChannelId;
  status: ListingStatus;
  externalUrl?: string | null;
  price?: number;
  publishedAt?: Date | null;
}

interface CrossListStatusProps {
  channelListings: ChannelListing[];
  onCrossListClick: (channel: "poshmark" | "mercari" | "depop") => void;
  className?: string;
}

// ============ CHANNEL METADATA ============

const channelMeta: Record<
  ChannelId,
  {
    name: string;
    color: string;
    bgColor: string;
    textColor: string;
    mode: "native" | "assisted";
  }
> = {
  ebay: {
    name: "eBay",
    color: "border-yellow-300",
    bgColor: "bg-yellow-100",
    textColor: "text-yellow-800",
    mode: "native",
  },
  poshmark: {
    name: "Poshmark",
    color: "border-pink-300",
    bgColor: "bg-pink-100",
    textColor: "text-pink-800",
    mode: "assisted",
  },
  mercari: {
    name: "Mercari",
    color: "border-red-300",
    bgColor: "bg-red-100",
    textColor: "text-red-800",
    mode: "assisted",
  },
  depop: {
    name: "Depop",
    color: "border-orange-300",
    bgColor: "bg-orange-100",
    textColor: "text-orange-800",
    mode: "assisted",
  },
};

const statusConfig: Record<
  ListingStatus,
  {
    label: string;
    icon: React.ElementType;
    color: string;
  }
> = {
  draft: {
    label: "Draft",
    icon: Clock,
    color: "text-gray-500",
  },
  pending: {
    label: "Pending",
    icon: Clock,
    color: "text-yellow-600",
  },
  active: {
    label: "Active",
    icon: CheckCircle2,
    color: "text-green-600",
  },
  ended: {
    label: "Ended",
    icon: AlertCircle,
    color: "text-gray-500",
  },
  sold: {
    label: "Sold",
    icon: ShoppingBag,
    color: "text-blue-600",
  },
  error: {
    label: "Error",
    icon: AlertCircle,
    color: "text-red-600",
  },
};

const assistedChannels: ("poshmark" | "mercari" | "depop")[] = [
  "poshmark",
  "mercari",
  "depop",
];

// ============ COMPONENT ============

export function CrossListStatus({
  channelListings,
  onCrossListClick,
  className,
}: CrossListStatusProps) {
  // Create a map of channel -> listing for easy lookup
  const listingMap = new Map(
    channelListings.map((listing) => [listing.channel, listing])
  );

  // Get channels that don't have a listing yet
  const unlistedAssistedChannels = assistedChannels.filter(
    (channel) => !listingMap.has(channel)
  );

  return (
    <div className={cn("space-y-4", className)}>
      {/* Listed Channels */}
      {channelListings.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-muted-foreground">
            Listed On
          </h4>
          <div className="space-y-2">
            {channelListings.map((listing) => (
              <ChannelListingRow
                key={listing.channel}
                listing={listing}
              />
            ))}
          </div>
        </div>
      )}

      {/* Cross-List Options */}
      {unlistedAssistedChannels.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-muted-foreground">
            Cross-List To
          </h4>
          <div className="flex flex-wrap gap-2">
            {unlistedAssistedChannels.map((channel) => {
              const meta = channelMeta[channel];
              return (
                <Button
                  key={channel}
                  variant="outline"
                  size="sm"
                  onClick={() => onCrossListClick(channel)}
                  className={cn(
                    "border-dashed hover:border-solid",
                    `hover:${meta.color}`
                  )}
                >
                  <Plus className="h-3.5 w-3.5 mr-1.5" />
                  {meta.name}
                </Button>
              );
            })}
          </div>
        </div>
      )}

      {/* Empty State */}
      {channelListings.length === 0 && unlistedAssistedChannels.length === 0 && (
        <p className="text-sm text-muted-foreground">
          No listing channels available.
        </p>
      )}
    </div>
  );
}

// ============ CHANNEL LISTING ROW ============

interface ChannelListingRowProps {
  listing: ChannelListing;
}

function ChannelListingRow({ listing }: ChannelListingRowProps) {
  const meta = channelMeta[listing.channel];
  const status = statusConfig[listing.status];
  const StatusIcon = status.icon;

  return (
    <div
      className={cn(
        "flex items-center justify-between p-3 rounded-lg border",
        meta.color
      )}
    >
      <div className="flex items-center gap-3">
        {/* Channel Badge */}
        <div
          className={cn(
            "h-8 w-8 rounded-md flex items-center justify-center font-bold text-sm",
            meta.bgColor,
            meta.textColor
          )}
        >
          {meta.name.charAt(0)}
        </div>

        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <span className="font-medium text-sm">{meta.name}</span>
            {meta.mode === "assisted" && (
              <Badge
                variant="outline"
                className="text-xs h-5 px-1.5 text-muted-foreground"
              >
                Manual
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-1.5 mt-0.5">
            <StatusIcon className={cn("h-3.5 w-3.5", status.color)} />
            <span className={cn("text-xs", status.color)}>{status.label}</span>
            {listing.price && (
              <span className="text-xs text-muted-foreground ml-1">
                - ${listing.price.toFixed(2)}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* External Link */}
      {listing.externalUrl && (
        <Button
          variant="ghost"
          size="sm"
          asChild
          className="h-8 w-8 p-0"
        >
          <a
            href={listing.externalUrl}
            target="_blank"
            rel="noopener noreferrer"
            title={`View on ${meta.name}`}
          >
            <ExternalLink className="h-4 w-4" />
          </a>
        </Button>
      )}
    </div>
  );
}

export default CrossListStatus;
