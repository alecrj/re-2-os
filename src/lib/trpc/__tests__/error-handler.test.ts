import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TRPCClientError } from '@trpc/client';
import {
  ERROR_MESSAGES,
  OPERATION_ERROR_MESSAGES,
  getErrorMessage,
  handleTRPCError,
  createMutationErrorHandler,
  isTRPCClientError,
  getAnyErrorMessage,
} from '../error-handler';

// Mock the toast module
vi.mock('@/hooks/use-toast', () => ({
  toast: vi.fn(),
}));

import { toast } from '@/hooks/use-toast';

// Helper to create mock tRPC errors
// Default message includes "TRPCClientError" so it gets filtered out
// and falls back to error code lookup (matching real behavior)
function createTRPCError(
  code: string,
  message = 'TRPCClientError: internal error',
  httpStatus?: number
): TRPCClientError<unknown> {
  const error = new TRPCClientError(message, {
    result: {
      error: {
        code,
        message,
        data: {
          code,
          httpStatus,
        },
      },
    },
  });
  // TRPCClientError sets data from result.error.data
  (error as unknown as { data: { code: string; httpStatus?: number } }).data = {
    code,
    httpStatus,
  };
  return error;
}

describe('ERROR_MESSAGES', () => {
  it('has messages for all common error codes', () => {
    const requiredCodes = [
      'UNAUTHORIZED',
      'FORBIDDEN',
      'NOT_FOUND',
      'TOO_MANY_REQUESTS',
      'INTERNAL_SERVER_ERROR',
      'BAD_REQUEST',
      'UNKNOWN',
    ];

    requiredCodes.forEach((code) => {
      expect(ERROR_MESSAGES[code]).toBeDefined();
      expect(typeof ERROR_MESSAGES[code]).toBe('string');
      expect(ERROR_MESSAGES[code].length).toBeGreaterThan(0);
    });
  });

  it('has user-friendly messages without technical jargon', () => {
    Object.values(ERROR_MESSAGES).forEach((message) => {
      // Messages should not contain technical terms
      expect(message).not.toMatch(/exception/i);
      expect(message).not.toMatch(/null/i);
      expect(message).not.toMatch(/undefined/i);
      expect(message).not.toMatch(/stack/i);
    });
  });
});

describe('OPERATION_ERROR_MESSAGES', () => {
  it('has messages for common operations', () => {
    const requiredOperations = [
      'inventory.create',
      'inventory.update',
      'orders.sync',
      'channels.connect',
      'ai.generate',
    ];

    requiredOperations.forEach((op) => {
      expect(OPERATION_ERROR_MESSAGES[op]).toBeDefined();
    });
  });
});

describe('getErrorMessage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns user-friendly message for UNAUTHORIZED', () => {
    const error = createTRPCError('UNAUTHORIZED');
    const message = getErrorMessage(error);
    expect(message).toBe('Please sign in to continue');
  });

  it('returns user-friendly message for FORBIDDEN', () => {
    const error = createTRPCError('FORBIDDEN');
    const message = getErrorMessage(error);
    expect(message).toBe("You don't have permission to do this");
  });

  it('returns user-friendly message for NOT_FOUND', () => {
    const error = createTRPCError('NOT_FOUND');
    const message = getErrorMessage(error);
    expect(message).toBe('The requested item was not found');
  });

  it('returns user-friendly message for TOO_MANY_REQUESTS', () => {
    const error = createTRPCError('TOO_MANY_REQUESTS');
    const message = getErrorMessage(error);
    expect(message).toBe('Rate limit exceeded. Please try again later.');
  });

  it('returns operation-specific message when operation is provided', () => {
    const error = createTRPCError('INTERNAL_SERVER_ERROR');
    const message = getErrorMessage(error, 'inventory.create');
    expect(message).toBe('Failed to create inventory item');
  });

  it('uses custom error message if clean and user-friendly', () => {
    const customMessage = 'Item already exists with this SKU';
    const error = createTRPCError('CONFLICT', customMessage);
    const message = getErrorMessage(error);
    expect(message).toBe(customMessage);
  });

  it('falls back to generic message for technical error messages', () => {
    const technicalMessage = 'TRPCClientError: undefined is not a function at Object.stack';
    const error = createTRPCError('INTERNAL_SERVER_ERROR', technicalMessage);
    const message = getErrorMessage(error);
    expect(message).toBe('Something went wrong. Please try again.');
  });

  it('maps HTTP status codes to error messages', () => {
    // Use a technical message that will be filtered out so it falls back to HTTP status
    const error = createTRPCError('', 'TRPCClientError: HTTP Error', 401);
    // Force the data to have httpStatus
    (error as unknown as { data: { httpStatus: number } }).data = { httpStatus: 401 };
    const message = getErrorMessage(error);
    expect(message).toContain('sign in');
  });

  it('returns UNKNOWN message for unrecognized errors', () => {
    const error = createTRPCError('SOME_WEIRD_CODE');
    const message = getErrorMessage(error);
    expect(message).toBe(ERROR_MESSAGES.UNKNOWN);
  });
});

