import { TRPCClientError } from '@trpc/client';
import type { AppRouter } from '@/server/trpc/root';
import { toast } from '@/hooks/use-toast';

// Type alias for our app's tRPC client error
type AppTRPCError = TRPCClientError<AppRouter>;

// Interface for error data structure
interface TRPCErrorData {
  code?: string;
  httpStatus?: number;
  [key: string]: unknown;
}

/**
 * Map of tRPC error codes to user-friendly messages.
 * These messages are shown to users in toast notifications.
 */
export const ERROR_MESSAGES: Record<string, string> = {
  // Authentication & Authorization
  UNAUTHORIZED: 'Please sign in to continue',
  FORBIDDEN: "You don't have permission to do this",

  // Resource errors
  NOT_FOUND: 'The requested item was not found',
  CONFLICT: 'This action conflicts with existing data',

  // Input validation
  BAD_REQUEST: 'Invalid request. Please check your input.',
  PARSE_ERROR: 'Invalid data format. Please try again.',

  // Rate limiting
  TOO_MANY_REQUESTS: 'Rate limit exceeded. Please try again later.',

  // Server errors
  INTERNAL_SERVER_ERROR: 'Something went wrong. Please try again.',
  TIMEOUT: 'Request timed out. Please try again.',
  CLIENT_CLOSED_REQUEST: 'Request was cancelled',

  // Network errors
  NETWORK_ERROR: 'Network error. Please check your connection.',

  // Precondition failures
  PRECONDITION_FAILED: 'Action cannot be completed. Conditions not met.',
  UNPROCESSABLE_CONTENT: 'Unable to process this request',

  // Method errors
  METHOD_NOT_SUPPORTED: 'This operation is not supported',
  NOT_IMPLEMENTED: 'This feature is not yet available',

  // Default fallback
  UNKNOWN: 'An unexpected error occurred. Please try again.',
};

/**
 * Business-specific error messages for common operations
 */
export const OPERATION_ERROR_MESSAGES: Record<string, string> = {
  // Inventory operations
  'inventory.create': 'Failed to create inventory item',
  'inventory.update': 'Failed to update inventory item',
  'inventory.delete': 'Failed to delete inventory item',
  'inventory.publish': 'Failed to publish listing',

  // Order operations
  'orders.sync': 'Failed to sync orders from eBay',
  'orders.ship': 'Failed to mark order as shipped',
  'orders.recordSale': 'Failed to record sale',

  // Channel operations
  'channels.connect': 'Failed to connect to marketplace',
  'channels.disconnect': 'Failed to disconnect from marketplace',
  'channels.refresh': 'Failed to refresh marketplace connection',

  // AI operations
  'ai.generate': 'Failed to generate listing. Please try again.',

  // Autopilot operations
  'autopilot.execute': 'Failed to execute autopilot action',
  'autopilot.undo': 'Failed to undo action',
};

/**
 * Extracts the error code from a tRPC error.
 */
function getErrorCode(error: AppTRPCError): string {
  const data = error.data as TRPCErrorData | null | undefined;

  // Check for standard tRPC error codes
  if (data?.code) {
    return data.code;
  }

  // Check for HTTP status code mapping
  if (data?.httpStatus) {
    const statusCode = data.httpStatus;
    if (statusCode === 401) return 'UNAUTHORIZED';
    if (statusCode === 403) return 'FORBIDDEN';
    if (statusCode === 404) return 'NOT_FOUND';
    if (statusCode === 429) return 'TOO_MANY_REQUESTS';
    if (statusCode >= 500) return 'INTERNAL_SERVER_ERROR';
  }

  // Check for network errors
  if (error.message?.includes('fetch')) {
    return 'NETWORK_ERROR';
  }

  return 'UNKNOWN';
}

/**
 * Gets a user-friendly error message from a tRPC error.
 * Optionally accepts an operation context for more specific messages.
 */
export function getErrorMessage(
  error: AppTRPCError,
  operation?: string
): string {
  // First, check for operation-specific message
  if (operation && OPERATION_ERROR_MESSAGES[operation]) {
    return OPERATION_ERROR_MESSAGES[operation];
  }

  // Then, check for a custom message in the error
  if (error.message && !error.message.includes('TRPCClientError')) {
    // Filter out technical error messages
    const cleanMessage = error.message
      .replace(/^TRPCClientError:\s*/i, '')
      .replace(/^\[.*?\]\s*/i, '');

    // Only use custom messages that look user-friendly
    if (
      cleanMessage.length < 100 &&
      !cleanMessage.includes('undefined') &&
      !cleanMessage.includes('null') &&
      !cleanMessage.includes('stack')
    ) {
      return cleanMessage;
    }
  }

  // Finally, use the error code mapping
  const code = getErrorCode(error);
  return ERROR_MESSAGES[code] || ERROR_MESSAGES.UNKNOWN;
}

/**
 * Handles a tRPC error by showing a toast notification.
 * Returns the user-friendly error message.
 */
export function handleTRPCError(
  error: AppTRPCError,
  options?: {
    operation?: string;
    showToast?: boolean;
    title?: string;
  }
): string {
  const { operation, showToast = true, title = 'Error' } = options || {};

  const message = getErrorMessage(error, operation);

  // Log to console for debugging
  console.error('tRPC Error:', {
    message: error.message,
    code: getErrorCode(error),
    operation,
    data: error.data,
  });

  // Show toast notification
  if (showToast) {
    toast({
      variant: 'destructive',
      title,
      description: message,
    });
  }

  return message;
}

/**
 * Creates a typed error handler for mutations.
 * Use this in your mutation's onError callback.
 */
export function createMutationErrorHandler(options?: {
  operation?: string;
  title?: string;
  onError?: (error: AppTRPCError, message: string) => void;
}) {
  return (error: AppTRPCError) => {
    const message = handleTRPCError(error, {
      operation: options?.operation,
      title: options?.title,
    });

    options?.onError?.(error, message);
  };
}

/**
 * Type guard to check if an error is a tRPC client error.
 */
export function isTRPCClientError(
  error: unknown
): error is AppTRPCError {
  return error instanceof TRPCClientError;
}

/**
 * Safely extracts error message from any error type.
 */
export function getAnyErrorMessage(error: unknown): string {
  if (isTRPCClientError(error)) {
    return getErrorMessage(error);
  }

  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === 'string') {
    return error;
  }

  return ERROR_MESSAGES.UNKNOWN;
}
