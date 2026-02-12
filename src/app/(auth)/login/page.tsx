"use client";

/**
 * Login Page
 *
 * Login page with Google, Apple, and eBay OAuth buttons.
 */
import { signIn } from "next-auth/react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useSearchParams } from "next/navigation";
import { useState, Suspense } from "react";

type Provider = "google" | "apple" | "ebay";

/**
 * Login form content - separated for Suspense boundary
 */
function LoginContent() {
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") ?? "/dashboard";
  const error = searchParams.get("error");
  const [loadingProvider, setLoadingProvider] = useState<Provider | null>(null);

  const handleLogin = async (provider: Provider) => {
    setLoadingProvider(provider);
    try {
      await signIn(provider, { callbackUrl });
    } catch (err) {
      console.error("Login error:", err);
      setLoadingProvider(null);
    }
  };

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl font-bold">ResellerOS</CardTitle>
        <CardDescription>
          Sign in to manage your reselling business.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {error && (
          <div className="p-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-md">
            {error === "OAuthAccountNotLinked"
              ? "This account is already linked to another user."
              : error === "AccessDenied"
              ? "Access was denied. Please try again."
              : "An error occurred during sign in. Please try again."}
          </div>
        )}

        {/* Google */}
        <button
          onClick={() => handleLogin("google")}
          disabled={loadingProvider !== null}
          className="w-full h-12 flex items-center justify-center gap-3 rounded-md border border-gray-300 bg-white text-gray-700 text-base font-medium hover:bg-gray-50 disabled:opacity-50 transition-colors"
        >
          {loadingProvider === "google" ? (
            <>
              <LoadingSpinner />
              Connecting...
            </>
          ) : (
            <>
              <GoogleIcon />
              Continue with Google
            </>
          )}
        </button>

        {/* Apple */}
        <button
          onClick={() => handleLogin("apple")}
          disabled={loadingProvider !== null}
          className="w-full h-12 flex items-center justify-center gap-3 rounded-md bg-black text-white text-base font-medium hover:bg-gray-900 disabled:opacity-50 transition-colors"
        >
          {loadingProvider === "apple" ? (
            <>
              <LoadingSpinner />
              Connecting...
            </>
          ) : (
            <>
              <AppleIcon />
              Continue with Apple
            </>
          )}
        </button>

        {/* eBay */}
        <button
          onClick={() => handleLogin("ebay")}
          disabled={loadingProvider !== null}
          className="w-full h-12 flex items-center justify-center gap-3 rounded-md text-white text-base font-medium hover:opacity-90 disabled:opacity-50 transition-colors"
          style={{ backgroundColor: "#0064D2" }}
        >
          {loadingProvider === "ebay" ? (
            <>
              <LoadingSpinner />
              Connecting...
            </>
          ) : (
            <>
              <EbayLogo />
              Continue with eBay
            </>
          )}
        </button>

        <p className="text-xs text-center text-gray-500 mt-4">
          By signing in, you agree to our Terms of Service and Privacy Policy.
          We will never list, modify, or delete items without your approval.
        </p>
      </CardContent>
    </Card>
  );
}

/**
 * Loading fallback for Suspense
 */
function LoginLoading() {
  return (
    <Card className="w-full max-w-md">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl font-bold">ResellerOS</CardTitle>
        <CardDescription>Loading...</CardDescription>
      </CardHeader>
      <CardContent className="flex justify-center py-8">
        <LoadingSpinner />
      </CardContent>
    </Card>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <Suspense fallback={<LoginLoading />}>
        <LoginContent />
      </Suspense>
    </div>
  );
}

/**
 * Google "G" Icon
 */
function GoogleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24">
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </svg>
  );
}

/**
 * Apple Icon
 */
function AppleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
      <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
    </svg>
  );
}

/**
 * eBay Logo SVG Component
 */
function EbayLogo() {
  return (
    <svg
      width="50"
      height="20"
      viewBox="0 0 300 120"
      fill="currentColor"
    >
      <text
        x="0"
        y="90"
        fontFamily="Arial, sans-serif"
        fontSize="100"
        fontWeight="bold"
      >
        <tspan fill="#E53238">e</tspan>
        <tspan fill="#0064D2">b</tspan>
        <tspan fill="#F5AF02">a</tspan>
        <tspan fill="#86B817">y</tspan>
      </text>
    </svg>
  );
}

/**
 * Loading Spinner Component
 */
function LoadingSpinner() {
  return (
    <svg
      className="animate-spin h-5 w-5"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
}
