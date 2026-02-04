"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink, loggerLink } from "@trpc/client";
import { useState } from "react";
import superjson from "superjson";
import { trpc } from "./client";
import { handleTRPCError, isTRPCClientError } from "./error-handler";

// Interface for error data structure
interface TRPCErrorData {
  code?: string;
  httpStatus?: number;
}

function getBaseUrl() {
  if (typeof window !== "undefined") {
    // In the browser, use relative URL
    return "";
  }

  // SSR should use vercel url or localhost
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }

  // Assume localhost in development
  return `http://localhost:${process.env.PORT ?? 3000}`;
}

/**
 * Global error handler for tRPC mutations.
 * Shows toast notifications for mutation errors.
 */
function handleMutationError(error: unknown) {
  if (isTRPCClientError(error)) {
    handleTRPCError(error, {
      showToast: true,
      title: "Operation Failed",
    });
  } else if (error instanceof Error) {
    console.error("Mutation error:", error);
  }
}

/**
 * Global error handler for tRPC queries.
 * Only shows toast for certain error types (not network errors during loading).
 */
function _handleQueryError(error: unknown) {
  if (isTRPCClientError(error)) {
    // Only show toast for auth and permission errors
    const data = error.data as TRPCErrorData | null | undefined;
    const code = data?.code;
    if (code === "UNAUTHORIZED" || code === "FORBIDDEN") {
      handleTRPCError(error, {
        showToast: true,
        title: "Access Denied",
      });
    }
    // Log other errors but don't show toast (component handles display)
    console.error("Query error:", error);
  }
}

export function TRPCProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // With SSR, we usually want to set some default staleTime
            // above 0 to avoid refetching immediately on the client
            staleTime: 60 * 1000, // 1 minute
            // Retry configuration for queries
            retry: (failureCount, error) => {
              // Don't retry on 4xx errors (client errors)
              if (isTRPCClientError(error)) {
                const code = error.data?.code as string | undefined;
                const noRetry = [
                  "UNAUTHORIZED",
                  "FORBIDDEN",
                  "NOT_FOUND",
                  "BAD_REQUEST",
                  "PARSE_ERROR",
                ];
                if (code && noRetry.includes(code)) {
                  return false;
                }
              }
              // Retry up to 2 times for other errors
              return failureCount < 2;
            },
            retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
          },
          mutations: {
            // Show toast on mutation errors
            onError: handleMutationError,
            // Retry configuration for mutations
            retry: (failureCount, error) => {
              // Only retry network errors for mutations
              if (error instanceof TypeError && error.message.includes("fetch")) {
                return failureCount < 1;
              }
              // Check for retryable server errors
              if (isTRPCClientError(error)) {
                const code = error.data?.code as string | undefined;
                if (code === "TOO_MANY_REQUESTS" || code === "TIMEOUT") {
                  return failureCount < 2;
                }
              }
              return false;
            },
            retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 5000),
          },
        },
      })
  );

  const [trpcClient] = useState(() =>
    trpc.createClient({
      transformer: superjson,
      links: [
        loggerLink({
          enabled: (opts) =>
            process.env.NODE_ENV === "development" ||
            (opts.direction === "down" && opts.result instanceof Error),
        }),
        httpBatchLink({
          url: `${getBaseUrl()}/api/trpc`,
          // Add timeout to prevent hanging requests
          fetch(url, options) {
            return fetch(url, {
              ...options,
              // 30 second timeout
              signal: AbortSignal.timeout(30000),
            }).catch((error) => {
              // Transform fetch errors to be more user-friendly
              if (error.name === "TimeoutError" || error.name === "AbortError") {
                throw new Error("Request timed out. Please try again.");
              }
              if (!navigator.onLine) {
                throw new Error("No internet connection. Please check your network.");
              }
              throw error;
            });
          },
        }),
      ],
    })
  );

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </trpc.Provider>
  );
}
