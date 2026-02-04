import { test as base, type Page } from "@playwright/test";

/**
 * Extended test fixtures for authentication scenarios.
 *
 * Provides authenticated page context for tests that require a logged-in user.
 */

/**
 * Mock session data for testing.
 * In a real scenario, this would be obtained from the auth provider.
 */
const MOCK_SESSION = {
  user: {
    id: "test-user-id",
    email: "test@example.com",
    name: "Test User",
  },
  expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
};

/**
 * Sets up a mock authenticated session by injecting cookies.
 * This bypasses the actual OAuth flow for testing purposes.
 */
async function setupMockAuth(page: Page): Promise<void> {
  // Set the session token cookie that NextAuth uses
  // Note: In production, you would use a proper test auth setup
  await page.context().addCookies([
    {
      name: "next-auth.session-token",
      value: "mock-session-token-for-testing",
      domain: "localhost",
      path: "/",
      httpOnly: true,
      secure: false,
      sameSite: "Lax",
    },
    {
      name: "__Secure-next-auth.session-token",
      value: "mock-session-token-for-testing",
      domain: "localhost",
      path: "/",
      httpOnly: true,
      secure: false,
      sameSite: "Lax",
    },
  ]);
}

/**
 * Extended test fixture that provides an authenticated page.
 *
 * Usage:
 * ```typescript
 * import { test } from './fixtures/auth';
 *
 * test('should access protected route', async ({ authenticatedPage }) => {
 *   await authenticatedPage.goto('/inventory');
 *   // User is now logged in
 * });
 * ```
 */
export const test = base.extend<{
  authenticatedPage: Page;
}>({
  authenticatedPage: async ({ page }, use) => {
    await setupMockAuth(page);
    await use(page);
  },
});

export { expect } from "@playwright/test";

/**
 * Test user data for use in authenticated tests.
 */
export const testUser = {
  id: MOCK_SESSION.user.id,
  email: MOCK_SESSION.user.email,
  name: MOCK_SESSION.user.name,
};
