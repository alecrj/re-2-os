"use client";

/**
 * Cross-List Dialog Component
 *
 * A dialog that displays optimized templates for cross-listing items
 * to Poshmark, Mercari, or Depop with copy-paste functionality.
 */

import * as React from "react";
import { cn } from "@/lib/utils";
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
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { TemplateField } from "./template-field";
import {
  ExternalLink,
  Download,
  CheckCircle2,
  Loader2,
  Image as ImageIcon,
  ArrowRight,
} from "lucide-react";

// ============ TYPES ============

export type AssistedChannel = "poshmark" | "mercari" | "depop";

export interface CrossListItem {
  id: string;
  title: string;
  description: string;
  price: number;
  condition: string;
  imageUrls: string[];
  itemSpecifics?: Record<string, string>;
}

interface CrossListTemplate {
  title: string;
  description: string;
  price: number;
  copyableFields: Record<string, string>;
  instructions: string[];
}

export interface CrossListDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: CrossListItem;
  targetChannel: AssistedChannel;
  template: CrossListTemplate | null;
  isLoadingTemplate: boolean;
  onMarkListed: (externalUrl?: string) => void;
  isMarkingListed: boolean;
}

// ============ CHANNEL METADATA ============

const channelMeta: Record<
  AssistedChannel,
  {
    name: string;
    color: string;
    bgColor: string;
    titleLimit: number;
    descriptionLimit: number;
    listingUrl: string;
  }
> = {
  poshmark: {
    name: "Poshmark",
    color: "text-pink-700",
    bgColor: "bg-pink-100",
    titleLimit: 80,
    descriptionLimit: 1500,
    listingUrl: "https://poshmark.com/create-listing",
  },
  mercari: {
    name: "Mercari",
    color: "text-red-700",
    bgColor: "bg-red-100",
    titleLimit: 40,
    descriptionLimit: 1000,
    listingUrl: "https://www.mercari.com/sell/",
  },
  depop: {
    name: "Depop",
    color: "text-orange-700",
    bgColor: "bg-orange-100",
    titleLimit: 150,
    descriptionLimit: 1000,
    listingUrl: "https://www.depop.com/products/create/",
  },
};

// ============ COMPONENT ============

