"use client";

import * as React from "react";
import { useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  Clock,
  RotateCcw,
  User,
  Zap,
  Server,
  Webhook,
  Filter,
} from "lucide-react";
import { trpc } from "@/lib/trpc/client";
import { Button } from "@/components/ui/button";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { formatRelativeTime } from "@/lib/utils";

// ============ TYPES ============

interface AuditEntry {
  id: string;
  actionType: string;
  actionId: string | null;
  itemId: string | null;
  channel: string | null;
  source: string;
  beforeState: Record<string, unknown> | null;
  afterState: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
  reversible: boolean;
  undoDeadline: string | null;
  reversedAt: string | null;
  timestamp: string;
  canUndo: boolean;
  timeRemaining: { hours: number; minutes: number } | null;
}

// ============ HELPER COMPONENTS ============

function SourceIcon({ source }: { source: string }) {
  switch (source) {
    case "AUTOPILOT":
      return <Zap className="h-4 w-4" />;
    case "USER":
      return <User className="h-4 w-4" />;
    case "SYSTEM":
      return <Server className="h-4 w-4" />;
    case "WEBHOOK":
      return <Webhook className="h-4 w-4" />;
    default:
      return null;
  }
}

function SourceBadge({ source }: { source: string }) {
  const variants: Record<string, "default" | "secondary" | "info" | "warning"> = {
    AUTOPILOT: "warning",
    USER: "default",
    SYSTEM: "secondary",
    WEBHOOK: "info",
  };

  return (
    <Badge variant={variants[source] ?? "secondary"} className="gap-1">
      <SourceIcon source={source} />
      {source.charAt(0) + source.slice(1).toLowerCase()}
    </Badge>
  );
}

function ActionTypeBadge({ actionType }: { actionType: string }) {
  const getVariant = (): "default" | "destructive" | "success" | "warning" | "info" | "secondary" => {
    if (actionType.includes("DELETE") || actionType.includes("DECLINE")) {
      return "destructive";
    }
    if (actionType.includes("CREATE") || actionType.includes("ACCEPT")) {
      return "success";
    }
    if (actionType.includes("UPDATE") || actionType.includes("CHANGE")) {
      return "info";
    }
    if (actionType.includes("ARCHIVE") || actionType.includes("DELIST")) {
      return "warning";
    }
    return "secondary";
  };

  const formatActionType = (type: string) => {
    return type
      .split("_")
      .map((word) => word.charAt(0) + word.slice(1).toLowerCase())
      .join(" ");
  };

  return <Badge variant={getVariant()}>{formatActionType(actionType)}</Badge>;
}

function TimeRemainingBadge({
  timeRemaining,
}: {
  timeRemaining: { hours: number; minutes: number } | null;
}) {
  if (!timeRemaining) return null;

  const { hours, minutes } = timeRemaining;
  let text: string;

  if (hours > 24) {
    const days = Math.floor(hours / 24);
    text = `${days}d remaining`;
  } else if (hours > 0) {
    text = `${hours}h ${minutes}m remaining`;
  } else {
    text = `${minutes}m remaining`;
  }

  return (
    <Badge variant="outline" className="gap-1 text-xs">
      <Clock className="h-3 w-3" />
      {text}
    </Badge>
  );
}

