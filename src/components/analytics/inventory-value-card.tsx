"use client";

import { Package, TrendingUp, DollarSign, Archive } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";

interface InventoryValue {
  totalCost: number;
  totalAskingPrice: number;
  potentialProfit: number;
  itemCount: number;
}

interface InventoryValueCardProps {
  data: InventoryValue | undefined;
  loading?: boolean;
}

export function InventoryValueCard({ data, loading = false }: InventoryValueCardProps) {
  if (loading || !data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Inventory Value</CardTitle>
          <CardDescription>Current inventory investment and potential returns</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-16 bg-muted animate-pulse rounded" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const metrics = [
    {
      label: "Active Items",
      value: data.itemCount.toString(),
      icon: Package,
      color: "text-blue-600",
    },
    {
      label: "Total Investment",
      value: formatCurrency(data.totalCost),
      icon: DollarSign,
      color: "text-red-600",
    },
    {
      label: "Asking Total",
      value: formatCurrency(data.totalAskingPrice),
      icon: Archive,
      color: "text-gray-600",
    },
    {
      label: "Potential Profit",
      value: formatCurrency(data.potentialProfit),
      icon: TrendingUp,
      color: "text-green-600",
    },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Inventory Value</CardTitle>
        <CardDescription>Current inventory investment and potential returns</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4">
          {metrics.map((metric) => (
            <div
              key={metric.label}
              className="flex items-center gap-3 p-3 rounded-lg bg-muted/50"
            >
              <metric.icon className={`h-8 w-8 ${metric.color}`} />
              <div>
                <p className="text-xs text-muted-foreground">{metric.label}</p>
                <p className="text-lg font-semibold">{metric.value}</p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
