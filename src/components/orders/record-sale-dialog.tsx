"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Loader2, AlertTriangle, Package } from "lucide-react";
import { CHANNEL_NAMES, type Channel } from "@/lib/constants";

interface InventoryItem {
  id: string;
  title: string;
  sku: string;
  askingPrice: number;
  costBasis: number | null;
  imageUrl?: string;
}

interface RecordSaleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: InventoryItem[];
  isLoadingItems?: boolean;
  onSubmit: (data: {
    itemId: string;
    channel: Channel;
    salePrice: number;
    platformFees?: number;
    shippingCost?: number;
    buyerUsername?: string;
  }) => Promise<{ orderId: string; netProfit: number }>;
  isSubmitting?: boolean;
}

// Default platform fee percentages
const PLATFORM_FEES: Record<string, number> = {
  poshmark: 0.2, // 20%
  mercari: 0.1, // 10%
  depop: 0.1, // 10%
};

export function RecordSaleDialog({
  open,
  onOpenChange,
  items,
  isLoadingItems = false,
  onSubmit,
  isSubmitting = false,
}: RecordSaleDialogProps) {
  const [selectedItemId, setSelectedItemId] = useState<string>("");
  const [channel, setChannel] = useState<Channel | "">("");
  const [salePrice, setSalePrice] = useState("");
  const [platformFees, setPlatformFees] = useState("");
  const [shippingCost, setShippingCost] = useState("");
  const [buyerUsername, setBuyerUsername] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [delistWarning, setDelistWarning] = useState<string[]>([]);

  const selectedItem = items.find((item) => item.id === selectedItemId);

  // Calculate estimated fees when channel or sale price changes
  const handleSalePriceChange = (value: string) => {
    setSalePrice(value);
    if (channel && value && !platformFees) {
      const price = parseFloat(value);
      if (!isNaN(price)) {
        const feeRate = PLATFORM_FEES[channel] || 0;
        setPlatformFees((price * feeRate).toFixed(2));
      }
    }
  };

  const handleChannelChange = (value: string) => {
    setChannel(value as Channel);
    if (salePrice && !platformFees) {
      const price = parseFloat(salePrice);
      if (!isNaN(price)) {
        const feeRate = PLATFORM_FEES[value] || 0;
        setPlatformFees((price * feeRate).toFixed(2));
      }
    }
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!selectedItemId) {
      newErrors.item = "Please select an item";
    }

    if (!channel) {
      newErrors.channel = "Please select a channel";
    }

    if (!salePrice || isNaN(parseFloat(salePrice)) || parseFloat(salePrice) <= 0) {
      newErrors.salePrice = "Please enter a valid sale price";
    }

    if (platformFees && isNaN(parseFloat(platformFees))) {
      newErrors.platformFees = "Please enter a valid amount";
    }

    if (shippingCost && isNaN(parseFloat(shippingCost))) {
      newErrors.shippingCost = "Please enter a valid amount";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate() || !channel) return;

    await onSubmit({
      itemId: selectedItemId,
      channel: channel as Channel,
      salePrice: parseFloat(salePrice),
      platformFees: platformFees ? parseFloat(platformFees) : undefined,
      shippingCost: shippingCost ? parseFloat(shippingCost) : undefined,
      buyerUsername: buyerUsername || undefined,
    });

    // Delist is now handled by Inngest background job
    // User will be notified asynchronously
    handleClose();
  };

  const handleClose = () => {
    setSelectedItemId("");
    setChannel("");
    setSalePrice("");
    setPlatformFees("");
    setShippingCost("");
    setBuyerUsername("");
    setErrors({});
    setDelistWarning([]);
    onOpenChange(false);
  };

  // Calculate estimated profit
  const estimatedProfit = (() => {
    if (!salePrice) return null;
    const price = parseFloat(salePrice);
    if (isNaN(price)) return null;

    const fees = platformFees ? parseFloat(platformFees) : 0;
    const shipping = shippingCost ? parseFloat(shippingCost) : 0;
    const cost = selectedItem?.costBasis ?? 0;

    return price - fees - shipping - cost;
  })();

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Record Manual Sale</DialogTitle>
          <DialogDescription>
            Record a sale made on Poshmark, Mercari, or Depop. This will update
            inventory and notify you to delist from other channels.
          </DialogDescription>
        </DialogHeader>

        {delistWarning.length > 0 ? (
          <div className="space-y-4">
            <div className="flex items-start gap-3 p-4 rounded-lg bg-yellow-50 dark:bg-yellow-950 border border-yellow-200 dark:border-yellow-800">
              <AlertTriangle className="h-5 w-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
              <div className="space-y-2">
                <p className="font-medium text-yellow-800 dark:text-yellow-200">
                  Remember to delist from other channels
                </p>
                <p className="text-sm text-yellow-700 dark:text-yellow-300">
                  This item was listed on the following channels. Please
                  manually remove the listings:
                </p>
                <ul className="text-sm text-yellow-700 dark:text-yellow-300 list-disc list-inside">
                  {delistWarning.map((ch) => (
                    <li key={ch}>{CHANNEL_NAMES[ch as Channel]}</li>
                  ))}
                </ul>
              </div>
            </div>
            <DialogFooter>
              <Button onClick={handleClose}>Done</Button>
            </DialogFooter>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Item Selection */}
            <div className="space-y-2">
              <Label htmlFor="item">Item</Label>
              {isLoadingItems ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <Select
                  value={selectedItemId}
                  onValueChange={setSelectedItemId}
                  disabled={isSubmitting}
                >
                  <SelectTrigger id="item">
                    <SelectValue placeholder="Select an item" />
                  </SelectTrigger>
                  <SelectContent>
                    {items.map((item) => (
                      <SelectItem key={item.id} value={item.id}>
                        <div className="flex items-center gap-2">
                          {item.imageUrl ? (
                            <img
                              src={item.imageUrl}
                              alt=""
                              className="h-6 w-6 rounded object-cover"
                            />
                          ) : (
                            <Package className="h-6 w-6 text-muted-foreground" />
                          )}
                          <span className="truncate max-w-[250px]">
                            {item.title}
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {errors.item && (
                <p className="text-sm text-destructive">{errors.item}</p>
              )}
              {selectedItem && (
                <p className="text-xs text-muted-foreground">
                  Asking: ${selectedItem.askingPrice.toFixed(2)} | Cost:{" "}
                  {selectedItem.costBasis
                    ? `$${selectedItem.costBasis.toFixed(2)}`
                    : "-"}
                </p>
              )}
            </div>

            {/* Channel Selection */}
            <div className="space-y-2">
              <Label htmlFor="channel">Sold On</Label>
              <Select
                value={channel}
                onValueChange={handleChannelChange}
                disabled={isSubmitting}
              >
                <SelectTrigger id="channel">
                  <SelectValue placeholder="Select channel" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="poshmark">Poshmark</SelectItem>
                  <SelectItem value="mercari">Mercari</SelectItem>
                  <SelectItem value="depop">Depop</SelectItem>
                </SelectContent>
              </Select>
              {errors.channel && (
                <p className="text-sm text-destructive">{errors.channel}</p>
              )}
            </div>

            {/* Sale Price */}
            <div className="space-y-2">
              <Label htmlFor="salePrice">Sale Price</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                  $
                </span>
                <Input
                  id="salePrice"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  className="pl-7"
                  value={salePrice}
                  onChange={(e) => handleSalePriceChange(e.target.value)}
                  disabled={isSubmitting}
                />
              </div>
              {errors.salePrice && (
                <p className="text-sm text-destructive">{errors.salePrice}</p>
              )}
            </div>

            {/* Platform Fees */}
            <div className="space-y-2">
              <Label htmlFor="platformFees">Platform Fees</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                  $
                </span>
                <Input
                  id="platformFees"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  className="pl-7"
                  value={platformFees}
                  onChange={(e) => setPlatformFees(e.target.value)}
                  disabled={isSubmitting}
                />
              </div>
              {errors.platformFees && (
                <p className="text-sm text-destructive">{errors.platformFees}</p>
              )}
              <p className="text-xs text-muted-foreground">
                Auto-calculated based on typical platform fees. Adjust if needed.
              </p>
            </div>

            {/* Shipping Cost */}
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
                  disabled={isSubmitting}
                />
              </div>
              {errors.shippingCost && (
                <p className="text-sm text-destructive">{errors.shippingCost}</p>
              )}
            </div>

            {/* Buyer Username */}
            <div className="space-y-2">
              <Label htmlFor="buyerUsername">Buyer Username (optional)</Label>
              <Input
                id="buyerUsername"
                placeholder="Enter buyer's username"
                value={buyerUsername}
                onChange={(e) => setBuyerUsername(e.target.value)}
                disabled={isSubmitting}
              />
            </div>

            {/* Estimated Profit */}
            {estimatedProfit !== null && (
              <div className="p-3 rounded-lg bg-muted">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Estimated Profit</span>
                  <span
                    className={`font-semibold ${
                      estimatedProfit >= 0
                        ? "text-green-600 dark:text-green-400"
                        : "text-red-600 dark:text-red-400"
                    }`}
                  >
                    ${estimatedProfit.toFixed(2)}
                  </span>
                </div>
              </div>
            )}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Record Sale
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
