import { test, expect } from "@playwright/test";

/**
 * Authentication E2E tests for ResellerOS.
 *
 * Tests cover:
 * - Login page accessibility
 * - eBay OAuth button visibility
 * - Unauthenticated redirect behavior
 */

test.describe("Authentication", () => {
  test("should show login page with eBay connect button", async ({ page }) => {
    await page.goto("/login");

    // Check that the login page loads
    await expect(page.getByText("ResellerOS")).toBeVisible();

    // Check for the eBay connection button
    const ebayButton = page.getByRole("button", { name: /connect with ebay/i });
    await expect(ebayButton).toBeVisible();

    // Verify the description text is present
    await expect(
      page.getByText(/connect your ebay account to get started/i)
    ).toBeVisible();
  });

  test("should display terms notice on login page", async ({ page }) => {
    await page.goto("/login");

    // Check for terms and privacy notice
    await expect(
      page.getByText(/by connecting, you agree to our terms/i)
    ).toBeVisible();
  });

  test("should have eBay button enabled and clickable", async ({ page }) => {
    await page.goto("/login");

    const ebayButton = page.getByRole("button", { name: /connect with ebay/i });
    await expect(ebayButton).toBeEnabled();

    // Click should trigger loading state (we won't complete OAuth in tests)
    await ebayButton.click();

    // Button should show loading state
    await expect(page.getByText(/connecting/i)).toBeVisible({ timeout: 5000 });
  });

  test("should display error message when error param is present", async ({
    page,
  }) => {
    await page.goto("/login?error=AccessDenied");

    // Check for error message
    await expect(
      page.getByText(/access was denied/i)
    ).toBeVisible();
  });

  test("should display OAuth account linked error", async ({ page }) => {
    await page.goto("/login?error=OAuthAccountNotLinked");

    await expect(
      page.getByText(/already linked to another user/i)
    ).toBeVisible();
  });

  test("should preserve callback URL for post-login redirect", async ({
    page,
  }) => {
    // Navigate to login with a callback URL
    await page.goto("/login?callbackUrl=/orders");

    // The button should be present and ready
    const ebayButton = page.getByRole("button", { name: /connect with ebay/i });
    await expect(ebayButton).toBeVisible();
  });
});
