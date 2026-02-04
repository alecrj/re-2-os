"use client";

/**
 * Listing Form Component
 *
 * Form for creating/editing inventory item details:
 * - Title and description
 * - Condition selector
 * - Pricing fields
 * - Item specifics as editable tags
 */

import * as React from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RefreshCw, Sparkles, X, Plus } from "lucide-react";

// ============ TYPES ============

export type Condition = "new" | "like_new" | "good" | "fair" | "poor";

export interface ListingFormData {
  title: string;
  description: string;
  condition: Condition;
  askingPrice: number;
  floorPrice: number | null;
  costBasis: number | null;
  itemSpecifics: Record<string, string>;
  suggestedCategory: string | null;
}

export interface SuggestedPrice {
  min: number;
  max: number;
  recommended: number;
}

interface ListingFormProps {
  data: ListingFormData;
  onChange: (data: ListingFormData) => void;
  suggestedPrice?: SuggestedPrice | null;
  aiConfidence?: number | null;
  onRegenerateTitle?: () => void;
  onRegenerateDescription?: () => void;
  isRegenerating?: boolean;
  className?: string;
  errors?: Partial<Record<keyof ListingFormData, string>>;
}

// ============ CONSTANTS ============

const conditionOptions: { value: Condition; label: string; description: string }[] = [
  { value: "new", label: "New", description: "Brand new, never used" },
  { value: "like_new", label: "Like New", description: "Excellent condition, minimal wear" },
  { value: "good", label: "Good", description: "Normal wear, fully functional" },
  { value: "fair", label: "Fair", description: "Visible wear but works well" },
  { value: "poor", label: "Poor", description: "Heavy wear, may have issues" },
];

// ============ COMPONENT ============

