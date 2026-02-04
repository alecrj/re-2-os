"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";

interface ShipOrderFormProps {
  orderId: string;
  onSubmit: (data: {
    orderId: string;
    trackingNumber: string;
    carrier: string;
    shippingCost?: number;
  }) => Promise<void>;
  onCancel?: () => void;
  isLoading?: boolean;
}

const CARRIERS = [
  { value: "usps", label: "USPS" },
  { value: "ups", label: "UPS" },
  { value: "fedex", label: "FedEx" },
  { value: "dhl", label: "DHL" },
  { value: "other", label: "Other" },
] as const;

export function ShipOrderForm({
  orderId,
  onSubmit,
  onCancel,
  isLoading = false,
}: ShipOrderFormProps) {
  const [trackingNumber, setTrackingNumber] = useState("");
  const [carrier, setCarrier] = useState<string>("");
  const [shippingCost, setShippingCost] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!trackingNumber.trim()) {
      newErrors.trackingNumber = "Tracking number is required";
    }

    if (!carrier) {
      newErrors.carrier = "Please select a carrier";
    }

    if (shippingCost && isNaN(parseFloat(shippingCost))) {
      newErrors.shippingCost = "Please enter a valid amount";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) return;

    await onSubmit({
      orderId,
      trackingNumber: trackingNumber.trim(),
      carrier,
      shippingCost: shippingCost ? parseFloat(shippingCost) : undefined,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="trackingNumber">Tracking Number</Label>
        <Input
          id="trackingNumber"
          placeholder="Enter tracking number"
          value={trackingNumber}
          onChange={(e) => setTrackingNumber(e.target.value)}
          disabled={isLoading}
        />
        {errors.trackingNumber && (
          <p className="text-sm text-destructive">{errors.trackingNumber}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="carrier">Carrier</Label>
        <Select value={carrier} onValueChange={setCarrier} disabled={isLoading}>
          <SelectTrigger id="carrier">
            <SelectValue placeholder="Select carrier" />
          </SelectTrigger>
          <SelectContent>
            {CARRIERS.map((c) => (
              <SelectItem key={c.value} value={c.value}>
                {c.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {errors.carrier && (
          <p className="text-sm text-destructive">{errors.carrier}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="shippingCost">Shipping Cost (optional)</Label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
            $
          </span>
          <Input
            id="shippingCost"
            type="number"
            step="0.01"
            min="0"
            placeholder="0.00"
            className="pl-7"
            value={shippingCost}
            onChange={(e) => setShippingCost(e.target.value)}
            disabled={isLoading}
          />
        </div>
        {errors.shippingCost && (
          <p className="text-sm text-destructive">{errors.shippingCost}</p>
        )}
        <p className="text-xs text-muted-foreground">
          Enter your actual shipping cost to calculate accurate profit.
        </p>
      </div>

      <div className="flex gap-2 justify-end">
        {onCancel && (
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={isLoading}
          >
            Cancel
          </Button>
        )}
        <Button type="submit" disabled={isLoading}>
          {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Mark as Shipped
        </Button>
      </div>
    </form>
  );
}
