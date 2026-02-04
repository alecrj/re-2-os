"use client";

import { useState, useEffect } from "react";
import { Save, RotateCcw, Info, Zap } from "lucide-react";
import { trpc } from "@/lib/trpc/client";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";

interface OfferRuleFormData {
  enabled: boolean;
  autoAcceptThreshold: number;
  autoDeclineThreshold: number;
  autoCounterEnabled: boolean;
  counterStrategy: "floor" | "midpoint" | "asking-5%";
  maxCounterRounds: number;
  highValueThreshold: number;
}

const DEFAULT_FORM_DATA: OfferRuleFormData = {
  enabled: false,
  autoAcceptThreshold: 0.9,
  autoDeclineThreshold: 0.5,
  autoCounterEnabled: true,
  counterStrategy: "midpoint",
  maxCounterRounds: 2,
  highValueThreshold: 200,
};

export function OfferRulesConfig() {
  const [formData, setFormData] = useState<OfferRuleFormData>(DEFAULT_FORM_DATA);
  const [hasChanges, setHasChanges] = useState(false);

  const utils = trpc.useUtils();

  const { data: ruleData, isLoading } = trpc.autopilot.getOfferRule.useQuery();

  const saveRule = trpc.autopilot.upsertOfferRule.useMutation({
    onSuccess: () => {
      setHasChanges(false);
      utils.autopilot.getOfferRule.invalidate();
    },
  });

  // Initialize form from fetched data
  useEffect(() => {
    if (ruleData) {
      setFormData({
        enabled: ruleData.enabled,
        autoAcceptThreshold: ruleData.config.autoAcceptThreshold,
        autoDeclineThreshold: ruleData.config.autoDeclineThreshold,
        autoCounterEnabled: ruleData.config.autoCounterEnabled,
        counterStrategy: ruleData.config.counterStrategy,
        maxCounterRounds: ruleData.config.maxCounterRounds,
        highValueThreshold: ruleData.config.highValueThreshold,
      });
    }
  }, [ruleData]);

  const updateField = <K extends keyof OfferRuleFormData>(
    field: K,
    value: OfferRuleFormData[K]
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setHasChanges(true);
  };

  const handleSave = () => {
    saveRule.mutate({
      id: ruleData?.id ?? undefined,
      ...formData,
    });
  };

  const handleReset = () => {
    if (ruleData) {
      setFormData({
        enabled: ruleData.enabled,
        autoAcceptThreshold: ruleData.config.autoAcceptThreshold,
        autoDeclineThreshold: ruleData.config.autoDeclineThreshold,
        autoCounterEnabled: ruleData.config.autoCounterEnabled,
        counterStrategy: ruleData.config.counterStrategy,
        maxCounterRounds: ruleData.config.maxCounterRounds,
        highValueThreshold: ruleData.config.highValueThreshold,
      });
    } else {
      setFormData(DEFAULT_FORM_DATA);
    }
    setHasChanges(false);
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Offer Rules</CardTitle>
          <CardDescription>Loading configuration...</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </CardContent>
      </Card>
    );
  }

  // Calculate the "gray zone" for counter offers
  const grayZoneStart = formData.autoDeclineThreshold * 100;
  const grayZoneEnd = formData.autoAcceptThreshold * 100;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5" />
              Offer Rules
            </CardTitle>
            <CardDescription>
              Automatically handle incoming offers based on your preferences
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Label htmlFor="enabled" className="text-sm">
              Enable Autopilot
            </Label>
            <Switch
              id="enabled"
              checked={formData.enabled}
              onCheckedChange={(checked) => updateField("enabled", checked)}
            />
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-8">
        {/* Auto-Accept Threshold */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-base">Auto-Accept Threshold</Label>
              <p className="text-sm text-muted-foreground">
                Accept offers at or above this percentage of asking price
              </p>
            </div>
            <span className="text-2xl font-bold text-green-600 dark:text-green-400">
              {(formData.autoAcceptThreshold * 100).toFixed(0)}%
            </span>
          </div>
          <Slider
            value={[formData.autoAcceptThreshold * 100]}
            onValueChange={([value]) =>
              updateField("autoAcceptThreshold", value / 100)
            }
            min={50}
            max={100}
            step={1}
            className="w-full"
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>50%</span>
            <span>100%</span>
          </div>
        </div>

        {/* Auto-Decline Threshold */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-base">Auto-Decline Threshold</Label>
              <p className="text-sm text-muted-foreground">
                Decline offers at or below this percentage of asking price
              </p>
            </div>
            <span className="text-2xl font-bold text-red-600 dark:text-red-400">
              {(formData.autoDeclineThreshold * 100).toFixed(0)}%
            </span>
          </div>
          <Slider
            value={[formData.autoDeclineThreshold * 100]}
            onValueChange={([value]) =>
              updateField("autoDeclineThreshold", value / 100)
            }
            min={0}
            max={90}
            step={1}
            className="w-full"
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>0%</span>
            <span>90%</span>
          </div>
        </div>

        {/* Gray Zone Visualization */}
        <div className="rounded-lg bg-muted/50 p-4 space-y-2">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Info className="h-4 w-4" />
            Counter Offer Zone
          </div>
          <p className="text-sm text-muted-foreground">
            Offers between {grayZoneStart.toFixed(0)}% and {grayZoneEnd.toFixed(0)}%
            will {formData.autoCounterEnabled ? "receive a counter offer" : "require manual review"}.
          </p>
          <div className="h-2 w-full rounded-full bg-muted overflow-hidden flex">
            <div
              className="h-full bg-red-400"
              style={{ width: `${grayZoneStart}%` }}
            />
            <div
              className="h-full bg-yellow-400"
              style={{ width: `${grayZoneEnd - grayZoneStart}%` }}
            />
            <div
              className="h-full bg-green-400"
              style={{ width: `${100 - grayZoneEnd}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Decline</span>
            <span>Counter / Review</span>
            <span>Accept</span>
          </div>
        </div>

        {/* Counter Offer Settings */}
        <div className="space-y-4 border-t pt-6">
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-base">Enable Counter Offers</Label>
              <p className="text-sm text-muted-foreground">
                Automatically send counter offers for offers in the gray zone
              </p>
            </div>
            <Switch
              checked={formData.autoCounterEnabled}
              onCheckedChange={(checked) =>
                updateField("autoCounterEnabled", checked)
              }
            />
          </div>

          {formData.autoCounterEnabled && (
            <>
              <div className="space-y-2">
                <Label>Counter Strategy</Label>
                <Select
                  value={formData.counterStrategy}
                  onValueChange={(value) =>
                    updateField(
                      "counterStrategy",
                      value as "floor" | "midpoint" | "asking-5%"
                    )
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="floor">
                      Floor Price - Counter at your minimum acceptable price
                    </SelectItem>
                    <SelectItem value="midpoint">
                      Midpoint - Counter halfway between offer and asking
                    </SelectItem>
                    <SelectItem value="asking-5%">
                      5% Discount - Counter at 95% of asking price
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Max Counter Rounds</Label>
                <Select
                  value={formData.maxCounterRounds.toString()}
                  onValueChange={(value) =>
                    updateField("maxCounterRounds", parseInt(value, 10))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1 round</SelectItem>
                    <SelectItem value="2">2 rounds</SelectItem>
                    <SelectItem value="3">3 rounds</SelectItem>
                    <SelectItem value="4">4 rounds</SelectItem>
                    <SelectItem value="5">5 rounds</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  After this many counter offers, require manual review
                </p>
              </div>
            </>
          )}
        </div>

        {/* High Value Threshold */}
        <div className="space-y-4 border-t pt-6">
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-base">High Value Threshold</Label>
              <p className="text-sm text-muted-foreground">
                Items above this price always require manual review
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">$</span>
              <Input
                type="number"
                value={formData.highValueThreshold}
                onChange={(e) =>
                  updateField("highValueThreshold", parseFloat(e.target.value) || 0)
                }
                className="w-24"
                min={0}
                step={50}
              />
            </div>
          </div>
        </div>
      </CardContent>
      <CardFooter className="flex justify-between">
        <Button
          variant="outline"
          onClick={handleReset}
          disabled={!hasChanges || saveRule.isPending}
        >
          <RotateCcw className="h-4 w-4 mr-2" />
          Reset
        </Button>
        <Button onClick={handleSave} disabled={!hasChanges || saveRule.isPending}>
          <Save className="h-4 w-4 mr-2" />
          {saveRule.isPending ? "Saving..." : "Save Changes"}
        </Button>
      </CardFooter>
    </Card>
  );
}
