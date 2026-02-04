import { test, expect } from "@playwright/test";

/**
 * Inventory page E2E tests for ResellerOS.
 *
 * Tests cover:
 * - Inventory list display
 * - Stats cards visibility
 * - Navigation to new listing page
 * - UI elements and interactions
 */

test.describe("Inventory Page", () => {
  test("should display inventory page with header", async ({ page }) => {
    await page.goto("/inventory");

    // Check for the page heading
    await expect(
      page.getByRole("heading", { name: /inventory/i, level: 1 })
    ).toBeVisible();

    // Check for the description
    await expect(
      page.getByText(/manage your items and create new listings/i)
    ).toBeVisible();
  });

  test("should display New Listing button", async ({ page }) => {
    await page.goto("/inventory");

    // Check for the New Listing button
    const newListingButton = page.getByRole("link", { name: /new listing/i });
    await expect(newListingButton).toBeVisible();
  });

  test("should navigate to new listing page", async ({ page }) => {
    await page.goto("/inventory");

    // Click New Listing button
    await page.getByRole("link", { name: /new listing/i }).click();

    // Should navigate to new listing page
    await expect(page).toHaveURL("/inventory/new");
  });

  test("should display stats cards", async ({ page }) => {
    await page.goto("/inventory");

    // Check for stats cards
    await expect(page.getByText("Total Items")).toBeVisible();
    await expect(page.getByText("Active")).toBeVisible();
    await expect(page.getByText("Draft")).toBeVisible();
    await expect(page.getByText("Sold")).toBeVisible();
  });

  test("should display Your Items section", async ({ page }) => {
    await page.goto("/inventory");

    // Check for the items section
    await expect(
      page.getByRole("heading", { name: /your items/i })
    ).toBeVisible();

    await expect(
      page.getByText(/a list of all your inventory items/i)
    ).toBeVisible();
  });

  test("should show sidebar navigation", async ({ page }) => {
    await page.goto("/inventory");

    // Check sidebar is visible
    await expect(page.getByRole("link", { name: /reselleros/i })).toBeVisible();

    // Check navigation items
    await expect(page.getByRole("link", { name: /inventory/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /orders/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /analytics/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /settings/i })).toBeVisible();
  });
});
