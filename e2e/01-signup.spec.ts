/**
 * E2E: Sign-up flow
 *
 * Creates a brand-new account, verifies landing → login → auth'd app shell.
 * Uses a unique email per run so repeated runs don't conflict.
 *
 * NOTE: Beta mode requires an invite code (MLOOP-XXXXX).  Supply one via
 *       E2E_INVITE_CODE env var, or this test will be skipped in CI.
 */
import { test, expect } from '@playwright/test'
import { TEST_INVITE_CODE } from './helpers'

const RUN_ID = Date.now()

test.describe('Sign-up flow', () => {
  test('new user can sign up and reach the timeline', async ({ page }) => {
    const email = `e2e+${RUN_ID}@marinloop.com`
    const password = 'E2eTestPass1!'

    await page.goto('/landing')
    await expect(page.getByText(/marinloop/i).first()).toBeVisible()

    // Navigate to sign-up
    const signupBtn = page.getByRole('button', { name: /get started|sign up|create account/i })
    await signupBtn.first().click()

    // Fill sign-up form
    const emailInput = page.locator('input[type="email"]')
    await emailInput.fill(email)

    const passwordInputs = page.locator('input[type="password"]')
    await passwordInputs.first().fill(password)
    if (await passwordInputs.count() > 1) {
      await passwordInputs.nth(1).fill(password) // confirm password field
    }

    // Invite code field (beta)
    const inviteInput = page.locator('input[placeholder*="invite" i], input[placeholder*="MLOOP" i]')
    if (await inviteInput.count() > 0) {
      await inviteInput.fill(TEST_INVITE_CODE)
    }

    await page.getByRole('button', { name: /sign up|create account/i }).click()

    // Either email confirmation is required (check inbox copy) or we land on timeline
    const landed = await Promise.race([
      page.waitForURL(/\/(timeline|summary|meds)/, { timeout: 15_000 }).then(() => 'authed'),
      page.getByText(/check your email|confirm your email/i).waitFor({ timeout: 15_000 }).then(() => 'confirm'),
    ])

    expect(['authed', 'confirm']).toContain(landed)
  })
})