describe('handleTRPCError', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('shows toast notification by default', () => {
    const error = createTRPCError('NOT_FOUND');
    handleTRPCError(error);

    expect(toast).toHaveBeenCalledWith({
      variant: 'destructive',
      title: 'Error',
      description: 'The requested item was not found',
    });
  });

  it('uses custom title when provided', () => {
    const error = createTRPCError('NOT_FOUND');
    handleTRPCError(error, { title: 'Item Not Found' });

    expect(toast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Item Not Found',
      })
    );
  });

  it('does not show toast when showToast is false', () => {
    const error = createTRPCError('NOT_FOUND');
    handleTRPCError(error, { showToast: false });

    expect(toast).not.toHaveBeenCalled();
  });

  it('logs error to console', () => {
    const error = createTRPCError('NOT_FOUND', 'Test message');
    handleTRPCError(error);

    expect(console.error).toHaveBeenCalledWith(
      'tRPC Error:',
      expect.objectContaining({
        message: 'Test message',
      })
    );
  });

  it('returns the user-friendly message', () => {
    const error = createTRPCError('UNAUTHORIZED');
    const message = handleTRPCError(error);

    expect(message).toBe('Please sign in to continue');
  });

  it('uses operation context for more specific messages', () => {
    const error = createTRPCError('INTERNAL_SERVER_ERROR');
    const message = handleTRPCError(error, { operation: 'orders.sync' });

    expect(message).toBe('Failed to sync orders from eBay');
    expect(toast).toHaveBeenCalledWith(
      expect.objectContaining({
        description: 'Failed to sync orders from eBay',
      })
    );
  });
});

describe('createMutationErrorHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates a reusable error handler', () => {
    const handler = createMutationErrorHandler({
      operation: 'inventory.create',
      title: 'Create Failed',
    });

    const error = createTRPCError('INTERNAL_SERVER_ERROR');
    handler(error);

    expect(toast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Create Failed',
        description: 'Failed to create inventory item',
      })
    );
  });

  it('calls custom onError callback', () => {
    const onError = vi.fn();
    const handler = createMutationErrorHandler({ onError });

    const error = createTRPCError('NOT_FOUND');
    handler(error);

    expect(onError).toHaveBeenCalledWith(
      error,
      'The requested item was not found'
    );
  });
});

describe('isTRPCClientError', () => {
  it('returns true for TRPCClientError instances', () => {
    const error = createTRPCError('NOT_FOUND');
    expect(isTRPCClientError(error)).toBe(true);
  });

  it('returns false for regular Error instances', () => {
    const error = new Error('Regular error');
    expect(isTRPCClientError(error)).toBe(false);
  });

  it('returns false for non-error values', () => {
    expect(isTRPCClientError('string')).toBe(false);
    expect(isTRPCClientError(null)).toBe(false);
    expect(isTRPCClientError(undefined)).toBe(false);
    expect(isTRPCClientError({})).toBe(false);
  });
});

describe('getAnyErrorMessage', () => {
  it('handles tRPC errors', () => {
    const error = createTRPCError('UNAUTHORIZED');
    const message = getAnyErrorMessage(error);
    expect(message).toBe('Please sign in to continue');
  });

  it('handles regular Error objects', () => {
    const error = new Error('Something broke');
    const message = getAnyErrorMessage(error);
    expect(message).toBe('Something broke');
  });

  it('handles string errors', () => {
    const message = getAnyErrorMessage('Error string');
    expect(message).toBe('Error string');
  });

  it('handles unknown error types', () => {
    const message = getAnyErrorMessage({ weird: 'object' });
    expect(message).toBe(ERROR_MESSAGES.UNKNOWN);
  });

  it('handles null and undefined', () => {
    expect(getAnyErrorMessage(null)).toBe(ERROR_MESSAGES.UNKNOWN);
    expect(getAnyErrorMessage(undefined)).toBe(ERROR_MESSAGES.UNKNOWN);
  });
});
