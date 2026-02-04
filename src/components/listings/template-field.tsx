"use client";

/**
 * Template Field Component
 *
 * A reusable component for displaying copyable fields with character count
 * and limit warnings for cross-listing templates.
 */

import * as React from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Check, Copy, AlertTriangle } from "lucide-react";

// ============ TYPES ============

interface TemplateFieldProps {
  label: string;
  value: string;
  characterLimit?: number;
  multiline?: boolean;
  className?: string;
}

// ============ COMPONENT ============

export function TemplateField({
  label,
  value,
  characterLimit,
  multiline = false,
  className,
}: TemplateFieldProps) {
  const [copied, setCopied] = React.useState(false);

  const isOverLimit = characterLimit ? value.length > characterLimit : false;
  const characterCount = value.length;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy text:", err);
    }
  };

  return (
    <div className={cn("space-y-2", className)}>
      {/* Label and Character Count */}
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-foreground">{label}</label>
        <div className="flex items-center gap-2">
          {characterLimit && (
            <span
              className={cn(
                "text-xs",
                isOverLimit ? "text-red-600 font-medium" : "text-muted-foreground"
              )}
            >
              {characterCount}/{characterLimit}
            </span>
          )}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleCopy}
            className="h-7 px-2 text-xs"
          >
            {copied ? (
              <>
                <Check className="h-3.5 w-3.5 mr-1 text-green-600" />
                <span className="text-green-600">Copied!</span>
              </>
            ) : (
              <>
                <Copy className="h-3.5 w-3.5 mr-1" />
                Copy
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Value Display */}
      <div
        className={cn(
          "relative rounded-md border bg-muted/50 p-3 text-sm",
          isOverLimit && "border-red-300 bg-red-50",
          multiline ? "min-h-[100px]" : ""
        )}
      >
        {multiline ? (
          <pre className="whitespace-pre-wrap font-sans text-foreground">{value}</pre>
        ) : (
          <p className="text-foreground truncate">{value}</p>
        )}
      </div>

      {/* Over Limit Warning */}
      {isOverLimit && (
        <div className="flex items-center gap-1.5 text-xs text-red-600">
          <AlertTriangle className="h-3.5 w-3.5" />
          <span>
            Exceeds {label.toLowerCase()} limit by {characterCount - (characterLimit ?? 0)} characters.
            Content will be truncated.
          </span>
        </div>
      )}
    </div>
  );
}

export default TemplateField;
