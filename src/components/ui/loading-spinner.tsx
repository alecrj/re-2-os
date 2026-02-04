import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface LoadingSpinnerProps {
  /** Size variant of the spinner */
  size?: 'sm' | 'default' | 'lg' | 'xl';
  /** Additional CSS classes */
  className?: string;
  /** Accessible label for screen readers */
  label?: string;
}

const sizeClasses = {
  sm: 'h-4 w-4',
  default: 'h-6 w-6',
  lg: 'h-8 w-8',
  xl: 'h-12 w-12',
};

/**
 * A simple loading spinner component.
 * Uses lucide-react Loader2 icon with animation.
 */
export function LoadingSpinner({
  size = 'default',
  className,
  label = 'Loading...',
}: LoadingSpinnerProps) {
  return (
    <Loader2
      className={cn('animate-spin text-muted-foreground', sizeClasses[size], className)}
      aria-label={label}
      role="status"
    />
  );
}

interface LoadingOverlayProps {
  /** Whether the overlay is visible */
  visible?: boolean;
  /** Loading message to display */
  message?: string;
  /** Whether to use a full-screen overlay */
  fullScreen?: boolean;
  /** Additional CSS classes */
  className?: string;
}

/**
 * A loading overlay that covers its parent container.
 * Useful for showing loading state over content.
 */
export function LoadingOverlay({
  visible = true,
  message = 'Loading...',
  fullScreen = false,
  className,
}: LoadingOverlayProps) {
  if (!visible) return null;

  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-3 bg-background/80 backdrop-blur-sm',
        fullScreen ? 'fixed inset-0 z-50' : 'absolute inset-0',
        className
      )}
      role="status"
      aria-live="polite"
    >
      <LoadingSpinner size="lg" />
      {message && (
        <p className="text-sm font-medium text-muted-foreground">{message}</p>
      )}
    </div>
  );
}

interface LoadingDotsProps {
  /** Additional CSS classes */
  className?: string;
}

/**
 * Animated loading dots indicator.
 * Alternative to spinner for inline loading states.
 */
export function LoadingDots({ className }: LoadingDotsProps) {
  return (
    <span className={cn('inline-flex items-center gap-1', className)} role="status">
      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-current [animation-delay:-0.3s]" />
      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-current [animation-delay:-0.15s]" />
      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-current" />
      <span className="sr-only">Loading...</span>
    </span>
  );
}
