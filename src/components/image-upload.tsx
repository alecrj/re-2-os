"use client";

/**
 * Image Upload Component
 *
 * A drag-and-drop image upload component that:
 * - Supports multiple file selection
 * - Shows upload progress
 * - Displays preview thumbnails
 * - Uploads directly to R2 via presigned URLs
 * - Allows reordering and deletion
 */

import * as React from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc/client";
import { Upload, X, GripVertical, Loader2, AlertCircle, Image as ImageIcon } from "lucide-react";

// ============ TYPES ============

export interface UploadedImage {
  id: string;
  originalUrl: string;
  processedUrl?: string | null;
  position: number;
  width?: number | null;
  height?: number | null;
  sizeBytes?: number | null;
}

interface ImageUploadProps {
  /** The inventory item ID to associate images with */
  itemId: string;
  /** Currently uploaded images */
  images: UploadedImage[];
  /** Callback when images change */
  onImagesChange: (images: UploadedImage[]) => void;
  /** Maximum number of images allowed */
  maxImages?: number;
  /** Additional class names */
  className?: string;
  /** Whether the component is disabled */
  disabled?: boolean;
}

interface UploadingFile {
  id: string;
  file: File;
  preview: string;
  progress: number;
  status: "pending" | "uploading" | "confirming" | "done" | "error";
  error?: string;
}

// ============ CONSTANTS ============

const ALLOWED_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
];

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

// ============ COMPONENT ============

