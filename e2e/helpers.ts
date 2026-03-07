import { Page, expect } from '@playwright/test'

// ── Test credentials ─────────────────────────────────────────────────────────
// Loaded from env so secrets never live in source. Provide via .env.test or CI.
export const TEST_EMAIL = process.env.E2E_TEST_EMAIL ?? 'e2e-test@marinloop.com'
export const TEST_PASSWORD = process.env.E2E_TEST_PASSWORD ?? 'E2eTestPass1!'
export const TEST_INVITE_CODE = process.env.E2E_INVITE_CODE ?? 'MLOOP-TEST01'

// ── Navigation helpers ───────────────────────────────────────────────────────

/** Wait for the React app shell to be visible (i.e. past auth loading). */
export async function waitForAppReady(page: Page) {
  await page.waitForLoadState('networkidle')
  // The app is ready once the main nav or the landing CTA is visible.
  await expect(page.locator('nav, [data-testid="landing"]').first()).toBeVisible({ timeout: 15_000 })
}

/** Log in with the shared E2E credentials.  Assumes user already exists. */
export async function loginAs(page: Page, email = TEST_EMAIL, password = TEST_PASSWORD) {
  await page.goto('/login')
  await page.fill('input[type="email"]', email)
  await page.fill('input[type="password"]', password)
  await page.getByRole('button', { name: /sign in/i }).click()
  // Wait until we leave the login route
  await page.waitForURL(/\/(timeline|summary|meds|appointments|profile)/, { timeout: 20_000 })
}

/** Navigate to a named tab via the bottom nav. */
export async function goToTab(page: Page, label: string) {
  await page.getByRole('link', { name: new RegExp(label, 'i') }).click()
  await page.waitForLoadState('networkidle')
}
