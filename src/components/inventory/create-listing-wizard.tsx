"use client";

/**
 * Create Listing Wizard Component
 *
 * Multi-step wizard for creating new listings:
 * 1. Upload Photos
 * 2. Review AI Draft
 * 3. Set Pricing
 * 4. Select Channels
 */

import * as React from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { trpc } from "@/lib/trpc/client";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ImageUpload, UploadedImage } from "@/components/image-upload";
import { ListingForm, ListingFormData, SuggestedPrice, Condition } from "./listing-form";
import { ChannelSelector, ChannelId } from "./channel-selector";

import {
  Camera,
  Sparkles,
  DollarSign,
  Share2,
  ArrowLeft,
  ArrowRight,
  Loader2,
  Check,
  AlertCircle,
  Save,
} from "lucide-react";

// ============ TYPES ============

type WizardStep = "photos" | "review" | "pricing" | "channels";

const steps: { id: WizardStep; label: string; icon: React.ReactNode }[] = [
  { id: "photos", label: "Photos", icon: <Camera className="h-4 w-4" /> },
  { id: "review", label: "AI Review", icon: <Sparkles className="h-4 w-4" /> },
  { id: "pricing", label: "Pricing", icon: <DollarSign className="h-4 w-4" /> },
  { id: "channels", label: "Channels", icon: <Share2 className="h-4 w-4" /> },
];

interface CreateListingWizardProps {
  className?: string;
}

// ============ COMPONENT ============