function StateChanges({
  beforeState,
  afterState,
}: {
  beforeState: Record<string, unknown> | null;
  afterState: Record<string, unknown> | null;
}) {
  if (!beforeState && !afterState) {
    return <span className="text-muted-foreground text-sm">No state changes recorded</span>;
  }

  const allKeys = new Set([
    ...Object.keys(beforeState ?? {}),
    ...Object.keys(afterState ?? {}),
  ]);

  const changes: Array<{ key: string; before: unknown; after: unknown }> = [];

  allKeys.forEach((key) => {
    const before = beforeState?.[key];
    const after = afterState?.[key];
    if (JSON.stringify(before) !== JSON.stringify(after)) {
      changes.push({ key, before, after });
    }
  });

  if (changes.length === 0) {
    return <span className="text-muted-foreground text-sm">No changes detected</span>;
  }

  return (
    <div className="space-y-2">
      {changes.map(({ key, before, after }) => (
        <div key={key} className="text-sm">
          <span className="font-medium">{key}:</span>{" "}
          <span className="text-red-600 line-through">
            {formatValue(before)}
          </span>{" "}
          <span className="text-green-600">{formatValue(after)}</span>
        </div>
      ))}
    </div>
  );
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return "null";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

// ============ EXPANDED ROW ============

function ExpandedRow({ entry }: { entry: AuditEntry }) {
  return (
    <div className="p-4 bg-muted/50 space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <h4 className="font-medium mb-2">Details</h4>
          <dl className="text-sm space-y-1">
            <div className="flex gap-2">
              <dt className="text-muted-foreground">Audit ID:</dt>
              <dd className="font-mono text-xs">{entry.id}</dd>
            </div>
            {entry.itemId && (
              <div className="flex gap-2">
                <dt className="text-muted-foreground">Item ID:</dt>
                <dd className="font-mono text-xs">{entry.itemId}</dd>
              </div>
            )}
            {entry.actionId && (
              <div className="flex gap-2">
                <dt className="text-muted-foreground">Action ID:</dt>
                <dd className="font-mono text-xs">{entry.actionId}</dd>
              </div>
            )}
            {entry.channel && (
              <div className="flex gap-2">
                <dt className="text-muted-foreground">Channel:</dt>
                <dd className="capitalize">{entry.channel}</dd>
              </div>
            )}
            <div className="flex gap-2">
              <dt className="text-muted-foreground">Timestamp:</dt>
              <dd>{new Date(entry.timestamp).toLocaleString()}</dd>
            </div>
          </dl>
        </div>
        <div>
          <h4 className="font-medium mb-2">State Changes</h4>
          <StateChanges
            beforeState={entry.beforeState}
            afterState={entry.afterState}
          />
        </div>
      </div>
      {entry.metadata && Object.keys(entry.metadata).length > 0 && (
        <div>
          <h4 className="font-medium mb-2">Metadata</h4>
          <pre className="text-xs bg-background p-2 rounded overflow-auto max-h-32">
            {JSON.stringify(entry.metadata, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

// ============ AUDIT LOG TABLE ============

function AuditLogTable({
  entries,
  onUndo,
  isUndoing,
}: {
  entries: AuditEntry[];
  onUndo: (auditId: string) => void;
  isUndoing: boolean;
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (entries.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No audit log entries found
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-[50px]"></TableHead>
          <TableHead>Time</TableHead>
          <TableHead>Action</TableHead>
          <TableHead>Item</TableHead>
          <TableHead>Source</TableHead>
          <TableHead>Reversible</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {entries.map((entry) => (
          <React.Fragment key={entry.id}>
            <TableRow
              className="cursor-pointer"
              onClick={() =>
                setExpandedId(expandedId === entry.id ? null : entry.id)
              }
            >
              <TableCell>
                {expandedId === entry.id ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </TableCell>
              <TableCell className="whitespace-nowrap">
                {formatRelativeTime(entry.timestamp)}
              </TableCell>
              <TableCell>
                <ActionTypeBadge actionType={entry.actionType} />
              </TableCell>
              <TableCell>
                {entry.itemId ? (
                  <span className="font-mono text-xs">
                    {entry.itemId.slice(0, 8)}...
                  </span>
                ) : (
                  <span className="text-muted-foreground">-</span>
                )}
              </TableCell>
              <TableCell>
                <SourceBadge source={entry.source} />
              </TableCell>
              <TableCell>
                {entry.reversedAt ? (
                  <Badge variant="secondary">Undone</Badge>
                ) : entry.canUndo ? (
                  <TimeRemainingBadge timeRemaining={entry.timeRemaining} />
                ) : entry.reversible ? (
                  <Badge variant="outline">Expired</Badge>
                ) : (
                  <span className="text-muted-foreground text-sm">No</span>
                )}
              </TableCell>
              <TableCell className="text-right">
                {entry.canUndo && !entry.reversedAt && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={(e) => {
                      e.stopPropagation();
                      onUndo(entry.id);
                    }}
                    disabled={isUndoing}
                    className="gap-1"
                  >
                    <RotateCcw className="h-3 w-3" />
                    Undo
                  </Button>
                )}
              </TableCell>
            </TableRow>
            {expandedId === entry.id && (
              <TableRow>
                <TableCell colSpan={7} className="p-0">
                  <ExpandedRow entry={entry} />
                </TableCell>
              </TableRow>
            )}
          </React.Fragment>
        ))}
      </TableBody>
    </Table>
  );
}

// ============ MAIN COMPONENT ============

const ACTION_TYPES = [
  { value: "all", label: "All Actions" },
  { value: "ITEM_CREATE", label: "Item Create" },
  { value: "ITEM_UPDATE", label: "Item Update" },
  { value: "ITEM_DELETE", label: "Item Delete" },
  { value: "ITEM_ARCHIVE", label: "Item Archive" },
  { value: "PRICE_CHANGE", label: "Price Change" },
  { value: "LISTING_PUBLISH", label: "Listing Publish" },
  { value: "LISTING_DELIST", label: "Listing Delist" },
  { value: "LISTING_RELIST", label: "Listing Relist" },
  { value: "OFFER_ACCEPT", label: "Offer Accept" },
  { value: "OFFER_DECLINE", label: "Offer Decline" },
  { value: "OFFER_COUNTER", label: "Offer Counter" },
  { value: "ORDER_CREATE", label: "Order Create" },
  { value: "ORDER_SHIP", label: "Order Ship" },
  { value: "UNDO_ACTION", label: "Undo Action" },
];

const SOURCE_TYPES = [
  { value: "all", label: "All Sources" },
  { value: "USER", label: "User" },
  { value: "AUTOPILOT", label: "Autopilot" },
  { value: "SYSTEM", label: "System" },
  { value: "WEBHOOK", label: "Webhook" },
];

export function AuditLog() {
  const [actionTypeFilter, setActionTypeFilter] = useState<string>("all");
  const [sourceFilter, setSourceFilter] = useState<string>("all");
  const [page, setPage] = useState(0);
  const pageSize = 20;

  const utils = trpc.useUtils();

  const { data, isLoading, error } = trpc.audit.list.useQuery({
    limit: pageSize,
    offset: page * pageSize,
    actionType: actionTypeFilter === "all" ? undefined : actionTypeFilter,
    source: sourceFilter === "all" ? undefined : (sourceFilter as "USER" | "AUTOPILOT" | "SYSTEM" | "WEBHOOK"),
  });

  const { data: stats } = trpc.audit.getStats.useQuery();

  const undoMutation = trpc.audit.undo.useMutation({
    onSuccess: () => {
      utils.audit.list.invalidate();
      utils.audit.getStats.invalidate();
      utils.audit.getUndoable.invalidate();
    },
  });

  const handleUndo = (auditId: string) => {
    if (confirm("Are you sure you want to undo this action?")) {
      undoMutation.mutate({ auditId });
    }
  };

  const handleFilterChange = () => {
    setPage(0);
  };

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Audit Log</CardTitle>
          <CardDescription>Error loading audit log</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-destructive">{error.message}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Stats */}
      {stats && (
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total Actions</CardDescription>
              <CardTitle className="text-2xl">{stats.totalActions}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Undoable</CardDescription>
              <CardTitle className="text-2xl">{stats.undoableCount}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>By Autopilot</CardDescription>
              <CardTitle className="text-2xl">{stats.autopilotCount}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>By User</CardDescription>
              <CardTitle className="text-2xl">{stats.userCount}</CardTitle>
            </CardHeader>
          </Card>
        </div>
      )}

      {/* Main Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Audit Log</CardTitle>
              <CardDescription>
                Track all actions and undo recent changes
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <Select
                value={actionTypeFilter}
                onValueChange={(value) => {
                  setActionTypeFilter(value);
                  handleFilterChange();
                }}
              >
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="Filter by action" />
                </SelectTrigger>
                <SelectContent>
                  {ACTION_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={sourceFilter}
                onValueChange={(value) => {
                  setSourceFilter(value);
                  handleFilterChange();
                }}
              >
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Filter by source" />
                </SelectTrigger>
                <SelectContent>
                  {SOURCE_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : (
            <>
              <AuditLogTable
                entries={data?.entries ?? []}
                onUndo={handleUndo}
                isUndoing={undoMutation.isPending}
              />

              {/* Pagination */}
              {data && data.totalCount > pageSize && (
                <div className="flex items-center justify-between mt-4">
                  <p className="text-sm text-muted-foreground">
                    Showing {page * pageSize + 1} to{" "}
                    {Math.min((page + 1) * pageSize, data.totalCount)} of{" "}
                    {data.totalCount} entries
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => Math.max(0, p - 1))}
                      disabled={page === 0}
                    >
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => p + 1)}
                      disabled={!data.hasMore}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default AuditLog;
