"use client";

import { useState } from "react";
import { Check, X, AlertTriangle, Clock, DollarSign } from "lucide-react";
import { trpc } from "@/lib/trpc/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency, formatRelativeTime } from "@/lib/utils";

interface PendingAction {
  id: string;
  actionType: string;
  confidence: number;
  confidenceLevel: string;
  createdAt: Date;
  beforeState: Record<string, unknown> | null;
  afterState: Record<string, unknown> | null;
  payload: Record<string, unknown> | null;
  item: {
    id: string;
    title: string;
    askingPrice: number;
    floorPrice: number | null;
  } | null;
}

function getActionTypeLabel(actionType: string): string {
  switch (actionType) {
    case "OFFER_ACCEPT":
      return "Accept Offer";
    case "OFFER_DECLINE":
      return "Decline Offer";
    case "OFFER_COUNTER":
      return "Counter Offer";
    case "REPRICE":
      return "Reprice";
    default:
      return actionType;
  }
}

function getConfidenceBadgeVariant(
  level: string
): "success" | "warning" | "destructive" | "secondary" {
  switch (level) {
    case "HIGH":
      return "success";
    case "MEDIUM":
      return "warning";
    case "LOW":
      return "destructive";
    default:
      return "secondary";
  }
}

function ActionRow({
  action,
  onApprove,
  onReject,
  isLoading,
}: {
  action: PendingAction;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  isLoading: boolean;
}) {
  const offerAmount = action.beforeState?.offerAmount as number | undefined;
  const askingPrice =
    action.item?.askingPrice ?? (action.beforeState?.askingPrice as number);
  const counterAmount = action.afterState?.counterAmount as number | undefined;
  const channel = action.beforeState?.channel as string | undefined;
  const buyerUsername = action.beforeState?.buyerUsername as string | undefined;

  const offerPercent = offerAmount && askingPrice ? offerAmount / askingPrice : 0;

  return (
    <TableRow>
      <TableCell>
        <div className="flex flex-col gap-1">
          <span className="font-medium line-clamp-1">
            {action.item?.title ?? "Unknown Item"}
          </span>
          <span className="text-xs text-muted-foreground">
            {channel && <span className="capitalize">{channel}</span>}
            {buyerUsername && <span> from {buyerUsername}</span>}
          </span>
        </div>
      </TableCell>
      <TableCell>
        <Badge variant="outline">{getActionTypeLabel(action.actionType)}</Badge>
      </TableCell>
      <TableCell>
        <div className="flex flex-col gap-1">
          {offerAmount !== undefined && (
            <span className="font-medium">{formatCurrency(offerAmount)}</span>
          )}
          {askingPrice && (
            <span className="text-xs text-muted-foreground">
              of {formatCurrency(askingPrice)} ({(offerPercent * 100).toFixed(0)}%)
            </span>
          )}
          {counterAmount !== undefined && (
            <span className="text-xs text-blue-600 dark:text-blue-400">
              Counter: {formatCurrency(counterAmount)}
            </span>
          )}
        </div>
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-2">
          <Badge variant={getConfidenceBadgeVariant(action.confidenceLevel)}>
            {action.confidenceLevel}
          </Badge>
          <span className="text-xs text-muted-foreground">
            {(action.confidence * 100).toFixed(0)}%
          </span>
        </div>
      </TableCell>
      <TableCell>
        <span className="text-sm text-muted-foreground">
          {formatRelativeTime(action.createdAt)}
        </span>
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => onApprove(action.id)}
            disabled={isLoading}
          >
            <Check className="h-4 w-4 mr-1" />
            Approve
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => onReject(action.id)}
            disabled={isLoading}
          >
            <X className="h-4 w-4 mr-1" />
            Reject
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}

export function PendingActions() {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const utils = trpc.useUtils();

  const {
    data: pendingData,
    isLoading,
    error,
  } = trpc.autopilot.getPendingActions.useQuery();

  const resolveAction = trpc.autopilot.resolveAction.useMutation({
    onSuccess: () => {
      utils.autopilot.getPendingActions.invalidate();
      utils.autopilot.getPendingCount.invalidate();
    },
  });

  const bulkResolve = trpc.autopilot.bulkResolveActions.useMutation({
    onSuccess: () => {
      setSelectedIds(new Set());
      utils.autopilot.getPendingActions.invalidate();
      utils.autopilot.getPendingCount.invalidate();
    },
  });

  const handleApprove = (id: string) => {
    resolveAction.mutate({ actionId: id, decision: "approve" });
  };

  const handleReject = (id: string) => {
    resolveAction.mutate({ actionId: id, decision: "reject" });
  };

  const handleBulkApprove = () => {
    if (selectedIds.size === 0) return;
    bulkResolve.mutate({
      actionIds: Array.from(selectedIds),
      decision: "approve",
    });
  };

  const handleBulkReject = () => {
    if (selectedIds.size === 0) return;
    bulkResolve.mutate({
      actionIds: Array.from(selectedIds),
      decision: "reject",
    });
  };

  // Future: Multi-select functionality
  const _handleSelectAll = () => {
    if (!pendingData?.actions) return;
    if (selectedIds.size === pendingData.actions.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(pendingData.actions.map((a) => a.id)));
    }
  };

  // Future: Toggle individual selection
  const _toggleSelection = (id: string) => {
    const newSelection = new Set(selectedIds);
    if (newSelection.has(id)) {
      newSelection.delete(id);
    } else {
      newSelection.add(id);
    }
    setSelectedIds(newSelection);
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Pending Actions</CardTitle>
          <CardDescription>Loading pending actions...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            Error Loading Actions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{error.message}</p>
        </CardContent>
      </Card>
    );
  }

  const actions = pendingData?.actions ?? [];
  const total = pendingData?.total ?? 0;

  if (actions.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Pending Actions
          </CardTitle>
          <CardDescription>No actions awaiting your approval</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Check className="h-12 w-12 text-green-500 mb-4" />
            <p className="text-lg font-medium">All caught up!</p>
            <p className="text-sm text-muted-foreground">
              When autopilot needs your input, actions will appear here
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Pending Actions
            </CardTitle>
            <CardDescription>
              {total} action{total !== 1 ? "s" : ""} awaiting your approval
            </CardDescription>
          </div>
          {selectedIds.size > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">
                {selectedIds.size} selected
              </span>
              <Button
                size="sm"
                variant="outline"
                onClick={handleBulkApprove}
                disabled={bulkResolve.isPending}
              >
                <Check className="h-4 w-4 mr-1" />
                Approve All
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={handleBulkReject}
                disabled={bulkResolve.isPending}
              >
                <X className="h-4 w-4 mr-1" />
                Reject All
              </Button>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Item</TableHead>
              <TableHead>Action</TableHead>
              <TableHead>
                <div className="flex items-center gap-1">
                  <DollarSign className="h-4 w-4" />
                  Offer
                </div>
              </TableHead>
              <TableHead>Confidence</TableHead>
              <TableHead>Received</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {actions.map((action) => (
              <ActionRow
                key={action.id}
                action={action as unknown as PendingAction}
                onApprove={handleApprove}
                onReject={handleReject}
                isLoading={resolveAction.isPending}
              />
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
