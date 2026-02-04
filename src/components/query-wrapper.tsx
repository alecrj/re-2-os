'use client';

import { type ReactNode } from 'react';
import { SectionLoading } from '@/components/ui/page-loading';
import { QueryErrorState, EmptyState } from '@/components/ui/empty-state';
import { getAnyErrorMessage } from '@/lib/trpc/error-handler';
import { type LucideIcon } from 'lucide-react';

interface QueryWrapperProps<T> {
  /** Query loading state */
  isLoading: boolean;
  /** Query error state */
  error: unknown;
  /** Query data */
  data: T | undefined;
  /** Check if data is empty (default: checks for empty arrays) */
  isEmpty?: (data: T) => boolean;
  /** Refetch function for retry */
  refetch?: () => void;
  /** Custom loading component */
  loadingComponent?: ReactNode;
  /** Loading message */
  loadingMessage?: string;
  /** Custom error component */
  errorComponent?: ReactNode;
  /** Empty state configuration */
  emptyState?: {
    icon?: LucideIcon;
    title: string;
    description?: string;
    action?: {
      label: string;
      onClick: () => void;
      icon?: LucideIcon;
    };
  };
  /** Render function for data */
  children: (data: T) => ReactNode;
}

/**
 * A wrapper component that handles query loading, error, and empty states.
 * Provides a consistent pattern for displaying query results across the app.
 *
 * @example
 * ```tsx
 * <QueryWrapper
 *   isLoading={query.isLoading}
 *   error={query.error}
 *   data={query.data}
 *   refetch={query.refetch}
 *   emptyState={{
 *     icon: Package,
 *     title: 'No items yet',
 *     description: 'Create your first inventory item to get started.',
 *     action: {
 *       label: 'Add Item',
 *       onClick: () => router.push('/inventory/new'),
 *     },
 *   }}
 * >
 *   {(data) => <ItemList items={data.items} />}
 * </QueryWrapper>
 * ```
 */
export function QueryWrapper<T>({
  isLoading,
  error,
  data,
  isEmpty,
  refetch,
  loadingComponent,
  loadingMessage = 'Loading...',
  errorComponent,
  emptyState,
  children,
}: QueryWrapperProps<T>) {
  // Loading state
  if (isLoading) {
    if (loadingComponent) {
      return <>{loadingComponent}</>;
    }
    return <SectionLoading message={loadingMessage} />;
  }

  // Error state
  if (error) {
    if (errorComponent) {
      return <>{errorComponent}</>;
    }
    return (
      <QueryErrorState
        message={getAnyErrorMessage(error)}
        onRetry={refetch}
      />
    );
  }

  // No data state
  if (data === undefined || data === null) {
    if (emptyState) {
      return (
        <EmptyState
          icon={emptyState.icon}
          title={emptyState.title}
          description={emptyState.description}
          action={emptyState.action}
        />
      );
    }
    return null;
  }

  // Empty data state (for arrays)
  const checkEmpty = isEmpty ?? defaultIsEmpty;
  if (checkEmpty(data)) {
    if (emptyState) {
      return (
        <EmptyState
          icon={emptyState.icon}
          title={emptyState.title}
          description={emptyState.description}
          action={emptyState.action}
        />
      );
    }
    return null;
  }

  // Success state - render children with data
  return <>{children(data)}</>;
}

/**
 * Default empty check - works with arrays and objects with items/data arrays
 */
function defaultIsEmpty<T>(data: T): boolean {
  if (Array.isArray(data)) {
    return data.length === 0;
  }

  if (data && typeof data === 'object') {
    // Check for common patterns like { items: [] } or { data: [] }
    const obj = data as Record<string, unknown>;
    if (Array.isArray(obj.items)) {
      return obj.items.length === 0;
    }
    if (Array.isArray(obj.data)) {
      return obj.data.length === 0;
    }
  }

  return false;
}

interface MutationStatusProps {
  /** Whether mutation is pending */
  isPending: boolean;
  /** Whether mutation was successful */
  isSuccess: boolean;
  /** Whether mutation errored */
  isError: boolean;
  /** Error from mutation */
  error: unknown;
  /** Success message */
  successMessage?: string;
  /** Children to render */
  children: ReactNode;
}

/**
 * Displays mutation status feedback.
 * Use this to show loading/success/error states after mutations.
 */
export function MutationStatus({
  isPending,
  isSuccess,
  isError,
  error,
  successMessage = 'Operation completed successfully',
  children,
}: MutationStatusProps) {
  return (
    <div className="relative">
      {children}

      {isPending && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/50 backdrop-blur-sm">
          <div className="flex items-center gap-2 rounded-md bg-background px-4 py-2 shadow-lg">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            <span className="text-sm">Processing...</span>
          </div>
        </div>
      )}

      {isSuccess && (
        <div className="mt-2 rounded-md bg-green-50 p-3 text-sm text-green-700 dark:bg-green-950 dark:text-green-300">
          {successMessage}
        </div>
      )}

      {isError && (
        <div className="mt-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          {getAnyErrorMessage(error)}
        </div>
      )}
    </div>
  );
}
