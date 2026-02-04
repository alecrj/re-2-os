import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from '@/components/ui/card';

interface SkeletonCardProps {
  /** Additional CSS classes */
  className?: string;
  /** Whether to show a header section */
  showHeader?: boolean;
  /** Whether to show a footer section */
  showFooter?: boolean;
  /** Number of content lines to show */
  lines?: number;
  /** Whether to show an image placeholder */
  showImage?: boolean;
}

/**
 * A skeleton loading state for card components.
 * Mimics the structure of a typical card layout.
 */
export function SkeletonCard({
  className,
  showHeader = true,
  showFooter = false,
  lines = 3,
  showImage = false,
}: SkeletonCardProps) {
  return (
    <Card className={cn('overflow-hidden', className)}>
      {showImage && (
        <Skeleton className="h-40 w-full rounded-none" />
      )}

      {showHeader && (
        <CardHeader className="gap-2">
          <Skeleton className="h-5 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
        </CardHeader>
      )}

      <CardContent className="space-y-2">
        {Array.from({ length: lines }).map((_, i) => (
          <Skeleton
            key={i}
            className={cn(
              'h-4',
              i === lines - 1 ? 'w-2/3' : 'w-full'
            )}
          />
        ))}
      </CardContent>

      {showFooter && (
        <CardFooter className="gap-2">
          <Skeleton className="h-9 w-20" />
          <Skeleton className="h-9 w-20" />
        </CardFooter>
      )}
    </Card>
  );
}

interface SkeletonStatCardProps {
  /** Additional CSS classes */
  className?: string;
}

/**
 * A skeleton loading state for stat/metric cards.
 * Common in dashboards for KPI displays.
 */
export function SkeletonStatCard({ className }: SkeletonStatCardProps) {
  return (
    <Card className={className}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-4 w-4 rounded" />
      </CardHeader>
      <CardContent>
        <Skeleton className="h-8 w-16" />
        <Skeleton className="mt-2 h-3 w-24" />
      </CardContent>
    </Card>
  );
}

interface SkeletonListItemProps {
  /** Additional CSS classes */
  className?: string;
  /** Whether to show an avatar/image */
  showAvatar?: boolean;
  /** Whether to show action buttons */
  showActions?: boolean;
}

/**
 * A skeleton loading state for list items.
 * Works well for inventory lists, order lists, etc.
 */
export function SkeletonListItem({
  className,
  showAvatar = true,
  showActions = false,
}: SkeletonListItemProps) {
  return (
    <div className={cn('flex items-center gap-4 p-4', className)}>
      {showAvatar && (
        <Skeleton className="h-12 w-12 flex-shrink-0 rounded-md" />
      )}
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-1/2" />
      </div>
      {showActions && (
        <div className="flex gap-2">
          <Skeleton className="h-8 w-8 rounded" />
          <Skeleton className="h-8 w-8 rounded" />
        </div>
      )}
    </div>
  );
}

interface SkeletonTableProps {
  /** Number of rows to show */
  rows?: number;
  /** Number of columns to show */
  columns?: number;
  /** Additional CSS classes */
  className?: string;
}

/**
 * A skeleton loading state for tables.
 * Mimics a data table with header and rows.
 */
export function SkeletonTable({
  rows = 5,
  columns = 4,
  className,
}: SkeletonTableProps) {
  return (
    <div className={cn('space-y-3', className)}>
      {/* Header */}
      <div className="flex gap-4 border-b pb-3">
        {Array.from({ length: columns }).map((_, i) => (
          <Skeleton
            key={`header-${i}`}
            className={cn(
              'h-4',
              i === 0 ? 'w-40' : 'w-24'
            )}
          />
        ))}
      </div>

      {/* Rows */}
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div key={rowIndex} className="flex items-center gap-4 py-2">
          {Array.from({ length: columns }).map((_, colIndex) => (
            <Skeleton
              key={`row-${rowIndex}-col-${colIndex}`}
              className={cn(
                'h-4',
                colIndex === 0 ? 'w-40' : 'w-24'
              )}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

interface SkeletonFormProps {
  /** Number of fields to show */
  fields?: number;
  /** Additional CSS classes */
  className?: string;
}

/**
 * A skeleton loading state for forms.
 * Shows labeled input field placeholders.
 */
export function SkeletonForm({
  fields = 4,
  className,
}: SkeletonFormProps) {
  return (
    <div className={cn('space-y-6', className)}>
      {Array.from({ length: fields }).map((_, i) => (
        <div key={i} className="space-y-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-10 w-full" />
        </div>
      ))}
      <div className="flex justify-end gap-2">
        <Skeleton className="h-10 w-24" />
        <Skeleton className="h-10 w-24" />
      </div>
    </div>
  );
}
