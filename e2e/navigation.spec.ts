import { test, expect } from "@playwright/test";

/**
 * Navigation E2E tests for ResellerOS.
 *
 * Tests cover:
 * - Sidebar navigation functionality
 * - Route navigation between dashboard pages
 * - Navigation link states
 */

test.describe("Navigation", () => {
  test("should navigate between dashboard pages using sidebar", async ({
    page,
  }) => {
    // Start at inventory page
    await page.goto("/inventory");
    await expect(page).toHaveURL("/inventory");

    // Navigate to Orders
    await page.getByRole("link", { name: /^orders$/i }).click();
    await expect(page).toHaveURL("/orders");
    await expect(
      page.getByRole("heading", { name: /orders/i, level: 1 })
    ).toBeVisible();

    // Navigate to Analytics
    await page.getByRole("link", { name: /analytics/i }).click();
    await expect(page).toHaveURL("/analytics");
    await expect(
      page.getByRole("heading", { name: /analytics/i, level: 1 })
    ).toBeVisible();

    // Navigate to Settings
    await page.getByRole("link", { name: /^settings$/i }).click();
    await expect(page).toHaveURL("/settings");
    await expect(
      page.getByRole("heading", { name: /settings/i, level: 1 })
    ).toBeVisible();
  });

  test("should navigate to Autopilot settings", async ({ page }) => {
    await page.goto("/inventory");

    // Navigate to Autopilot
    await page.getByRole("link", { name: /autopilot/i }).click();
    await expect(page).toHaveURL("/settings/autopilot");
  });

  test("should navigate to Listings page", async ({ page }) => {
    await page.goto("/inventory");

    // Navigate to Listings
    await page.getByRole("link", { name: /listings/i }).click();
    await expect(page).toHaveURL("/listings");
  });

  test("should have working home/logo link", async ({ page }) => {
    await page.goto("/orders");

    // Click on the ResellerOS logo/brand link
    await page.getByRole("link", { name: /reselleros/i }).click();

    // Should navigate to home
    await expect(page).toHaveURL("/");
  });

  test("should display all navigation items in sidebar", async ({ page }) => {
    await page.goto("/inventory");

    // Verify all navigation items are present
    const navItems = [
      "Dashboard",
      "Inventory",
      "Listings",
      "Orders",
      "Analytics",
      "Autopilot",
      "Settings",
    ];

    for (const item of navItems) {
      await expect(
        page.locator("nav").getByRole("link", { name: new RegExp(item, "i") })
      ).toBeVisible();
    }
  });

  test("should maintain sidebar across page navigations", async ({ page }) => {
    // Navigate through multiple pages and verify sidebar persists
    const pages = ["/inventory", "/orders", "/analytics", "/settings"];

    for (const path of pages) {
      await page.goto(path);

      // Sidebar should always be visible
      await expect(page.locator("aside")).toBeVisible();

      // Brand should always be visible
      await expect(page.getByRole("link", { name: /reselleros/i })).toBeVisible();
    }
  });
});