export function ListingForm({
  data,
  onChange,
  suggestedPrice,
  aiConfidence,
  onRegenerateTitle,
  onRegenerateDescription,
  isRegenerating,
  className,
  errors,
}: ListingFormProps) {
  const [newSpecificKey, setNewSpecificKey] = React.useState("");
  const [newSpecificValue, setNewSpecificValue] = React.useState("");

  const updateField = <K extends keyof ListingFormData>(
    field: K,
    value: ListingFormData[K]
  ) => {
    onChange({ ...data, [field]: value });
  };

  const addItemSpecific = () => {
    if (newSpecificKey.trim() && newSpecificValue.trim()) {
      updateField("itemSpecifics", {
        ...data.itemSpecifics,
        [newSpecificKey.trim()]: newSpecificValue.trim(),
      });
      setNewSpecificKey("");
      setNewSpecificValue("");
    }
  };

  const removeItemSpecific = (key: string) => {
    const newSpecifics = { ...data.itemSpecifics };
    delete newSpecifics[key];
    updateField("itemSpecifics", newSpecifics);
  };

  const handlePriceInput = (
    value: string,
    field: "askingPrice" | "floorPrice" | "costBasis"
  ) => {
    const numValue = parseFloat(value);
    if (field === "askingPrice") {
      updateField(field, isNaN(numValue) ? 0 : numValue);
    } else {
      updateField(field, isNaN(numValue) || value === "" ? null : numValue);
    }
  };

  return (
    <div className={cn("space-y-6", className)}>
      {/* AI Confidence Indicator */}
      {aiConfidence !== null && aiConfidence !== undefined && (
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-purple-500" />
          <span className="text-sm text-muted-foreground">
            AI Confidence: {Math.round(aiConfidence * 100)}%
          </span>
          <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
            <div
              className={cn(
                "h-full transition-all",
                aiConfidence >= 0.8
                  ? "bg-green-500"
                  : aiConfidence >= 0.6
                    ? "bg-yellow-500"
                    : "bg-red-500"
              )}
              style={{ width: `${aiConfidence * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* Title */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium">
            Title <span className="text-destructive">*</span>
          </label>
          {onRegenerateTitle && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onRegenerateTitle}
              disabled={isRegenerating}
              className="text-xs"
            >
              <RefreshCw
                className={cn("h-3 w-3 mr-1", isRegenerating && "animate-spin")}
              />
              Regenerate
            </Button>
          )}
        </div>
        <Input
          value={data.title}
          onChange={(e) => updateField("title", e.target.value)}
          maxLength={80}
          placeholder="Enter item title..."
          className={cn(errors?.title && "border-destructive")}
        />
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>{errors?.title && <span className="text-destructive">{errors.title}</span>}</span>
          <span>{data.title.length}/80</span>
        </div>
      </div>

      {/* Description */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium">
            Description <span className="text-destructive">*</span>
          </label>
          {onRegenerateDescription && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onRegenerateDescription}
              disabled={isRegenerating}
              className="text-xs"
            >
              <RefreshCw
                className={cn("h-3 w-3 mr-1", isRegenerating && "animate-spin")}
              />
              Regenerate
            </Button>
          )}
        </div>
        <Textarea
          value={data.description}
          onChange={(e) => updateField("description", e.target.value)}
          rows={6}
          placeholder="Enter item description..."
          className={cn(errors?.description && "border-destructive")}
        />
        {errors?.description && (
          <p className="text-xs text-destructive">{errors.description}</p>
        )}
      </div>

      {/* Condition */}
      <div className="space-y-2">
        <label className="text-sm font-medium">
          Condition <span className="text-destructive">*</span>
        </label>
        <Select
          value={data.condition}
          onValueChange={(value) => updateField("condition", value as Condition)}
        >
          <SelectTrigger className={cn(errors?.condition && "border-destructive")}>
            <SelectValue placeholder="Select condition" />
          </SelectTrigger>
          <SelectContent>
            {conditionOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                <div className="flex flex-col">
                  <span>{option.label}</span>
                  <span className="text-xs text-muted-foreground">
                    {option.description}
                  </span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {errors?.condition && (
          <p className="text-xs text-destructive">{errors.condition}</p>
        )}
      </div>

      {/* Pricing */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium">Pricing</label>
          {suggestedPrice && (
            <span className="text-xs text-muted-foreground">
              Suggested: ${suggestedPrice.min.toFixed(0)} - ${suggestedPrice.max.toFixed(0)}
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Asking Price */}
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">
              Asking Price <span className="text-destructive">*</span>
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                $
              </span>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={data.askingPrice || ""}
                onChange={(e) => handlePriceInput(e.target.value, "askingPrice")}
                className={cn("pl-7", errors?.askingPrice && "border-destructive")}
                placeholder="0.00"
              />
            </div>
            {suggestedPrice && (
              <Button
                type="button"
                variant="link"
                size="sm"
                className="h-auto p-0 text-xs"
                onClick={() => updateField("askingPrice", suggestedPrice.recommended)}
              >
                Use suggested: ${suggestedPrice.recommended.toFixed(2)}
              </Button>
            )}
          </div>

          {/* Floor Price */}
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">
              Floor Price (optional)
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                $
              </span>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={data.floorPrice ?? ""}
                onChange={(e) => handlePriceInput(e.target.value, "floorPrice")}
                className="pl-7"
                placeholder="0.00"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Minimum acceptable price
            </p>
          </div>

          {/* Cost Basis */}
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">
              Cost Basis (optional)
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                $
              </span>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={data.costBasis ?? ""}
                onChange={(e) => handlePriceInput(e.target.value, "costBasis")}
                className="pl-7"
                placeholder="0.00"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              What you paid for the item
            </p>
          </div>
        </div>

        {/* Profit Estimate */}
        {data.askingPrice > 0 && data.costBasis !== null && data.costBasis > 0 && (
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">Estimated Profit:</span>
            <span
              className={cn(
                "font-medium",
                data.askingPrice - data.costBasis > 0
                  ? "text-green-600"
                  : "text-red-600"
              )}
            >
              ${(data.askingPrice - data.costBasis).toFixed(2)}
            </span>
            <span className="text-muted-foreground text-xs">
              (before fees)
            </span>
          </div>
        )}
      </div>

      {/* Category */}
      {data.suggestedCategory && (
        <div className="space-y-2">
          <label className="text-sm font-medium">Category</label>
          <div className="flex items-center gap-2">
            <Badge variant="secondary">{data.suggestedCategory}</Badge>
            <span className="text-xs text-muted-foreground">
              Suggested by AI
            </span>
          </div>
        </div>
      )}

      {/* Item Specifics */}
      <div className="space-y-3">
        <label className="text-sm font-medium">Item Specifics</label>

        {/* Existing Specifics */}
        {Object.keys(data.itemSpecifics).length > 0 && (
          <div className="flex flex-wrap gap-2">
            {Object.entries(data.itemSpecifics).map(([key, value]) => (
              <Badge
                key={key}
                variant="secondary"
                className="flex items-center gap-1 py-1.5 pl-3 pr-1.5"
              >
                <span className="text-muted-foreground">{key}:</span>
                <span>{value}</span>
                <button
                  type="button"
                  onClick={() => removeItemSpecific(key)}
                  className="ml-1 rounded-full hover:bg-muted p-0.5"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
        )}

        {/* Add New Specific */}
        <div className="flex gap-2">
          <Input
            placeholder="Name (e.g., Brand)"
            value={newSpecificKey}
            onChange={(e) => setNewSpecificKey(e.target.value)}
            className="flex-1"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addItemSpecific();
              }
            }}
          />
          <Input
            placeholder="Value (e.g., Nike)"
            value={newSpecificValue}
            onChange={(e) => setNewSpecificValue(e.target.value)}
            className="flex-1"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addItemSpecific();
              }
            }}
          />
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={addItemSpecific}
            disabled={!newSpecificKey.trim() || !newSpecificValue.trim()}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Add item details like Brand, Size, Color, Material, etc.
        </p>
      </div>
    </div>
  );
}

export default ListingForm;