export function ImageUpload({
  itemId,
  images,
  onImagesChange,
  maxImages = 12,
  className,
  disabled = false,
}: ImageUploadProps) {
  const [uploadingFiles, setUploadingFiles] = React.useState<UploadingFile[]>([]);
  const [isDragging, setIsDragging] = React.useState(false);
  const [draggedImageId, setDraggedImageId] = React.useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // tRPC mutations
  const getUploadUrl = trpc.images.getUploadUrl.useMutation();
  const confirmUpload = trpc.images.confirmUpload.useMutation();
  const deleteImage = trpc.images.delete.useMutation();
  const reorderImages = trpc.images.reorder.useMutation();

  // ============ FILE VALIDATION ============

  const validateFile = (file: File): string | null => {
    if (!ALLOWED_TYPES.includes(file.type)) {
      return `Invalid file type: ${file.type}. Allowed: JPEG, PNG, WebP, HEIC`;
    }
    if (file.size > MAX_FILE_SIZE) {
      return `File too large: ${(file.size / 1024 / 1024).toFixed(1)}MB. Maximum: 10MB`;
    }
    return null;
  };

  // ============ UPLOAD HANDLER ============

  const uploadFile = async (file: File, uploadId: string) => {
    try {
      // Update status to uploading
      setUploadingFiles((prev) =>
        prev.map((f) =>
          f.id === uploadId ? { ...f, status: "uploading" as const, progress: 10 } : f
        )
      );

      // Get presigned URL - validate content type first
      const contentType = file.type as
        | "image/jpeg"
        | "image/jpg"
        | "image/png"
        | "image/webp"
        | "image/heic"
        | "image/heif";

      const { uploadUrl, key, publicUrl } = await getUploadUrl.mutateAsync({
        itemId,
        contentType,
      });

      setUploadingFiles((prev) =>
        prev.map((f) => (f.id === uploadId ? { ...f, progress: 30 } : f))
      );

      // Upload to R2
      const uploadResponse = await fetch(uploadUrl, {
        method: "PUT",
        body: file,
        headers: {
          "Content-Type": file.type,
        },
      });

      if (!uploadResponse.ok) {
        throw new Error(`Upload failed: ${uploadResponse.statusText}`);
      }

      setUploadingFiles((prev) =>
        prev.map((f) =>
          f.id === uploadId ? { ...f, status: "confirming" as const, progress: 80 } : f
        )
      );

      // Get image dimensions
      const dimensions = await getImageDimensions(file);

      // Confirm upload in database
      const result = await confirmUpload.mutateAsync({
        itemId,
        key,
        sizeBytes: file.size,
        width: dimensions.width,
        height: dimensions.height,
      });

      setUploadingFiles((prev) =>
        prev.map((f) =>
          f.id === uploadId ? { ...f, status: "done" as const, progress: 100 } : f
        )
      );

      // Add to images list
      const newImage: UploadedImage = {
        id: result.id,
        originalUrl: publicUrl,
        position: result.position ?? images.length,
        width: result.width,
        height: result.height,
        sizeBytes: result.sizeBytes,
      };

      onImagesChange([...images, newImage]);

      // Remove from uploading list after a short delay
      setTimeout(() => {
        setUploadingFiles((prev) => prev.filter((f) => f.id !== uploadId));
      }, 1000);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Upload failed";
      setUploadingFiles((prev) =>
        prev.map((f) =>
          f.id === uploadId
            ? { ...f, status: "error" as const, error: errorMessage }
            : f
        )
      );
    }
  };

  const getImageDimensions = (
    file: File
  ): Promise<{ width: number; height: number }> => {
    return new Promise((resolve, reject) => {
      const img = new window.Image();
      img.onload = () => {
        resolve({ width: img.width, height: img.height });
        URL.revokeObjectURL(img.src);
      };
      img.onerror = () => {
        reject(new Error("Failed to load image"));
        URL.revokeObjectURL(img.src);
      };
      img.src = URL.createObjectURL(file);
    });
  };

  // ============ FILE SELECTION ============

  const handleFiles = (files: FileList | File[]) => {
    const fileArray = Array.from(files);
    const remainingSlots = maxImages - images.length - uploadingFiles.length;

    if (remainingSlots <= 0) {
      alert(`Maximum ${maxImages} images allowed`);
      return;
    }

    const filesToUpload = fileArray.slice(0, remainingSlots);

    for (const file of filesToUpload) {
      const error = validateFile(file);
      if (error) {
        alert(error);
        continue;
      }

      const uploadId = `upload-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const preview = URL.createObjectURL(file);

      setUploadingFiles((prev) => [
        ...prev,
        {
          id: uploadId,
          file,
          preview,
          progress: 0,
          status: "pending",
        },
      ]);

      // Start upload
      uploadFile(file, uploadId);
    }
  };

  // ============ DRAG AND DROP ============

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (disabled) return;

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFiles(files);
    }
  };

  // ============ IMAGE REORDERING ============

  const handleImageDragStart = (imageId: string) => {
    setDraggedImageId(imageId);
  };

  const handleImageDragOver = (e: React.DragEvent, targetImageId: string) => {
    e.preventDefault();
    if (!draggedImageId || draggedImageId === targetImageId) return;

    const draggedIndex = images.findIndex((img) => img.id === draggedImageId);
    const targetIndex = images.findIndex((img) => img.id === targetImageId);

    if (draggedIndex === -1 || targetIndex === -1) return;

    // Reorder locally for immediate feedback
    const newImages = [...images];
    const [draggedImage] = newImages.splice(draggedIndex, 1);
    newImages.splice(targetIndex, 0, draggedImage);

    // Update positions
    const reorderedImages = newImages.map((img, index) => ({
      ...img,
      position: index,
    }));

    onImagesChange(reorderedImages);
  };

  const handleImageDragEnd = () => {
    if (draggedImageId) {
      // Persist the new order
      const imageIds = images.map((img) => img.id);
      reorderImages.mutate({ itemId, imageIds });
    }
    setDraggedImageId(null);
  };

  // ============ IMAGE DELETION ============

  const handleDelete = async (imageId: string) => {
    try {
      await deleteImage.mutateAsync({ imageId });
      const newImages = images
        .filter((img) => img.id !== imageId)
        .map((img, index) => ({ ...img, position: index }));
      onImagesChange(newImages);
    } catch (error) {
      console.error("Failed to delete image:", error);
      alert("Failed to delete image. Please try again.");
    }
  };

  // ============ CLEANUP ============

  // Store ref to uploading files for cleanup
  const uploadingFilesRef = React.useRef<UploadingFile[]>([]);
  uploadingFilesRef.current = uploadingFiles;

  React.useEffect(() => {
    return () => {
      // Cleanup preview URLs on unmount
      uploadingFilesRef.current.forEach((f) => URL.revokeObjectURL(f.preview));
    };
  }, []);

  // ============ RENDER ============

  const totalImages = images.length + uploadingFiles.length;
  const canAddMore = totalImages < maxImages && !disabled;

  return (
    <div className={cn("space-y-4", className)}>
      {/* Drop Zone */}
      <div
        className={cn(
          "relative border-2 border-dashed rounded-lg p-8 text-center transition-colors",
          isDragging
            ? "border-primary bg-primary/5"
            : "border-muted-foreground/25 hover:border-muted-foreground/50",
          disabled && "opacity-50 cursor-not-allowed",
          !canAddMore && "opacity-50"
        )}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={ALLOWED_TYPES.join(",")}
          multiple
          onChange={(e) => e.target.files && handleFiles(e.target.files)}
          className="hidden"
          disabled={!canAddMore}
        />

        <div className="flex flex-col items-center gap-2">
          <Upload className="h-10 w-10 text-muted-foreground" />
          <div className="text-sm text-muted-foreground">
            <span className="font-medium">Drop images here</span> or{" "}
            <Button
              type="button"
              variant="link"
              className="p-0 h-auto"
              onClick={() => fileInputRef.current?.click()}
              disabled={!canAddMore}
            >
              browse
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            JPEG, PNG, WebP, HEIC up to 10MB each ({totalImages}/{maxImages}{" "}
            images)
          </p>
        </div>
      </div>

      {/* Image Grid */}
      {(images.length > 0 || uploadingFiles.length > 0) && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {/* Uploaded Images */}
          {images.map((image, index) => (
            <div
              key={image.id}
              draggable
              onDragStart={() => handleImageDragStart(image.id)}
              onDragOver={(e) => handleImageDragOver(e, image.id)}
              onDragEnd={handleImageDragEnd}
              className={cn(
                "relative aspect-square rounded-lg overflow-hidden border bg-muted group cursor-move",
                draggedImageId === image.id && "opacity-50"
              )}
            >
              <Image
                src={image.processedUrl || image.originalUrl}
                alt={`Image ${index + 1}`}
                className="w-full h-full object-cover"
                width={200}
                height={200}
                unoptimized
              />

              {/* Position Badge */}
              {index === 0 && (
                <div className="absolute top-1 left-1 bg-primary text-primary-foreground text-xs px-1.5 py-0.5 rounded">
                  Main
                </div>
              )}

              {/* Drag Handle */}
              <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <GripVertical className="h-4 w-4 text-white drop-shadow-md" />
              </div>

              {/* Delete Button */}
              <Button
                type="button"
                variant="destructive"
                size="icon"
                className="absolute bottom-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={() => handleDelete(image.id)}
                disabled={deleteImage.isPending}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          ))}

          {/* Uploading Files */}
          {uploadingFiles.map((upload) => (
            <div
              key={upload.id}
              className="relative aspect-square rounded-lg overflow-hidden border bg-muted"
            >
              <Image
                src={upload.preview}
                alt="Uploading"
                className="w-full h-full object-cover opacity-50"
                width={200}
                height={200}
                unoptimized
              />

              {/* Progress Overlay */}
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/40">
                {upload.status === "error" ? (
                  <>
                    <AlertCircle className="h-6 w-6 text-destructive mb-1" />
                    <span className="text-xs text-white text-center px-2">
                      {upload.error}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-white text-xs mt-1"
                      onClick={() =>
                        setUploadingFiles((prev) =>
                          prev.filter((f) => f.id !== upload.id)
                        )
                      }
                    >
                      Dismiss
                    </Button>
                  </>
                ) : upload.status === "done" ? (
                  <div className="text-white text-xs">Done</div>
                ) : (
                  <>
                    <Loader2 className="h-6 w-6 text-white animate-spin mb-1" />
                    <div className="text-xs text-white">
                      {upload.status === "uploading"
                        ? "Uploading..."
                        : upload.status === "confirming"
                          ? "Saving..."
                          : "Preparing..."}
                    </div>
                    {/* Progress Bar */}
                    <div className="w-16 h-1 bg-white/30 rounded-full mt-2 overflow-hidden">
                      <div
                        className="h-full bg-white transition-all duration-300"
                        style={{ width: `${upload.progress}%` }}
                      />
                    </div>
                  </>
                )}
              </div>
            </div>
          ))}

          {/* Add More Placeholder */}
          {canAddMore && totalImages > 0 && (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="aspect-square rounded-lg border-2 border-dashed border-muted-foreground/25 hover:border-muted-foreground/50 flex flex-col items-center justify-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
            >
              <ImageIcon className="h-6 w-6" />
              <span className="text-xs">Add more</span>
            </button>
          )}
        </div>
      )}

      {/* Helper Text */}
      {images.length > 1 && (
        <p className="text-xs text-muted-foreground">
          Drag images to reorder. The first image will be used as the main
          listing photo.
        </p>
      )}
    </div>
  );
}

export default ImageUpload;
