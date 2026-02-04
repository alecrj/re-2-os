import { test, expect } from "@playwright/test";

/**
 * Settings page E2E tests for ResellerOS.
 *
 * Tests cover:
 * - Settings page display
 * - Account section
 * - Connected channels section
 * - Autopilot settings link
 * - Tab navigation
 */

test.describe("Settings Page", () => {
  test("should display settings page with header", async ({ page }) => {
    await page.goto("/settings");

    // Check for the page heading
    await expect(
      page.getByRole("heading", { name: /settings/i, level: 1 })
    ).toBeVisible();

    // Check for the description
    await expect(
      page.getByText(/manage your account and preferences/i)
    ).toBeVisible();
  });

  test("should display General and Audit Log tabs", async ({ page }) => {
    await page.goto("/settings");

    // Check for tabs
    await expect(page.getByRole("tab", { name: /general/i })).toBeVisible();
    await expect(page.getByRole("tab", { name: /audit log/i })).toBeVisible();
  });

  test("should display Account section", async ({ page }) => {
    await page.goto("/settings");

    // Check for Account card
    await expect(
      page.getByRole("heading", { name: /account/i })
    ).toBeVisible();

    await expect(
      page.getByText(/manage your profile and subscription/i)
    ).toBeVisible();

    await expect(
      page.getByRole("button", { name: /manage account/i })
    ).toBeVisible();
  });

  test("should display Connected Channels section", async ({ page }) => {
    await page.goto("/settings");

    // Check for Connected Channels card
    await expect(
      page.getByRole("heading", { name: /connected channels/i })
    ).toBeVisible();

    // Check for marketplace connections
    await expect(page.getByText("eBay")).toBeVisible();
    await expect(page.getByText("Poshmark")).toBeVisible();
    await expect(page.getByText("Mercari")).toBeVisible();
  });

  test("should display Autopilot Settings section with link", async ({
    page,
  }) => {
    await page.goto("/settings");

    // Check for Autopilot Settings card
    await expect(
      page.getByRole("heading", { name: /autopilot settings/i })
    ).toBeVisible();

    await expect(
      page.getByText(/configure automation rules/i)
    ).toBeVisible();

    // Check for Configure Autopilot button
    const autopilotButton = page.getByRole("link", {
      name: /configure autopilot/i,
    });
    await expect(autopilotButton).toBeVisible();
  });

  test("should navigate to Autopilot page from settings", async ({ page }) => {
    await page.goto("/settings");

    // Click Configure Autopilot button
    await page.getByRole("link", { name: /configure autopilot/i }).click();

    // Should navigate to autopilot settings
    await expect(page).toHaveURL("/settings/autopilot");
  });

  test("should switch to Audit Log tab", async ({ page }) => {
    await page.goto("/settings");

    // Click Audit Log tab
    await page.getByRole("tab", { name: /audit log/i }).click();

    // Audit log content should be visible (the AuditLog component)
    // This will depend on what the AuditLog component renders
    await expect(page.getByRole("tabpanel")).toBeVisible();
  });

  test("should show assisted status for non-API channels", async ({ page }) => {
    await page.goto("/settings");

    // Poshmark and Mercari should show "Assisted" status (disabled)
    const assistedButtons = page.getByRole("button", { name: /assisted/i });
    await expect(assistedButtons.first()).toBeDisabled();
  });
});
