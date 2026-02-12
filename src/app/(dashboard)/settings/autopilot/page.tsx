"use client";

import { ArrowLeft, Zap, Clock, TrendingDown, Bell } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { OfferRulesConfig } from "@/components/autopilot/offer-rules-config";
import { RepriceRulesConfig } from "@/components/autopilot/reprice-rules-config";
import { PendingActions } from "@/components/autopilot/pending-actions";
import { trpc } from "@/lib/trpc/client";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

function RecentActivityCard() {
  const { data: recentActions, isLoading } = trpc.autopilot.getRecentActions.useQuery({
    limit: 5,
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground">Loading...</div>
        </CardContent>
      </Card>
    );
  }

  const actions = recentActions ?? [];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Recent Activity</CardTitle>
        <CardDescription>Latest autopilot actions</CardDescription>
      </CardHeader>
      <CardContent>
        {actions.length === 0 ? (
          <p className="text-sm text-muted-foreground">No recent activity</p>
        ) : (
          <ul className="space-y-3">
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            {actions.map((action: any) => (
              <li key={action.id} className="flex items-center justify-between text-sm">
                <div className="flex flex-col">
                  <span className="font-medium line-clamp-1">
                    {action.item?.title ?? "Unknown Item"}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {action.actionType.replace("_", " ")}
                  </span>
                </div>
                <Badge
                  variant={
                    action.status === "executed"
                      ? "success"
                      : action.status === "pending"
                        ? "warning"
                        : action.status === "rejected"
                          ? "destructive"
                          : "secondary"
                  }
                >
                  {action.status}
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function RateLimitCard() {
  const { data: rateLimits } = trpc.autopilot.getRateLimitStatus.useQuery();

  if (!rateLimits) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Daily Limits</CardTitle>
        <CardDescription>Remaining automated actions today</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm">eBay Revisions</span>
          <span className="text-sm font-medium">
            {rateLimits.ebayRevisions.remaining} / {rateLimits.ebayRevisions.daily}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm">Auto Reprices</span>
          <span className="text-sm font-medium">
            {rateLimits.reprices.remaining} / {rateLimits.reprices.daily}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm">Auto Accepts</span>
          <span className="text-sm font-medium">
            {rateLimits.autoAccepts.remaining} / {rateLimits.autoAccepts.daily}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

export default function AutopilotSettingsPage() {
  const { data: pendingCount } = trpc.autopilot.getPendingCount.useQuery();
  const pendingBadge = pendingCount?.count ?? 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/settings">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Settings
          </Button>
        </Link>
      </div>

      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Zap className="h-8 w-8" />
          Autopilot Settings
        </h1>
        <p className="text-muted-foreground">
          Configure automated handling of offers, pricing, and inventory
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Tabs defaultValue="offers" className="space-y-4">
            <TabsList>
              <TabsTrigger value="offers" className="gap-2">
                <Zap className="h-4 w-4" />
                Offer Rules
              </TabsTrigger>
              <TabsTrigger value="pending" className="gap-2">
                <Clock className="h-4 w-4" />
                Pending
                {pendingBadge > 0 && (
                  <Badge variant="destructive" className="ml-1 h-5 w-5 p-0 flex items-center justify-center text-xs">
                    {pendingBadge > 99 ? "99+" : pendingBadge}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="repricing" className="gap-2">
                <TrendingDown className="h-4 w-4" />
                Repricing
              </TabsTrigger>
              <TabsTrigger value="notifications" className="gap-2" disabled>
                <Bell className="h-4 w-4" />
                Notifications
              </TabsTrigger>
            </TabsList>

            <TabsContent value="offers">
              <OfferRulesConfig />
            </TabsContent>

            <TabsContent value="pending">
              <PendingActions />
            </TabsContent>

            <TabsContent value="repricing">
              <RepriceRulesConfig />
            </TabsContent>

            <TabsContent value="notifications">
              <Card>
                <CardHeader>
                  <CardTitle>Notification Settings</CardTitle>
                  <CardDescription>Coming soon</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">
                    Configure how you get notified about autopilot actions.
                  </p>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        <div className="space-y-6">
          <RecentActivityCard />
          <RateLimitCard />
        </div>
      </div>
    </div>
  );
}
