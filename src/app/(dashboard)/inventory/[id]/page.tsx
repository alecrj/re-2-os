"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc/client";
import { cn } from "@/lib/utils";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { ImageUpload, UploadedImage } from "@/components/image-upload";
import {
  ListingForm,
  ListingFormData,
  ChannelSelector,
  ChannelId,
  Condition,
} from "@/components/inventory";
import {
  CrossListDialog,
  CrossListStatus,
  AssistedChannel,
} from "@/components/listings";

import {
  ArrowLeft,
  Save,
  Loader2,
  MoreVertical,
  Archive,
  Trash2,
  Share2,
  ExternalLink,
  DollarSign,
  RefreshCw,
} from "lucide-react";

// ============ TYPES ============

interface EditListingPageProps {
  params: { id: string };
}

// ============ STATUS COLORS ============

const statusColors: Record<string, string> = {
  draft: "bg-gray-100 text-gray-800",
  active: "bg-green-100 text-green-800",
  sold: "bg-blue-100 text-blue-800",
  shipped: "bg-purple-100 text-purple-800",
  archived: "bg-gray-100 text-gray-500",
};

const channelColors: Record<string, string> = {
  ebay: "bg-yellow-100 text-yellow-800",
  poshmark: "bg-pink-100 text-pink-800",
  mercari: "bg-red-100 text-red-800",
  depop: "bg-orange-100 text-orange-800",
};

const listingStatusColors: Record<string, string> = {
  draft: "bg-gray-100 text-gray-600",
  pending: "bg-yellow-100 text-yellow-700",
  active: "bg-green-100 text-green-700",
  ended: "bg-gray-100 text-gray-600",
  sold: "bg-blue-100 text-blue-700",
  error: "bg-red-100 text-red-700",
};

// ============ COMPONENT ============