export function CreateListingWizard({ className }: CreateListingWizardProps) {
  const router = useRouter();
  const utils = trpc.useUtils();

  // State
  const [currentStep, setCurrentStep] = React.useState<WizardStep>("photos");
  const [tempItemId] = React.useState(() => `temp-${crypto.randomUUID()}`);
  const [images, setImages] = React.useState<UploadedImage[]>([]);
  const [formData, setFormData] = React.useState<ListingFormData>({
    title: "",
    description: "",
    condition: "good",
    askingPrice: 0,
    floorPrice: null,
    costBasis: null,
    itemSpecifics: {},
    suggestedCategory: null,
  });
  const [suggestedPrice, setSuggestedPrice] = React.useState<SuggestedPrice | null>(null);
  const [aiConfidence, setAiConfidence] = React.useState<number | null>(null);
  const [selectedChannels, setSelectedChannels] = React.useState<ChannelId[]>([]);
  const [errors, setErrors] = React.useState<Partial<Record<keyof ListingFormData, string>>>({});

  // Mutations
  const generateDraftMutation = trpc.ai.generateDraft.useMutation();
  const regenerateFieldMutation = trpc.ai.regenerateField.useMutation();
  const createItemMutation = trpc.inventory.create.useMutation();
  const publishMutation = trpc.inventory.publish.useMutation();

  // Step navigation
  const currentStepIndex = steps.findIndex((s) => s.id === currentStep);

  const canProceed = (): boolean => {
    switch (currentStep) {
      case "photos":
        return images.length >= 1;
      case "review":
        return formData.title.length > 0 && formData.description.length > 0;
      case "pricing":
        return formData.askingPrice > 0;
      case "channels":
        return true; // Can save as draft without channels
      default:
        return false;
    }
  };

  const goToNextStep = () => {
    const nextIndex = currentStepIndex + 1;
    if (nextIndex < steps.length) {
      setCurrentStep(steps[nextIndex].id);
    }
  };

  const goToPreviousStep = () => {
    const prevIndex = currentStepIndex - 1;
    if (prevIndex >= 0) {
      setCurrentStep(steps[prevIndex].id);
    }
  };

  // Generate AI Draft
  const handleGenerateDraft = async () => {
    if (images.length === 0) return;

    try {
      const result = await generateDraftMutation.mutateAsync({
        imageIds: images.map((img) => img.id),
        targetPlatform: "ebay",
      });

      // Map condition from AI to our format
      const conditionMap: Record<string, Condition> = {
        NEW: "new",
        LIKE_NEW: "like_new",
        GOOD: "good",
        FAIR: "fair",
        POOR: "poor",
      };

      setFormData({
        title: result.title,
        description: result.description,
        condition: conditionMap[result.condition.suggested] || "good",
        askingPrice: result.suggestedPrice.recommended,
        floorPrice: result.suggestedPrice.min,
        costBasis: null,
        itemSpecifics: Object.fromEntries(
          result.itemSpecifics.map((spec) => [spec.name, spec.value])
        ),
        suggestedCategory: result.category.suggested,
      });
      setSuggestedPrice(result.suggestedPrice);
      setAiConfidence(result.overallConfidence);
    } catch (error) {
      console.error("Failed to generate draft:", error);
    }
  };

  // Regenerate specific field
  const handleRegenerateTitle = async () => {
    if (images.length === 0) return;

    try {
      const imageUrls = images.map((img) => img.processedUrl || img.originalUrl);
      const result = await regenerateFieldMutation.mutateAsync({
        field: "title",
        currentListing: {
          title: formData.title,
          description: formData.description,
          category: formData.suggestedCategory || undefined,
        },
        targetPlatform: "ebay",
        imageUrls,
      });
      setFormData((prev) => ({ ...prev, title: result.value }));
    } catch (error) {
      console.error("Failed to regenerate title:", error);
    }
  };

  const handleRegenerateDescription = async () => {
    if (images.length === 0) return;

    try {
      const imageUrls = images.map((img) => img.processedUrl || img.originalUrl);
      const result = await regenerateFieldMutation.mutateAsync({
        field: "description",
        currentListing: {
          title: formData.title,
          description: formData.description,
          category: formData.suggestedCategory || undefined,
        },
        targetPlatform: "ebay",
        imageUrls,
      });
      setFormData((prev) => ({ ...prev, description: result.value }));
    } catch (error) {
      console.error("Failed to regenerate description:", error);
    }
  };

  // Save as draft
  const handleSaveAsDraft = async () => {
    const validationErrors = validateForm();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    try {
      const result = await createItemMutation.mutateAsync({
        title: formData.title,
        description: formData.description,
        condition: formData.condition,
        askingPrice: formData.askingPrice,
        floorPrice: formData.floorPrice || undefined,
        costBasis: formData.costBasis || undefined,
        itemSpecifics: Object.keys(formData.itemSpecifics).length > 0
          ? formData.itemSpecifics
          : undefined,
        suggestedCategory: formData.suggestedCategory || undefined,
        aiConfidence: aiConfidence || undefined,
        imageIds: images.map((img) => img.id),
      });

      utils.inventory.list.invalidate();
      utils.inventory.getStats.invalidate();
      router.push(`/inventory/${result.id}`);
    } catch (error) {
      console.error("Failed to save draft:", error);
    }
  };

  // Publish
  const handlePublish = async () => {
    const validationErrors = validateForm();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    try {
      // First create the item
      const result = await createItemMutation.mutateAsync({
        title: formData.title,
        description: formData.description,
        condition: formData.condition,
        askingPrice: formData.askingPrice,
        floorPrice: formData.floorPrice || undefined,
        costBasis: formData.costBasis || undefined,
        itemSpecifics: Object.keys(formData.itemSpecifics).length > 0
          ? formData.itemSpecifics
          : undefined,
        suggestedCategory: formData.suggestedCategory || undefined,
        aiConfidence: aiConfidence || undefined,
        imageIds: images.map((img) => img.id),
      });

      // Then publish to selected channels
      if (selectedChannels.length > 0) {
        await publishMutation.mutateAsync({
          id: result.id,
          channels: selectedChannels,
        });
      }

      utils.inventory.list.invalidate();
      utils.inventory.getStats.invalidate();
      router.push(`/inventory/${result.id}`);
    } catch (error) {
      console.error("Failed to publish:", error);
    }
  };

  // Validation
  const validateForm = (): Partial<Record<keyof ListingFormData, string>> => {
    const errors: Partial<Record<keyof ListingFormData, string>> = {};

    if (!formData.title.trim()) {
      errors.title = "Title is required";
    } else if (formData.title.length > 80) {
      errors.title = "Title must be 80 characters or less";
    }

    if (!formData.description.trim()) {
      errors.description = "Description is required";
    }

    if (formData.askingPrice <= 0) {
      errors.askingPrice = "Asking price must be greater than 0";
    }

    return errors;
  };

  // Render step content
  const renderStepContent = () => {
    switch (currentStep) {
      case "photos":
        return (
          <div className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold">Upload Photos</h2>
              <p className="text-sm text-muted-foreground">
                Add 1-12 photos of your item. The first photo will be the main listing image.
              </p>
            </div>

            <ImageUpload
              itemId={tempItemId}
              images={images}
              onImagesChange={setImages}
              maxImages={12}
            />

            {images.length >= 1 && (
              <div className="flex justify-center">
                <Button onClick={handleGenerateDraft} disabled={generateDraftMutation.isPending}>
                  {generateDraftMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Sparkles className="mr-2 h-4 w-4" />
                      Generate with AI
                    </>
                  )}
                </Button>
              </div>
            )}
          </div>
        );

      case "review":
        return (
          <div className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold">Review AI Draft</h2>
              <p className="text-sm text-muted-foreground">
                Review and edit the AI-generated listing details.
              </p>
            </div>

            {formData.title === "" && !generateDraftMutation.isPending ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">
                  No draft generated yet. Go back to the Photos step and click Generate with AI.
                </p>
              </div>
            ) : generateDraftMutation.isPending ? (
              <div className="flex flex-col items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
                <p className="text-muted-foreground">Analyzing your photos...</p>
              </div>
            ) : (
              <ListingForm
                data={formData}
                onChange={setFormData}
                aiConfidence={aiConfidence}
                onRegenerateTitle={handleRegenerateTitle}
                onRegenerateDescription={handleRegenerateDescription}
                isRegenerating={regenerateFieldMutation.isPending}
                errors={errors}
              />
            )}
          </div>
        );

      case "pricing":
        return (
          <div className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold">Set Pricing</h2>
              <p className="text-sm text-muted-foreground">
                Set your asking price, floor price, and cost basis for profit tracking.
              </p>
            </div>

            <Card>
              <CardContent className="pt-6">
                <ListingForm
                  data={formData}
                  onChange={setFormData}
                  suggestedPrice={suggestedPrice}
                  errors={errors}
                />
              </CardContent>
            </Card>
          </div>
        );

      case "channels":
        return (
          <div className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold">Select Channels</h2>
              <p className="text-sm text-muted-foreground">
                Choose which marketplaces to list your item on.
              </p>
            </div>

            <ChannelSelector
              selectedChannels={selectedChannels}
              onSelectionChange={setSelectedChannels}
            />
          </div>
        );

      default:
        return null;
    }
  };

  const isLoading = createItemMutation.isPending || publishMutation.isPending;

  return (
    <div className={cn("space-y-6", className)}>
      {/* Step Indicator */}
      <div className="flex items-center justify-center">
        <div className="flex items-center gap-2">
          {steps.map((step, index) => (
            <React.Fragment key={step.id}>
              <button
                onClick={() => setCurrentStep(step.id)}
                className={cn(
                  "flex items-center gap-2 px-3 py-2 rounded-lg transition-colors",
                  currentStep === step.id
                    ? "bg-primary text-primary-foreground"
                    : index < currentStepIndex
                      ? "bg-primary/10 text-primary hover:bg-primary/20"
                      : "bg-muted text-muted-foreground"
                )}
              >
                {index < currentStepIndex ? (
                  <Check className="h-4 w-4" />
                ) : (
                  step.icon
                )}
                <span className="hidden sm:inline text-sm font-medium">
                  {step.label}
                </span>
              </button>
              {index < steps.length - 1 && (
                <div
                  className={cn(
                    "w-8 h-0.5",
                    index < currentStepIndex ? "bg-primary" : "bg-muted"
                  )}
                />
              )}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* Step Content */}
      <Card>
        <CardContent className="pt-6">{renderStepContent()}</CardContent>
      </Card>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          onClick={goToPreviousStep}
          disabled={currentStepIndex === 0 || isLoading}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>

        <div className="flex gap-2">
          {currentStep === "channels" ? (
            <>
              <Button
                variant="outline"
                onClick={handleSaveAsDraft}
                disabled={isLoading}
              >
                {createItemMutation.isPending && selectedChannels.length === 0 ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Save className="mr-2 h-4 w-4" />
                )}
                Save as Draft
              </Button>
              <Button
                onClick={handlePublish}
                disabled={isLoading || selectedChannels.length === 0}
              >
                {isLoading && selectedChannels.length > 0 ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Share2 className="mr-2 h-4 w-4" />
                )}
                Publish
              </Button>
            </>
          ) : (
            <Button onClick={goToNextStep} disabled={!canProceed() || isLoading}>
              Next
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

export default CreateListingWizard;
