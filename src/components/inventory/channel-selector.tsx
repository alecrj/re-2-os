"use client";

/**
 * Channel Selector Component
 *
 * Allows users to select which marketplace channels to publish to.
 * Shows native vs assisted integration modes and connection status.
 */

import * as React from "react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { CheckCircle2, Info } from "lucide-react";

// ============ TYPES ============

export type ChannelId = "ebay" | "poshmark" | "mercari" | "depop";

interface Channel {
  id: ChannelId;
  name: string;
  logo: string;
  mode: "native" | "assisted";
  connected: boolean;
  description: string;
}

interface ChannelSelectorProps {
  selectedChannels: ChannelId[];
  onSelectionChange: (channels: ChannelId[]) => void;
  className?: string;
}

// ============ CHANNEL DATA ============

const channels: Channel[] = [
  {
    id: "ebay",
    name: "eBay",
    logo: "/channels/ebay.svg",
    mode: "native",
    connected: false, // This would be dynamic in production
    description: "Direct API publishing - listings sync automatically",
  },
  {
    id: "poshmark",
    name: "Poshmark",
    logo: "/channels/poshmark.svg",
    mode: "assisted",
    connected: true,
    description: "Copy-paste template - you list manually",
  },
  {
    id: "mercari",
    name: "Mercari",
    logo: "/channels/mercari.svg",
    mode: "assisted",
    connected: true,
    description: "Copy-paste template - you list manually",
  },
  {
    id: "depop",
    name: "Depop",
    logo: "/channels/depop.svg",
    mode: "assisted",
    connected: true,
    description: "Copy-paste template - you list manually",
  },
];

// ============ COMPONENT ============

export function ChannelSelector({
  selectedChannels,
  onSelectionChange,
  className,
}: ChannelSelectorProps) {
  const handleToggle = (channelId: ChannelId) => {
    if (selectedChannels.includes(channelId)) {
      onSelectionChange(selectedChannels.filter((id) => id !== channelId));
    } else {
      onSelectionChange([...selectedChannels, channelId]);
    }
  };

  const nativeChannels = channels.filter((c) => c.mode === "native");
  const assistedChannels = channels.filter((c) => c.mode === "assisted");

  return (
    <div className={cn("space-y-6", className)}>
      {/* Native Integration Channels */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <h3 className="font-medium">Native Integration</h3>
          <Badge variant="secondary" className="text-xs bg-green-100 text-green-700">
            Auto-sync
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          These channels connect directly to your accounts and sync automatically.
        </p>
        <div className="grid gap-3">
          {nativeChannels.map((channel) => (
            <ChannelCard
              key={channel.id}
              channel={channel}
              selected={selectedChannels.includes(channel.id)}
              onToggle={() => handleToggle(channel.id)}
            />
          ))}
        </div>
      </div>

      {/* Assisted Channels */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <h3 className="font-medium">Assisted Cross-listing</h3>
          <Badge variant="secondary" className="text-xs">
            Manual
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          We generate optimized templates for you to copy-paste into these platforms.
        </p>
        <div className="grid gap-3">
          {assistedChannels.map((channel) => (
            <ChannelCard
              key={channel.id}
              channel={channel}
              selected={selectedChannels.includes(channel.id)}
              onToggle={() => handleToggle(channel.id)}
            />
          ))}
        </div>
      </div>

      {/* Info Banner */}
      {selectedChannels.some((id) =>
        channels.find((c) => c.id === id)?.mode === "assisted"
      ) && (
        <div className="flex gap-3 p-3 rounded-lg bg-blue-50 text-blue-700 text-sm">
          <Info className="h-5 w-5 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium">Assisted channels selected</p>
            <p className="text-blue-600 mt-1">
              After saving, you will see copy-paste templates to create listings
              on these platforms manually. We will track them for you.
            </p>
          </div>
        </div>
      )}

      {/* Selected Summary */}
      {selectedChannels.length > 0 && (
        <div className="flex items-center gap-2 text-sm">
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          <span>
            {selectedChannels.length} channel{selectedChannels.length !== 1 ? "s" : ""} selected
          </span>
        </div>
      )}
    </div>
  );
}

// ============ CHANNEL CARD ============

interface ChannelCardProps {
  channel: Channel;
  selected: boolean;
  onToggle: () => void;
}

function ChannelCard({ channel, selected, onToggle }: ChannelCardProps) {
  return (
    <div
      className={cn(
        "flex items-center justify-between p-4 rounded-lg border transition-colors",
        selected
          ? "border-primary bg-primary/5"
          : "border-border hover:border-muted-foreground/50",
        !channel.connected && channel.mode === "native" && "opacity-60"
      )}
    >
      <div className="flex items-center gap-3">
        {/* Channel Logo Placeholder */}
        <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center font-bold text-muted-foreground">
          {channel.name.charAt(0)}
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="font-medium">{channel.name}</span>
            {channel.mode === "native" && !channel.connected && (
              <Badge variant="outline" className="text-xs text-amber-600 border-amber-300">
                Not connected
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground">{channel.description}</p>
        </div>
      </div>

      <Switch
        checked={selected}
        onCheckedChange={onToggle}
        disabled={channel.mode === "native" && !channel.connected}
      />
    </div>
  );
}

export default ChannelSelector;
