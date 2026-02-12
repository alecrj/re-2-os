"use client";

import { signIn } from "next-auth/react";
import { trpc } from "@/lib/trpc/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatRelativeTime } from "@/lib/utils";
import { Loader2 } from "lucide-react";
import { useState } from "react";

const ASSISTED_CHANNELS = [
  { name: "Poshmark", key: "poshmark" },
  { name: "Mercari", key: "mercari" },
  { name: "Depop", key: "depop" },
] as const;

export function ConnectedChannels() {
  const utils = trpc.useUtils();
  const connectionsQuery = trpc.channels.listConnections.useQuery();
  const disconnectMutation = trpc.channels.disconnect.useMutation({
    onSuccess: () => {
      utils.channels.listConnections.invalidate();
    },
  });

  const [isConnecting, setIsConnecting] = useState(false);

  const ebayConnection = connectionsQuery.data?.find(
    (c: { channel: string; status: string }) =>
      c.channel === "ebay" && c.status === "active"
  );

  const handleConnectEbay = async () => {
    setIsConnecting(true);
    try {
      await signIn("ebay", { callbackUrl: "/settings" });
    } catch {
      setIsConnecting(false);
    }
  };

  const handleDisconnect = () => {
    disconnectMutation.mutate({ channel: "ebay" });
  };

  if (connectionsQuery.isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-center py-4">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* eBay - Native OAuth */}
      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <span className="font-medium">eBay</span>
          {ebayConnection && (
            <div className="text-xs text-muted-foreground">
              {ebayConnection.externalUsername && (
                <span>{ebayConnection.externalUsername}</span>
              )}
              {ebayConnection.lastSyncAt && (
                <span>
                  {ebayConnection.externalUsername ? " \u00b7 " : ""}
                  Synced {formatRelativeTime(ebayConnection.lastSyncAt)}
                </span>
              )}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          {ebayConnection ? (
            <>
              <Badge variant="success">Connected</Badge>
              <Button
                size="sm"
                variant="outline"
                onClick={handleDisconnect}
                disabled={disconnectMutation.isPending}
              >
                {disconnectMutation.isPending ? "Disconnecting..." : "Disconnect"}
              </Button>
            </>
          ) : (
            <Button
              size="sm"
              onClick={handleConnectEbay}
              disabled={isConnecting}
            >
              {isConnecting ? "Connecting..." : "Connect"}
            </Button>
          )}
        </div>
      </div>

      {/* Assisted channels */}
      {ASSISTED_CHANNELS.map((channel) => (
        <div key={channel.key} className="flex items-center justify-between">
          <span className="font-medium">{channel.name}</span>
          <Badge variant="secondary">Assisted</Badge>
        </div>
      ))}
    </div>
  );
}
