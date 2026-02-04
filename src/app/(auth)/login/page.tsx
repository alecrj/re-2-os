"use client";

/**
 * Login Page
 *
 * Simple login page with eBay OAuth button.
 */
import { signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useSearchParams } from "next/navigation";
import { useState, Suspense } from "react";

/**
 * Login form content - separated for Suspense boundary
 */
function LoginContent() {
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") ?? "/inventory";
  const error = searchParams.get("error");
  const [isLoading, setIsLoading] = useState(false);

  const handleEbayLogin = async () => {
    setIsLoading(true);
    try {
      await signIn("ebay", { callbackUrl });
    } catch (err) {
      console.error("Login error:", err);
      setIsLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl font-bold">ResellerOS</CardTitle>
        <CardDescription>
          Your reselling operating system. Connect your eBay account to get started.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <div className="p-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-md">
            {error === "OAuthAccountNotLinked"
              ? "This account is already linked to another user."
              : error === "AccessDenied"
              ? "Access was denied. Please try again."
              : "An error occurred during sign in. Please try again."}
          </div>
        )}

        <Button
          onClick={handleEbayLogin}
          disabled={isLoading}
          className="w-full h-12 text-base font-medium"
          style={{ backgroundColor: "#0064D2", color: "#FFFFFF" }}
        >
          {isLoading ? (
            <span className="flex items-center gap-2">
              <LoadingSpinner />
              Connecting...
            </span>
          ) : (
            <span className="flex items-center gap-2">
              <EbayLogo />
              Connect with eBay
            </span>
          )}
        </Button>

        <p className="text-xs text-center text-gray-500 mt-4">
          By connecting, you agree to our Terms of Service and Privacy Policy.
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
 * eBay Logo SVG Component
 */
function EbayLogo() {
  return (
    <svg
      width="50"
      height="20"
      viewBox="0 0 300 120"
      fill="currentColor"
      className="mr-2"
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
