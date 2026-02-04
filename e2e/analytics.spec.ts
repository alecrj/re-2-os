import { test, expect } from "@playwright/test";

/**
 * Analytics page E2E tests for ResellerOS.
 *
 * Tests cover:
 * - Analytics page display
 * - Stats cards visibility
 * - Charts section
 */

test.describe("Analytics Page", () => {
  test("should display analytics page with header", async ({ page }) => {
    await page.goto("/analytics");

    // Check for the page heading
    await expect(
      page.getByRole("heading", { name: /analytics/i, level: 1 })
    ).toBeVisible();

    // Check for the description
    await expect(
      page.getByText(/track your performance and profit margins/i)
    ).toBeVisible();
  });

  test("should display stats cards", async ({ page }) => {
    await page.goto("/analytics");

    // Check for analytics stats cards
    await expect(page.getByText("Revenue (MTD)")).toBeVisible();
    await expect(page.getByText("Profit (MTD)")).toBeVisible();
    await expect(page.getByText("Sales (MTD)")).toBeVisible();
    await expect(page.getByText("Avg. Margin")).toBeVisible();
  });

  test("should display Performance Charts section", async ({ page }) => {
    await page.goto("/analytics");

    // Check for the charts section
    await expect(
      page.getByRole("heading", { name: /performance charts/i })
    ).toBeVisible();

    await expect(
      page.getByText(/revenue, profit, and sales trends/i)
    ).toBeVisible();
  });

  test("should show empty state message when no data", async ({ page }) => {
    await page.goto("/analytics");

    // Check for empty state message (when no sales data)
    await expect(page.getByText(/no data yet/i)).toBeVisible();
    await expect(
      page.getByText(/charts will appear here once you start making sales/i)
    ).toBeVisible();
  });
});
