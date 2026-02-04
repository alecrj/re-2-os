"use client";

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
import { formatCurrency, truncate } from "@/lib/utils";

interface TopItem {
  id: string;
  title: string;
  sku: string;
  costBasis: number;
  salePrice: number;
  profit: number;
  margin: number;
  soldAt: Date | null;
  channel: string;
}

interface TopItemsTableProps {
  data: TopItem[];
  loading?: boolean;
  onSortChange?: (sortBy: "profit" | "revenue" | "margin") => void;
  sortBy?: "profit" | "revenue" | "margin";
}

const CHANNEL_COLORS: Record<string, string> = {
  ebay: "bg-blue-100 text-blue-800",
  poshmark: "bg-pink-100 text-pink-800",
  mercari: "bg-red-100 text-red-800",
  depop: "bg-orange-100 text-orange-800",
};

const CHANNEL_NAMES: Record<string, string> = {
  ebay: "eBay",
  poshmark: "Poshmark",
  mercari: "Mercari",
  depop: "Depop",
};

export function TopItemsTable({
  data,
  loading = false,
  onSortChange,
  sortBy = "profit",
}: TopItemsTableProps) {
  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Top Performing Items</CardTitle>
          <CardDescription>Your best sellers by profit, revenue, or margin</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-12 bg-muted animate-pulse rounded" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const hasData = data.length > 0;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Top Performing Items</CardTitle>
          <CardDescription>Your best sellers by profit, revenue, or margin</CardDescription>
        </div>
        <Select
          value={sortBy}
          onValueChange={(value) =>
            onSortChange?.(value as "profit" | "revenue" | "margin")
          }
        >
          <SelectTrigger className="w-[130px]">
            <SelectValue placeholder="Sort by" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="profit">By Profit</SelectItem>
            <SelectItem value="revenue">By Revenue</SelectItem>
            <SelectItem value="margin">By Margin</SelectItem>
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent>
        {!hasData ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <p className="text-muted-foreground">No sales data yet</p>
            <p className="text-sm text-muted-foreground mt-1">
              Top items will appear once you make sales
            </p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Item</TableHead>
                <TableHead>Channel</TableHead>
                <TableHead className="text-right">Cost</TableHead>
                <TableHead className="text-right">Sale Price</TableHead>
                <TableHead className="text-right">Profit</TableHead>
                <TableHead className="text-right">Margin</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>
                    <div>
                      <p className="font-medium">{truncate(item.title, 40)}</p>
                      <p className="text-xs text-muted-foreground">{item.sku}</p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="secondary"
                      className={CHANNEL_COLORS[item.channel] || ""}
                    >
                      {CHANNEL_NAMES[item.channel] || item.channel}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    {formatCurrency(item.costBasis)}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatCurrency(item.salePrice)}
                  </TableCell>
                  <TableCell className="text-right font-medium text-green-600">
                    {formatCurrency(item.profit)}
                  </TableCell>
                  <TableCell className="text-right">{item.margin}%</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
