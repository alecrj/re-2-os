"use client";

import { useState, useEffect } from "react";
import { Save, RotateCcw, TrendingDown } from "lucide-react";
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

interface RepriceRuleFormData {
  enabled: boolean;
  strategy: "time_decay" | "performance" | "competitive";
  maxDailyDrop: number;
  maxWeeklyDrop: number;
  respectFloorPrice: boolean;
  highValueThreshold: number;
}

const DEFAULT_FORM_DATA: RepriceRuleFormData = {
  enabled: false,
  strategy: "time_decay",
  maxDailyDrop: 0.1,
  maxWeeklyDrop: 0.2,
  respectFloorPrice: true,
  highValueThreshold: 200,
};

export function RepriceRulesConfig() {
  const [formData, setFormData] = useState<RepriceRuleFormData>(DEFAULT_FORM_DATA);
  const [hasChanges, setHasChanges] = useState(false);

  const utils = trpc.useUtils();

  // Fetch existing reprice rule
  const { data: rules, isLoading } = trpc.autopilot.listRules.useQuery();

  const saveRule = trpc.autopilot.upsertRepriceRule.useMutation({
    onSuccess: () => {
      setHasChanges(false);
      utils.autopilot.listRules.invalidate();
    },
  });

  // Find the reprice rule from the rules list
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const repriceRule = rules?.find((r: any) => r.ruleType === "reprice");

  // Initialize form from fetched data
  useEffect(() => {
    if (repriceRule) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const config = repriceRule.config as any;
      setFormData({
        enabled: repriceRule.enabled,
        strategy: config.strategy ?? "time_decay",
        maxDailyDrop: config.maxDailyDropPercent ?? 0.1,
        maxWeeklyDrop: config.maxWeeklyDropPercent ?? 0.2,
        respectFloorPrice: config.respectFloorPrice ?? true,
        highValueThreshold: config.highValueThreshold ?? 200,
      });
    }
  }, [repriceRule]);

  const updateField = <K extends keyof RepriceRuleFormData>(
    field: K,
    value: RepriceRuleFormData[K]
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setHasChanges(true);
  };

  const handleSave = () => {
    saveRule.mutate({
      id: repriceRule?.id ?? undefined,
      ...formData,
    });
  };

  const handleReset = () => {
    if (repriceRule) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const config = repriceRule.config as any;
      setFormData({
        enabled: repriceRule.enabled,
        strategy: config.strategy ?? "time_decay",
        maxDailyDrop: config.maxDailyDropPercent ?? 0.1,
        maxWeeklyDrop: config.maxWeeklyDropPercent ?? 0.2,
        respectFloorPrice: config.respectFloorPrice ?? true,
        highValueThreshold: config.highValueThreshold ?? 200,
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
          <CardTitle>Repricing Rules</CardTitle>
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

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <TrendingDown className="h-5 w-5" />
              Repricing Rules
            </CardTitle>
            <CardDescription>
              Automatically adjust prices based on time and performance
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Label htmlFor="reprice-enabled" className="text-sm">
              Enable Repricing
            </Label>
            <Switch
              id="reprice-enabled"
              checked={formData.enabled}
              onCheckedChange={(checked) => updateField("enabled", checked)}
            />
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-8">
        {/* Strategy Selection */}
        <div className="space-y-2">
          <Label className="text-base">Repricing Strategy</Label>
          <p className="text-sm text-muted-foreground">
            How prices should be adjusted over time
          </p>
          <Select
            value={formData.strategy}
            onValueChange={(value) =>
              updateField("strategy", value as "time_decay" | "performance" | "competitive")
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="time_decay">
                Time Decay - Gradually reduce price as listing ages
              </SelectItem>
              <SelectItem value="performance">
                Performance - Adjust based on views and engagement
              </SelectItem>
              <SelectItem value="competitive">
                Competitive - Match similar listings (coming soon)
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Max Daily Drop */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-base">Max Daily Price Drop</Label>
              <p className="text-sm text-muted-foreground">
                Maximum percentage a price can drop in a single day
              </p>
            </div>
            <span className="text-2xl font-bold text-orange-600 dark:text-orange-400">
              {(formData.maxDailyDrop * 100).toFixed(0)}%
            </span>
          </div>
          <Slider
            value={[formData.maxDailyDrop * 100]}
            onValueChange={([value]) =>
              updateField("maxDailyDrop", value / 100)
            }
            min={1}
            max={25}
            step={1}
            className="w-full"
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>1%</span>
            <span>25%</span>
          </div>
        </div>

        {/* Max Weekly Drop */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-base">Max Weekly Price Drop</Label>
              <p className="text-sm text-muted-foreground">
                Maximum cumulative price drop over a week
              </p>
            </div>
            <span className="text-2xl font-bold text-red-600 dark:text-red-400">
              {(formData.maxWeeklyDrop * 100).toFixed(0)}%
            </span>
          </div>
          <Slider
            value={[formData.maxWeeklyDrop * 100]}
            onValueChange={([value]) =>
              updateField("maxWeeklyDrop", value / 100)
            }
            min={1}
            max={50}
            step={1}
            className="w-full"
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>1%</span>
            <span>50%</span>
          </div>
        </div>

        {/* Floor Price Protection */}
        <div className="space-y-4 border-t pt-6">
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-base">Respect Floor Price</Label>
              <p className="text-sm text-muted-foreground">
                Never reprice below the item&apos;s floor price
              </p>
            </div>
            <Switch
              checked={formData.respectFloorPrice}
              onCheckedChange={(checked) =>
                updateField("respectFloorPrice", checked)
              }
            />
          </div>
        </div>

        {/* High Value Threshold */}
        <div className="space-y-4 border-t pt-6">
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-base">High Value Threshold</Label>
              <p className="text-sm text-muted-foreground">
                Items above this price require manual approval for repricing
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