export default function EditListingPage({ params }: EditListingPageProps) {
  const router = useRouter();
  const utils = trpc.useUtils();
  const { id } = params;

  // State
  const [activeTab, setActiveTab] = React.useState("details");
  const [formData, setFormData] = React.useState<ListingFormData | null>(null);
  const [images, setImages] = React.useState<UploadedImage[]>([]);
  const [hasChanges, setHasChanges] = React.useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false);
  const [archiveDialogOpen, setArchiveDialogOpen] = React.useState(false);
  const [publishDialogOpen, setPublishDialogOpen] = React.useState(false);
  const [selectedChannels, setSelectedChannels] = React.useState<ChannelId[]>([]);
  const [errors, setErrors] = React.useState<Partial<Record<keyof ListingFormData, string>>>({});

  // Cross-list dialog state
  const [crossListDialogOpen, setCrossListDialogOpen] = React.useState(false);
  const [crossListChannel, setCrossListChannel] = React.useState<AssistedChannel | null>(null);

  // Queries
  const { data: item, isLoading } = trpc.inventory.getById.useQuery({ id });

  // Cross-list template query (only when dialog is open)
  const { data: crossListTemplate, isLoading: isLoadingTemplate } =
    trpc.listings.generateTemplate.useQuery(
      { itemId: id, channel: crossListChannel! },
      { enabled: crossListDialogOpen && crossListChannel !== null }
    );

  // Initialize form data when item loads
  React.useEffect(() => {
    if (item && !formData) {
      setFormData({
        title: item.title,
        description: item.description,
        condition: item.condition as Condition,
        askingPrice: item.askingPrice,
        floorPrice: item.floorPrice,
        costBasis: item.costBasis,
        itemSpecifics: item.itemSpecifics || {},
        suggestedCategory: item.suggestedCategory,
      });
      setImages(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        item.images.map((img: any) => ({
          id: img.id,
          originalUrl: img.originalUrl,
          processedUrl: img.processedUrl,
          position: img.position,
          width: img.width,
          height: img.height,
          sizeBytes: img.sizeBytes,
        }))
      );
    }
  }, [item, formData]);

  // Track changes
  const handleFormChange = (newData: ListingFormData) => {
    setFormData(newData);
    setHasChanges(true);
  };

  // Mutations
  const updateMutation = trpc.inventory.update.useMutation({
    onSuccess: () => {
      setHasChanges(false);
      utils.inventory.getById.invalidate({ id });
      utils.inventory.list.invalidate();
    },
  });

  const deleteMutation = trpc.inventory.delete.useMutation({
    onSuccess: () => {
      utils.inventory.list.invalidate();
      utils.inventory.getStats.invalidate();
      router.push("/inventory");
    },
  });

  const archiveMutation = trpc.inventory.archive.useMutation({
    onSuccess: () => {
      setArchiveDialogOpen(false);
      utils.inventory.getById.invalidate({ id });
      utils.inventory.list.invalidate();
      utils.inventory.getStats.invalidate();
    },
  });

  const publishMutation = trpc.inventory.publish.useMutation({
    onSuccess: () => {
      setPublishDialogOpen(false);
      utils.inventory.getById.invalidate({ id });
      utils.inventory.list.invalidate();
      utils.inventory.getStats.invalidate();
    },
  });

  const markCrossListedMutation = trpc.listings.markCrossListed.useMutation({
    onSuccess: () => {
      setCrossListDialogOpen(false);
      setCrossListChannel(null);
      utils.inventory.getById.invalidate({ id });
      utils.inventory.list.invalidate();
      utils.inventory.getStats.invalidate();
    },
  });

  // Handlers
  const handleSave = async () => {
    if (!formData) return;

    const validationErrors = validateForm();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    await updateMutation.mutateAsync({
      id,
      title: formData.title,
      description: formData.description,
      condition: formData.condition,
      askingPrice: formData.askingPrice,
      floorPrice: formData.floorPrice,
      costBasis: formData.costBasis,
      itemSpecifics: Object.keys(formData.itemSpecifics).length > 0
        ? formData.itemSpecifics
        : null,
      suggestedCategory: formData.suggestedCategory,
    });
  };

  const handleDelete = async () => {
    await deleteMutation.mutateAsync({ ids: [id] });
  };

  const handleArchive = async () => {
    await archiveMutation.mutateAsync({ ids: [id] });
  };

  const handlePublish = async () => {
    if (selectedChannels.length === 0) return;
    await publishMutation.mutateAsync({ id, channels: selectedChannels });
  };

  const handleCrossListClick = (channel: AssistedChannel) => {
    setCrossListChannel(channel);
    setCrossListDialogOpen(true);
  };

  const handleMarkCrossListed = (externalUrl?: string) => {
    if (!crossListChannel) return;
    markCrossListedMutation.mutate({
      itemId: id,
      channel: crossListChannel,
      externalUrl,
    });
  };

  const validateForm = (): Partial<Record<keyof ListingFormData, string>> => {
    const errors: Partial<Record<keyof ListingFormData, string>> = {};
    if (!formData) return errors;

    if (!formData.title.trim()) {
      errors.title = "Title is required";
    }
    if (!formData.description.trim()) {
      errors.description = "Description is required";
    }
    if (formData.askingPrice <= 0) {
      errors.askingPrice = "Asking price must be greater than 0";
    }

    return errors;
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="space-y-6 max-w-4xl mx-auto">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-10 rounded" />
          <div className="space-y-2">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-32 w-full" />
              <Skeleton className="h-10 w-1/2" />
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Not found state
  if (!item) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <h1 className="text-2xl font-bold mb-2">Item Not Found</h1>
        <p className="text-muted-foreground mb-4">
          The item you are looking for does not exist or has been deleted.
        </p>
        <Button asChild>
          <Link href="/inventory">Back to Inventory</Link>
        </Button>
      </div>
    );
  }

  const isLoaded = formData !== null;

  // Prepare cross-list item data
  const crossListItem = {
    id: item.id,
    title: item.title,
    description: item.description,
    price: item.askingPrice,
    condition: item.condition,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    imageUrls: item.images.map((img: any) => img.processedUrl || img.originalUrl),
    itemSpecifics: item.itemSpecifics ?? undefined,
  };

  // Prepare channel listings for CrossListStatus
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const channelListingsForStatus = item.channelListings.map((listing: any) => ({
    channel: listing.channel as "ebay" | "poshmark" | "mercari" | "depop",
    status: listing.status as "draft" | "pending" | "active" | "ended" | "sold" | "error",
    externalUrl: listing.externalUrl,
    price: listing.price,
    publishedAt: listing.publishedAt,
  }));

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/inventory">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold line-clamp-1">{item.title}</h1>
              <Badge
                variant="secondary"
                className={cn("capitalize", statusColors[item.status])}
              >
                {item.status}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">{item.sku}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Save Button */}
          <Button
            onClick={handleSave}
            disabled={!hasChanges || updateMutation.isPending}
          >
            {updateMutation.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            Save Changes
          </Button>

          {/* Actions Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Actions</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {item.status === "draft" && (
                <DropdownMenuItem onClick={() => setPublishDialogOpen(true)}>
                  <Share2 className="mr-2 h-4 w-4" />
                  Publish
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={() => setArchiveDialogOpen(true)}>
                <Archive className="mr-2 h-4 w-4" />
                Archive
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => setDeleteDialogOpen(true)}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger value="photos">Photos</TabsTrigger>
          <TabsTrigger value="channels">Channels</TabsTrigger>
        </TabsList>

        {/* Details Tab */}
        <TabsContent value="details" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Listing Details</CardTitle>
              <CardDescription>
                Edit the title, description, and pricing for this item.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoaded && (
                <ListingForm
                  data={formData}
                  onChange={handleFormChange}
                  aiConfidence={item.aiConfidence}
                  errors={errors}
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Photos Tab */}
        <TabsContent value="photos" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Photos</CardTitle>
              <CardDescription>
                Manage the photos for this listing. Drag to reorder.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ImageUpload
                itemId={id}
                images={images}
                onImagesChange={setImages}
                maxImages={12}
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Channels Tab */}
        <TabsContent value="channels" className="mt-4 space-y-4">
          {/* Channel Listings Card */}
          <Card>
            <CardHeader>
              <CardTitle>Channel Listings</CardTitle>
              <CardDescription>
                View and manage where this item is listed.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {item.channelListings.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <Share2 className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="font-semibold mb-1">Not Listed Anywhere</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    This item is not currently listed on any marketplace.
                  </p>
                  <Button onClick={() => setPublishDialogOpen(true)}>
                    <Share2 className="mr-2 h-4 w-4" />
                    Publish Now
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                  {item.channelListings.map((listing: any) => (
                    <div
                      key={listing.id}
                      className="flex items-center justify-between p-4 rounded-lg border"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={cn(
                            "h-10 w-10 rounded-lg flex items-center justify-center font-bold text-sm",
                            channelColors[listing.channel]
                          )}
                        >
                          {listing.channel.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium capitalize">
                              {listing.channel}
                            </span>
                            <Badge
                              variant="secondary"
                              className={cn(
                                "text-xs capitalize",
                                listingStatusColors[listing.status]
                              )}
                            >
                              {listing.status}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            ${listing.price.toFixed(2)}
                            {listing.publishedAt && (
                              <>
                                {" "}
                                - Listed{" "}
                                {new Date(listing.publishedAt).toLocaleDateString()}
                              </>
                            )}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {listing.externalUrl && (
                          <Button variant="outline" size="sm" asChild>
                            <a
                              href={listing.externalUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <ExternalLink className="h-4 w-4" />
                            </a>
                          </Button>
                        )}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem>
                              <DollarSign className="mr-2 h-4 w-4" />
                              Update Price
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                              <RefreshCw className="mr-2 h-4 w-4" />
                              Relist
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="text-destructive">
                              <Archive className="mr-2 h-4 w-4" />
                              End Listing
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  ))}

                  <Separator className="my-4" />

                  <Button
                    variant="outline"
                    onClick={() => setPublishDialogOpen(true)}
                  >
                    <Share2 className="mr-2 h-4 w-4" />
                    List on More Channels
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Cross-List Card */}
          <Card>
            <CardHeader>
              <CardTitle>Cross-List to Other Platforms</CardTitle>
              <CardDescription>
                Generate optimized templates for manual listing on other marketplaces.
                Copy the content and create your listing, then mark it as listed here.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <CrossListStatus
                channelListings={channelListingsForStatus}
                onCrossListClick={handleCrossListClick}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Item</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this item? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Trash2 className="h-4 w-4 mr-2" />
              )}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Archive Confirmation Dialog */}
      <Dialog open={archiveDialogOpen} onOpenChange={setArchiveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Archive Item</DialogTitle>
            <DialogDescription>
              Archive this item? It will be hidden from your active inventory but can be
              restored later.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setArchiveDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleArchive} disabled={archiveMutation.isPending}>
              {archiveMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Archive className="h-4 w-4 mr-2" />
              )}
              Archive
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Publish Dialog */}
      <Dialog open={publishDialogOpen} onOpenChange={setPublishDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Publish to Channels</DialogTitle>
            <DialogDescription>
              Select which marketplaces to list this item on.
            </DialogDescription>
          </DialogHeader>
          <ChannelSelector
            selectedChannels={selectedChannels}
            onSelectionChange={setSelectedChannels}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setPublishDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handlePublish}
              disabled={selectedChannels.length === 0 || publishMutation.isPending}
            >
              {publishMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Share2 className="h-4 w-4 mr-2" />
              )}
              Publish to {selectedChannels.length} Channel
              {selectedChannels.length !== 1 ? "s" : ""}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cross-List Dialog */}
      {crossListChannel && (
        <CrossListDialog
          open={crossListDialogOpen}
          onOpenChange={(open) => {
            setCrossListDialogOpen(open);
            if (!open) setCrossListChannel(null);
          }}
          item={crossListItem}
          targetChannel={crossListChannel}
          template={crossListTemplate ?? null}
          isLoadingTemplate={isLoadingTemplate}
          onMarkListed={handleMarkCrossListed}
          isMarkingListed={markCrossListedMutation.isPending}
        />
      )}
    </div>
  );
}
