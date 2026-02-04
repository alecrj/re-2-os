import Link from 'next/link';
import { FileQuestion, Home, ArrowLeft, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

/**
 * Custom 404 Not Found page for Next.js App Router.
 * This is shown when a page is not found.
 */
export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-lg text-center">
        <CardHeader>
          <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-muted">
            <FileQuestion className="h-10 w-10 text-muted-foreground" />
          </div>
          <CardTitle className="text-4xl font-bold">404</CardTitle>
          <CardDescription className="text-lg">
            Page not found
          </CardDescription>
        </CardHeader>

        <CardHeader className="pt-0">
          <p className="text-muted-foreground">
            The page you are looking for does not exist or has been moved.
            Please check the URL or navigate back to the home page.
          </p>
        </CardHeader>

        <CardFooter className="flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Button variant="outline" asChild>
            <Link href="javascript:history.back()">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Go Back
            </Link>
          </Button>
          <Button asChild>
            <Link href="/">
              <Home className="mr-2 h-4 w-4" />
              Go Home
            </Link>
          </Button>
        </CardFooter>

        <CardFooter className="justify-center pt-0">
          <p className="text-sm text-muted-foreground">
            Looking for something?{' '}
            <Link
              href="/inventory"
              className="inline-flex items-center gap-1 text-primary underline-offset-4 hover:underline"
            >
              <Search className="h-3 w-3" />
              Browse Inventory
            </Link>
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}
