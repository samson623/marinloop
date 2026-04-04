/**
 * E2E: Profile — push notification switch
 *
 * Verifies the toggle can reach an "on" state after a real click + permission grant.
 * Requires a reachable dev/preview server, valid E2E login (see helpers), and VAPID + Supabase
 * configured like production; otherwise the toggle may stay off and the test will fail loudly.
 */
import { test, expect } from '@playwright/test'
import { loginAs } from './helpers'

test.describe('Profile push toggle', () => {
  test.describe.configure({ timeout: 120_000 })

  test.beforeEach(async ({ page, baseURL }) => {
    const origin = new URL(baseURL ?? 'http://localhost:5173').origin
    await page.context().grantPermissions(['notifications'], { origin })
    await loginAs(page)
  })

  test('push switch can be turned on', async ({ page }) => {
    await page.goto('/profile')
    await expect(page.getByRole('main', { name: 'Profile' })).toBeVisible({ timeout: 15_000 })

    const toggle = page.getByRole('switch', { name: /push notifications/i })
    await expect(toggle).toBeVisible()
    await expect(toggle).toBeEnabled()

    if ((await toggle.getAttribute('aria-checked')) === 'true') {
      await toggle.click()
      await expect(toggle).toHaveAttribute('aria-checked', 'false', { timeout: 10_000 })
    }

    await toggle.click()
    await expect(toggle).toHaveAttribute('aria-checked', 'true', { timeout: 20_000 })
  })
})
