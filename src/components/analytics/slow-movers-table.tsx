"use client";

import { AlertTriangle } from "lucide-react";
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
import { Badge } from "@/components/ui/badge";
import { formatCurrency, truncate } from "@/lib/utils";

interface SlowMover {
  id: string;
  title: string;
  sku: string;
  askingPrice: number;
  costBasis: number;
  listedAt: Date | null;
  daysListed: number;
}

interface SlowMoversTableProps {
  data: SlowMover[];
  loading?: boolean;
  daysThreshold?: number;
}

const getDaysColor = (days: number): string => {
  if (days >= 90) return "bg-red-100 text-red-800";
  if (days >= 60) return "bg-orange-100 text-orange-800";
  return "bg-yellow-100 text-yellow-800";
};

export function SlowMoversTable({
  data,
  loading = false,
  daysThreshold = 60,
}: SlowMoversTableProps) {
  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-orange-500" />
            Slow Moving Inventory
          </CardTitle>
          <CardDescription>
            Items listed for more than {daysThreshold} days
          </CardDescription>
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
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-orange-500" />
          Slow Moving Inventory
        </CardTitle>
        <CardDescription>
          Items listed for more than {daysThreshold} days - consider repricing
        </CardDescription>
      </CardHeader>
      <CardContent>
        {!hasData ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <p className="text-muted-foreground">No slow movers</p>
            <p className="text-sm text-muted-foreground mt-1">
              All your inventory is moving well
            </p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Item</TableHead>
                <TableHead className="text-right">Asking Price</TableHead>
                <TableHead className="text-right">Cost</TableHead>
                <TableHead className="text-right">Days Listed</TableHead>
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
                  <TableCell className="text-right">
                    {formatCurrency(item.askingPrice)}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatCurrency(item.costBasis)}
                  </TableCell>
                  <TableCell className="text-right">
                    <Badge variant="secondary" className={getDaysColor(item.daysListed)}>
                      {item.daysListed} days
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
