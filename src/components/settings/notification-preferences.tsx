"use client";

import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Bell,
  Mail,
  Loader2,
  ShoppingCart,
  Zap,
  DollarSign,
  AlertTriangle,
  TrendingDown,
  Clock,
  WifiOff,
} from "lucide-react";
import { trpc } from "@/lib/trpc/client";
import { useToast } from "@/hooks/use-toast";
import { type NotificationPrefs, DEFAULT_NOTIFICATION_PREFS } from "@/server/db/schema";

interface NotificationCategory {
  key: keyof NotificationPrefs;
  label: string;
  description: string;
  icon: React.ElementType;
}

const CATEGORIES: NotificationCategory[] = [
  {
    key: "offerReceived",
    label: "Offer Received",
    description: "When a buyer makes an offer on one of your listings",
    icon: ShoppingCart,
  },
  {
    key: "offerAutoActioned",
    label: "Autopilot Offer Actions",
    description: "When autopilot accepts, declines, or counters an offer",
    icon: Zap,
  },
  {
    key: "saleConfirmed",
    label: "Sale Confirmed",
    description: "When an item sells on any channel",
    icon: DollarSign,
  },
  {
    key: "delistAlert",
    label: "Delist Alerts",
    description: "When an item needs to be delisted from other channels after a sale",
    icon: AlertTriangle,
  },
  {
    key: "repriceAlert",
    label: "Reprice Alerts",
    description: "When autopilot adjusts a listing price",
    icon: TrendingDown,
  },
  {
    key: "staleListingAlert",
    label: "Stale Listing Alerts",
    description: "When a listing has been active for too long without selling",
    icon: Clock,
  },
  {
    key: "syncError",
    label: "Sync Errors",
    description: "When there is a problem syncing with a marketplace",
    icon: WifiOff,
  },
];

export function NotificationPreferences() {
  const { toast } = useToast();

  const prefsQuery = trpc.settings.getNotificationPrefs.useQuery();
  const updateMutation = trpc.settings.updateNotificationPrefs.useMutation({
    onSuccess: () => {
      toast({
        title: "Preferences saved",
        description: "Your notification preferences have been updated.",
      });
    },
    onError: () => {
      toast({
        title: "Save failed",
        description: "Could not save preferences. Please try again.",
        variant: "destructive",
      });
    },
  });

  const [prefs, setPrefs] = useState<NotificationPrefs>(DEFAULT_NOTIFICATION_PREFS);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    if (prefsQuery.data) {
      setPrefs(prefsQuery.data);
      setHasChanges(false);
    }
  }, [prefsQuery.data]);

  const handleToggle = (
    category: keyof NotificationPrefs,
    channel: "inApp" | "email",
    value: boolean
  ) => {
    setPrefs((prev) => ({
      ...prev,
      [category]: {
        ...prev[category],
        [channel]: value,
      },
    }));
    setHasChanges(true);
  };

  const handleSave = () => {
    updateMutation.mutate(prefs);
    setHasChanges(false);
  };

  if (prefsQuery.isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Notification Preferences
          </CardTitle>
          <CardDescription>
            Choose what notifications you receive and how
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex items-center justify-between py-3">
              <div className="space-y-1">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-3 w-64" />
              </div>
              <div className="flex gap-6">
                <Skeleton className="h-6 w-10" />
                <Skeleton className="h-6 w-10" />
              </div>
            </div>
          ))}
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
              <Bell className="h-5 w-5" />
              Notification Preferences
            </CardTitle>
            <CardDescription>
              Choose what notifications you receive and how
            </CardDescription>
          </div>
          <Button
            onClick={handleSave}
            disabled={!hasChanges || updateMutation.isPending}
            size="sm"
          >
            {updateMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : null}
            Save Changes
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {/* Column Headers */}
        <div className="flex items-center justify-end gap-8 pb-3 pr-1">
          <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <Bell className="h-3.5 w-3.5" />
            In-App
          </div>
          <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <Mail className="h-3.5 w-3.5" />
            Email
          </div>
        </div>

        <Separator className="mb-2" />

        <div className="space-y-1">
          {CATEGORIES.map((category) => {
            const Icon = category.icon;
            const pref = prefs[category.key];

            return (
              <div
                key={category.key}
                className="flex items-center justify-between py-3"
              >
                <div className="flex items-start gap-3">
                  <Icon className="h-4 w-4 mt-0.5 text-muted-foreground" />
                  <div>
                    <Label className="text-sm font-medium">
                      {category.label}
                    </Label>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {category.description}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-8 pl-4">
                  <Switch
                    checked={pref.inApp}
                    onCheckedChange={(checked) =>
                      handleToggle(category.key, "inApp", checked)
                    }
                    aria-label={`${category.label} in-app notifications`}
                  />
                  <Switch
                    checked={pref.email}
                    onCheckedChange={(checked) =>
                      handleToggle(category.key, "email", checked)
                    }
                    aria-label={`${category.label} email notifications`}
                  />
                </div>
              </div>
            );
          })}
        </div>

        <Separator className="mt-2" />

        <p className="text-xs text-muted-foreground mt-4">
          Email notifications are sent to your account email address.
          In-app notifications appear in your dashboard.
        </p>
      </CardContent>
    </Card>
  );
}
