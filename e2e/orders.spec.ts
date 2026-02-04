import { test, expect } from "@playwright/test";

/**
 * Orders page E2E tests for ResellerOS.
 *
 * Tests cover:
 * - Orders page display
 * - Stats cards visibility
 * - Action buttons
 * - Orders table
 */

test.describe("Orders Page", () => {
  test("should display orders page with header", async ({ page }) => {
    await page.goto("/orders");

    // Check for the page heading
    await expect(
      page.getByRole("heading", { name: /orders/i, level: 1 })
    ).toBeVisible();

    // Check for the description
    await expect(
      page.getByText(/track your sales and manage orders/i)
    ).toBeVisible();
  });

  test("should display action buttons", async ({ page }) => {
    await page.goto("/orders");

    // Check for Sync from eBay button
    await expect(
      page.getByRole("button", { name: /sync from ebay/i })
    ).toBeVisible();

    // Check for Record Sale button
    await expect(
      page.getByRole("button", { name: /record sale/i })
    ).toBeVisible();
  });

  test("should display stats cards", async ({ page }) => {
    await page.goto("/orders");

    // Check for order stats cards
    await expect(page.getByText("Pending")).toBeVisible();
    await expect(page.getByText("To Ship")).toBeVisible();
    await expect(page.getByText("Shipped")).toBeVisible();
    await expect(page.getByText("Delivered")).toBeVisible();
    await expect(page.getByText("Revenue")).toBeVisible();
    await expect(page.getByText("Profit")).toBeVisible();
  });

  test("should display Recent Orders section", async ({ page }) => {
    await page.goto("/orders");

    // Check for the recent orders section
    await expect(
      page.getByRole("heading", { name: /recent orders/i })
    ).toBeVisible();

    await expect(
      page.getByText(/a list of all your orders across all channels/i)
    ).toBeVisible();
  });

  test("should open Record Sale dialog when button clicked", async ({
    page,
  }) => {
    await page.goto("/orders");

    // Click Record Sale button
    await page.getByRole("button", { name: /record sale/i }).click();

    // Dialog should appear (assuming it has a title or identifiable content)
    // This will depend on the RecordSaleDialog implementation
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 5000 });
  });
});
