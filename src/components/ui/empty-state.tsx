import { type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface EmptyStateProps {
  /** Icon to display */
  icon?: LucideIcon;
  /** Title text */
  title: string;
  /** Description text */
  description?: string;
  /** Primary action button */
  action?: {
    label: string;
    onClick: () => void;
    icon?: LucideIcon;
  };
  /** Secondary action button */
  secondaryAction?: {
    label: string;
    onClick: () => void;
  };
  /** Additional CSS classes */
  className?: string;
  /** Children for additional content */
  children?: React.ReactNode;
}

/**
 * Empty state component for when there's no data to display.
 * Use this for empty lists, search results with no matches, etc.
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  secondaryAction,
  className,
  children,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center py-12 text-center',
        className
      )}
    >
      {Icon && (
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
          <Icon className="h-8 w-8 text-muted-foreground" />
        </div>
      )}

      <h3 className="text-lg font-semibold">{title}</h3>

      {description && (
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">
          {description}
        </p>
      )}

      {children}

      {(action || secondaryAction) && (
        <div className="mt-6 flex gap-3">
          {secondaryAction && (
            <Button variant="outline" onClick={secondaryAction.onClick}>
              {secondaryAction.label}
            </Button>
          )}
          {action && (
            <Button onClick={action.onClick}>
              {action.icon && <action.icon className="mr-2 h-4 w-4" />}
              {action.label}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

interface QueryErrorStateProps {
  /** Error message to display */
  message?: string;
  /** Retry function */
  onRetry?: () => void;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Error state specifically for failed queries.
 * Shows a retry button and user-friendly message.
 */
export function QueryErrorState({
  message = 'Failed to load data',
  onRetry,
  className,
}: QueryErrorStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-4 py-12 text-center',
        className
      )}
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
        <svg
          className="h-6 w-6 text-destructive"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
          />
        </svg>
      </div>

      <div>
        <p className="font-medium text-destructive">{message}</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Please try again or contact support if the problem persists.
        </p>
      </div>

      {onRetry && (
        <Button variant="outline" onClick={onRetry}>
          Try Again
        </Button>
      )}
    </div>
  );
}

interface NoResultsStateProps {
  /** Search query that produced no results */
  query?: string;
  /** Suggestion for what to do */
  suggestion?: string;
  /** Clear search function */
  onClear?: () => void;
  /** Additional CSS classes */
  className?: string;
}

/**
 * No results state for search/filter operations.
 */
export function NoResultsState({
  query,
  suggestion = 'Try adjusting your search or filters',
  onClear,
  className,
}: NoResultsStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-2 py-12 text-center',
        className
      )}
    >
      <svg
        className="h-12 w-12 text-muted-foreground"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
        />
      </svg>

      <h3 className="mt-2 text-lg font-semibold">No results found</h3>

      {query && (
        <p className="text-sm text-muted-foreground">
          No matches for &quot;{query}&quot;
        </p>
      )}

      <p className="max-w-xs text-sm text-muted-foreground">{suggestion}</p>

      {onClear && (
        <Button variant="outline" size="sm" className="mt-4" onClick={onClear}>
          Clear Search
        </Button>
      )}
    </div>
  );
}