export function CrossListDialog({
  open,
  onOpenChange,
  item,
  targetChannel,
  template,
  isLoadingTemplate,
  onMarkListed,
  isMarkingListed,
}: CrossListDialogProps) {
  const [externalUrl, setExternalUrl] = React.useState("");
  const [step, setStep] = React.useState<"copy" | "confirm">("copy");

  const meta = channelMeta[targetChannel];

  // Reset state when dialog opens
  React.useEffect(() => {
    if (open) {
      setExternalUrl("");
      setStep("copy");
    }
  }, [open]);

  const handleMarkListed = () => {
    onMarkListed(externalUrl || undefined);
  };

  const handleOpenPlatform = () => {
    window.open(meta.listingUrl, "_blank", "noopener,noreferrer");
  };

  const handleDownloadImages = async () => {
    // Open each image in a new tab for saving
    for (const url of item.imageUrls) {
      window.open(url, "_blank", "noopener,noreferrer");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-3">
            {/* Channel Logo Placeholder */}
            <div
              className={cn(
                "h-12 w-12 rounded-lg flex items-center justify-center font-bold text-lg",
                meta.bgColor,
                meta.color
              )}
            >
              {meta.name.charAt(0)}
            </div>
            <div>
              <DialogTitle className="text-xl">
                Cross-list to {meta.name}
              </DialogTitle>
              <DialogDescription>
                Copy the optimized content below to create your {meta.name} listing
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {isLoadingTemplate ? (
          <div className="flex flex-col items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground">
              Generating optimized template...
            </p>
          </div>
        ) : template ? (
          <>
            {step === "copy" && (
              <div className="space-y-6 py-4">
                {/* Step Progress */}
                <div className="flex items-center gap-2 text-sm">
                  <Badge variant="secondary" className={cn(meta.bgColor, meta.color)}>
                    Step 1 of 2
                  </Badge>
                  <span className="text-muted-foreground">
                    Copy content and create listing
                  </span>
                </div>

                {/* Images Section */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-medium">
                      Photos ({item.imageUrls.length})
                    </Label>
                    {item.imageUrls.length > 0 && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleDownloadImages}
                        className="h-7 text-xs"
                      >
                        <Download className="h-3.5 w-3.5 mr-1" />
                        Open All Images
                      </Button>
                    )}
                  </div>
                  <div className="flex gap-2 overflow-x-auto pb-2">
                    {item.imageUrls.length > 0 ? (
                      item.imageUrls.map((url, index) => (
                        <a
                          key={index}
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex-shrink-0 h-16 w-16 rounded-md overflow-hidden border hover:border-primary transition-colors"
                        >
                          <img
                            src={url}
                            alt={`Photo ${index + 1}`}
                            className="h-full w-full object-cover"
                          />
                        </a>
                      ))
                    ) : (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <ImageIcon className="h-4 w-4" />
                        <span>No photos available</span>
                      </div>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Click images to open them for saving to your device
                  </p>
                </div>

                <Separator />

                {/* Copyable Fields */}
                <TemplateField
                  label="Title"
                  value={template.title}
                  characterLimit={meta.titleLimit}
                />

                <TemplateField
                  label="Description"
                  value={template.description}
                  characterLimit={meta.descriptionLimit}
                  multiline
                />

                {/* Additional Fields */}
                {template.copyableFields.brand && (
                  <TemplateField
                    label="Brand"
                    value={template.copyableFields.brand}
                  />
                )}

                {template.copyableFields.hashtags && (
                  <TemplateField
                    label="Hashtags"
                    value={template.copyableFields.hashtags}
                  />
                )}

                {/* Price Display */}
                <div className="flex items-center justify-between p-3 rounded-md border bg-muted/50">
                  <span className="text-sm font-medium">Suggested Price</span>
                  <span className="text-lg font-bold">
                    ${template.price.toFixed(2)}
                  </span>
                </div>

                <Separator />

                {/* Instructions */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Instructions</Label>
                  <ol className="space-y-2">
                    {template.instructions.map((instruction, index) => (
                      instruction && (
                        <li
                          key={index}
                          className="flex items-start gap-2 text-sm text-muted-foreground"
                        >
                          <span className="flex-shrink-0 h-5 w-5 rounded-full bg-muted flex items-center justify-center text-xs font-medium">
                            {index + 1}
                          </span>
                          <span>{instruction.replace(/^\d+\.\s*/, "")}</span>
                        </li>
                      )
                    ))}
                  </ol>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1"
                    onClick={handleOpenPlatform}
                  >
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Open {meta.name}
                  </Button>
                  <Button
                    type="button"
                    className="flex-1"
                    onClick={() => setStep("confirm")}
                  >
                    I&apos;ve Created the Listing
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                </div>
              </div>
            )}

            {step === "confirm" && (
              <div className="space-y-6 py-4">
                {/* Step Progress */}
                <div className="flex items-center gap-2 text-sm">
                  <Badge variant="secondary" className={cn(meta.bgColor, meta.color)}>
                    Step 2 of 2
                  </Badge>
                  <span className="text-muted-foreground">
                    Confirm your listing
                  </span>
                </div>

                {/* Success Message */}
                <div className="flex flex-col items-center text-center py-6">
                  <div className="h-16 w-16 rounded-full bg-green-100 flex items-center justify-center mb-4">
                    <CheckCircle2 className="h-8 w-8 text-green-600" />
                  </div>
                  <h3 className="font-semibold text-lg mb-2">
                    Great! Let&apos;s confirm your listing
                  </h3>
                  <p className="text-sm text-muted-foreground max-w-sm">
                    Paste the link to your {meta.name} listing below so we can track it
                    for you. This is optional but helps with inventory management.
                  </p>
                </div>

                {/* URL Input */}
                <div className="space-y-2">
                  <Label htmlFor="listing-url">
                    {meta.name} Listing URL (optional)
                  </Label>
                  <Input
                    id="listing-url"
                    type="url"
                    placeholder={`https://${targetChannel}.com/listing/...`}
                    value={externalUrl}
                    onChange={(e) => setExternalUrl(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Copy the URL from your browser&apos;s address bar after creating the listing
                  </p>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="flex flex-col items-center justify-center py-12">
            <p className="text-sm text-muted-foreground">
              Failed to generate template. Please try again.
            </p>
          </div>
        )}

        <DialogFooter>
          {step === "copy" ? (
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
          ) : (
            <>
              <Button
                type="button"
                variant="outline"
                onClick={() => setStep("copy")}
              >
                Back
              </Button>
              <Button
                type="button"
                onClick={handleMarkListed}
                disabled={isMarkingListed}
              >
                {isMarkingListed ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                )}
                Mark as Listed
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default CrossListDialog;
