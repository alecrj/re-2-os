/**
 * Retry logic utilities for handling transient failures.
 * Provides exponential backoff and configurable retry strategies.
 */

export interface RetryOptions {
  /** Maximum number of retry attempts (default: 3) */
  maxRetries?: number;
  /** Initial delay in milliseconds before first retry (default: 1000) */
  initialDelay?: number;
  /** Maximum delay in milliseconds between retries (default: 10000) */
  maxDelay?: number;
  /** Multiplier for exponential backoff (default: 2) */
  backoffMultiplier?: number;
  /** Whether to add jitter to delay (default: true) */
  jitter?: boolean;
  /** Custom function to determine if error is retryable */
  isRetryable?: (error: unknown, attempt: number) => boolean;
  /** Callback called before each retry attempt */
  onRetry?: (error: unknown, attempt: number, delay: number) => void;
  /** Abort signal to cancel retry attempts */
  signal?: AbortSignal;
}

const DEFAULT_OPTIONS: Required<Omit<RetryOptions, 'onRetry' | 'signal' | 'isRetryable'>> = {
  maxRetries: 3,
  initialDelay: 1000,
  maxDelay: 10000,
  backoffMultiplier: 2,
  jitter: true,
};

/**
 * Default retry predicate - retries on network errors and 5xx status codes.
 */
function defaultIsRetryable(error: unknown): boolean {
  // Network errors
  if (error instanceof TypeError && error.message.includes('fetch')) {
    return true;
  }

  // Check for retryable HTTP status codes
  if (error && typeof error === 'object') {
    const err = error as { status?: number; code?: string; data?: { httpStatus?: number } };

    // 5xx server errors
    const status = err.status || err.data?.httpStatus;
    if (status && status >= 500 && status < 600) {
      return true;
    }

    // Rate limiting (429)
    if (status === 429) {
      return true;
    }

    // Specific error codes that are retryable
    const retryableCodes = ['TIMEOUT', 'NETWORK_ERROR', 'TOO_MANY_REQUESTS'];
    if (err.code && retryableCodes.includes(err.code)) {
      return true;
    }
  }

  return false;
}

/**
 * Calculate delay with exponential backoff and optional jitter.
 */
function calculateDelay(
  attempt: number,
  options: Required<Omit<RetryOptions, 'onRetry' | 'signal' | 'isRetryable'>>
): number {
  const { initialDelay, maxDelay, backoffMultiplier, jitter } = options;

  // Calculate exponential delay
  let delay = initialDelay * Math.pow(backoffMultiplier, attempt - 1);

  // Add jitter (0-25% random variation)
  if (jitter) {
    const jitterAmount = delay * 0.25 * Math.random();
    delay = delay + jitterAmount;
  }

  // Cap at max delay
  return Math.min(delay, maxDelay);
}

/**
 * Sleep for a specified duration, with abort signal support.
 */
function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('Aborted', 'AbortError'));
      return;
    }

    const timeout = setTimeout(resolve, ms);

    signal?.addEventListener('abort', () => {
      clearTimeout(timeout);
      reject(new DOMException('Aborted', 'AbortError'));
    });
  });
}

/**
 * Executes an async function with retry logic and exponential backoff.
 *
 * @example
 * ```ts
 * // Basic usage
 * const result = await withRetry(() => fetchData());
 *
 * // With options
 * const result = await withRetry(
 *   () => api.call(),
 *   {
 *     maxRetries: 5,
 *     onRetry: (error, attempt) => console.log(`Retry ${attempt}...`),
 *   }
 * );
 * ```
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options?: RetryOptions
): Promise<T> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const { maxRetries, onRetry, signal, isRetryable = defaultIsRetryable } = opts;

  let lastError: unknown;

  for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
    try {
      // Check for abort before attempting
      if (signal?.aborted) {
        throw new DOMException('Aborted', 'AbortError');
      }

      return await fn();
    } catch (error) {
      lastError = error;

      // Don't retry if aborted
      if (error instanceof DOMException && error.name === 'AbortError') {
        throw error;
      }

      // Don't retry if this was the last attempt
      if (attempt > maxRetries) {
        throw error;
      }

      // Don't retry if error is not retryable
      if (!isRetryable(error, attempt)) {
        throw error;
      }

      // Calculate delay and wait
      const delay = calculateDelay(attempt, opts);

      // Call onRetry callback if provided
      onRetry?.(error, attempt, delay);

      // Wait before retrying
      await sleep(delay, signal);
    }
  }

  // This should never be reached, but TypeScript needs it
  throw lastError;
}

/**
 * Creates a retry wrapper function with preset options.
 * Useful for creating reusable retry strategies.
 *
 * @example
 * ```ts
 * const apiRetry = createRetryWrapper({
 *   maxRetries: 5,
 *   onRetry: (_, attempt) => console.log(`API retry ${attempt}...`),
 * });
 *
 * const result = await apiRetry(() => api.fetchData());
 * ```
 */
export function createRetryWrapper(defaultOptions: RetryOptions) {
  return <T>(fn: () => Promise<T>, overrideOptions?: RetryOptions): Promise<T> => {
    return withRetry(fn, { ...defaultOptions, ...overrideOptions });
  };
}

/**
 * Retry wrapper specifically for critical operations.
 * Uses more aggressive retry settings.
 */
export const withCriticalRetry = createRetryWrapper({
  maxRetries: 5,
  initialDelay: 500,
  maxDelay: 30000,
  backoffMultiplier: 2,
  jitter: true,
  onRetry: (error, attempt, delay) => {
    console.warn(`Critical operation retry ${attempt} after ${delay}ms:`, error);
  },
});

/**
 * Retry wrapper for quick operations.
 * Uses faster retry with shorter delays.
 */
export const withQuickRetry = createRetryWrapper({
  maxRetries: 2,
  initialDelay: 200,
  maxDelay: 1000,
  backoffMultiplier: 1.5,
  jitter: true,
});

/**
 * Batch retry - executes multiple operations with retry logic.
 * Useful for operations that need to be retried together.
 *
 * @example
 * ```ts
 * const results = await batchWithRetry([
 *   () => api.fetchItem(1),
 *   () => api.fetchItem(2),
 *   () => api.fetchItem(3),
 * ]);
 * ```
 */
export async function batchWithRetry<T>(
  operations: Array<() => Promise<T>>,
  options?: RetryOptions
): Promise<T[]> {
  return Promise.all(
    operations.map((op) => withRetry(op, options))
  );
}

/**
 * Batch retry with settled results - returns results even if some fail.
 * Each operation is retried individually.
 *
 * @example
 * ```ts
 * const results = await batchWithRetrySettled([
 *   () => api.fetchItem(1),
 *   () => api.fetchItem(2),
 *   () => api.fetchItem(3),
 * ]);
 *
 * results.forEach((result, index) => {
 *   if (result.status === 'fulfilled') {
 *     console.log(`Item ${index}:`, result.value);
 *   } else {
 *     console.error(`Item ${index} failed:`, result.reason);
 *   }
 * });
 * ```
 */
export async function batchWithRetrySettled<T>(
  operations: Array<() => Promise<T>>,
  options?: RetryOptions
): Promise<PromiseSettledResult<T>[]> {
  return Promise.allSettled(
    operations.map((op) => withRetry(op, options))
  );
}
