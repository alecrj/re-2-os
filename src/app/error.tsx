'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { AlertTriangle, RefreshCw, Home, Bug } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

/**
 * Global error page for Next.js App Router.
 * This catches unhandled errors in the application.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to the console
    console.error('Global error:', error);

    // Log to Sentry if configured
    if (typeof window !== 'undefined' && (window as unknown as { Sentry?: { captureException: (error: Error) => void } }).Sentry) {
      (window as unknown as { Sentry: { captureException: (error: Error) => void } }).Sentry.captureException(error);
    }
  }, [error]);

  const isDev = process.env.NODE_ENV === 'development';

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-lg">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
            <AlertTriangle className="h-8 w-8 text-destructive" />
          </div>
          <CardTitle className="text-2xl">Something went wrong</CardTitle>
          <CardDescription className="text-base">
            We encountered an unexpected error. Our team has been notified and is
            working to fix it.
          </CardDescription>
        </CardHeader>

        {isDev && (
          <CardContent className="space-y-4">
            <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-4">
              <div className="flex items-start gap-3">
                <Bug className="mt-0.5 h-5 w-5 flex-shrink-0 text-destructive" />
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-destructive">
                    {error.name}: {error.message}
                  </p>
                  {error.digest && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Error ID: {error.digest}
                    </p>
                  )}
                  {error.stack && (
                    <details className="mt-3">
                      <summary className="cursor-pointer text-sm font-medium text-muted-foreground hover:text-foreground">
                        View stack trace
                      </summary>
                      <pre className="mt-2 max-h-48 overflow-auto rounded bg-muted p-2 text-xs">
                        {error.stack}
                      </pre>
                    </details>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        )}

        {!isDev && error.digest && (
          <CardContent>
            <p className="text-center text-sm text-muted-foreground">
              Error ID: <code className="rounded bg-muted px-1">{error.digest}</code>
            </p>
          </CardContent>
        )}

        <CardFooter className="flex flex-col gap-3 sm:flex-row">
          <Button variant="outline" className="w-full sm:w-auto" asChild>
            <Link href="/">
              <Home className="mr-2 h-4 w-4" />
              Go Home
            </Link>
          </Button>
          <Button className="w-full sm:w-auto" onClick={reset}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Try Again
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
