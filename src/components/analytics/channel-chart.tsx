"use client";

import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface ChannelData {
  channel: string;
  sales: number;
  revenue: number;
  profit: number;
  avgPrice: number;
}

interface ChannelChartProps {
  data: ChannelData[];
  loading?: boolean;
}

const COLORS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
];

const CHANNEL_NAMES: Record<string, string> = {
  ebay: "eBay",
  poshmark: "Poshmark",
  mercari: "Mercari",
  depop: "Depop",
};

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
};

interface TooltipProps {
  active?: boolean;
  payload?: Array<{
    name: string;
    value: number;
    payload: {
      channel: string;
      sales: number;
      revenue: number;
      profit: number;
    };
  }>;
}

const CustomPieTooltip = ({ active, payload }: TooltipProps) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="rounded-lg border bg-background p-3 shadow-md">
        <p className="text-sm font-medium mb-2">
          {CHANNEL_NAMES[data.channel] || data.channel}
        </p>
        <div className="space-y-1 text-sm">
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground">Sales:</span>
            <span className="font-medium">{data.sales}</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground">Revenue:</span>
            <span className="font-medium">{formatCurrency(data.revenue)}</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground">Profit:</span>
            <span className="font-medium">{formatCurrency(data.profit)}</span>
          </div>
        </div>
      </div>
    );
  }
  return null;
};

export function ChannelChart({ data, loading = false }: ChannelChartProps) {
  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Sales by Channel</CardTitle>
          <CardDescription>Performance breakdown by marketplace</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[300px] w-full bg-muted animate-pulse rounded" />
        </CardContent>
      </Card>
    );
  }

  const hasData = data.length > 0 && data.some((d) => d.sales > 0);

  if (!hasData) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Sales by Channel</CardTitle>
          <CardDescription>Performance breakdown by marketplace</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center h-[300px] text-center">
            <p className="text-muted-foreground">No channel data yet</p>
            <p className="text-sm text-muted-foreground mt-1">
              Data will appear once you make sales across channels
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Transform data for charts
  const pieData = data.map((d) => ({
    ...d,
    name: CHANNEL_NAMES[d.channel] || d.channel,
  }));

  const barData = data.map((d) => ({
    ...d,
    name: CHANNEL_NAMES[d.channel] || d.channel,
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Sales by Channel</CardTitle>
        <CardDescription>Performance breakdown by marketplace</CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="pie">
          <TabsList className="mb-4">
            <TabsTrigger value="pie">Distribution</TabsTrigger>
            <TabsTrigger value="bar">Comparison</TabsTrigger>
          </TabsList>
          <TabsContent value="pie">
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    dataKey="revenue"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    innerRadius={60}
                    paddingAngle={2}
                    label={({ name, percent }) =>
                      `${name} ${((percent ?? 0) * 100).toFixed(0)}%`
                    }
                    labelLine={false}
                  >
                    {pieData.map((_, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={COLORS[index % COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomPieTooltip />} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </TabsContent>
          <TabsContent value="bar">
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 12 }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    tickFormatter={(value) => `$${value}`}
                    tick={{ fontSize: 12 }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip
                    formatter={(value) =>
                      typeof value === 'number' ? formatCurrency(value) : value
                    }
                  />
                  <Legend />
                  <Bar
                    dataKey="revenue"
                    name="Revenue"
                    fill="hsl(var(--chart-1))"
                    radius={[4, 4, 0, 0]}
                  />
                  <Bar
                    dataKey="profit"
                    name="Profit"
                    fill="hsl(var(--chart-2))"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
