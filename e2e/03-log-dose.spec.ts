/**
 * E2E: Log a dose
 *
 * Signs in, navigates to Timeline, finds a pending dose item, and marks it taken.
 * Verifies the status updates to "done".
 *
 * If no pending doses exist (clean account), the test is skipped gracefully.
 */
import { test, expect } from '@playwright/test'
import { loginAs } from './helpers'

test.describe('Log a dose', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page)
  })

  test('user can mark a dose as taken from the timeline', async ({ page }) => {
    // Timeline is the default route after login
    await page.waitForURL(/\/timeline/, { timeout: 10_000 })

    // Look for a pending dose button/card
    const doseCards = page.locator('[aria-label*="Mark taken" i], button:has-text("Mark taken"), [data-status="pending"]')
    const count = await doseCards.count()

    if (count === 0) {
      test.skip(true, 'No pending doses found — add a medication first via the add-medication E2E test')
      return
    }

    // Click the first pending dose to open the dose modal
    await doseCards.first().click()

    // Confirm dose taken in the modal
    const takenBtn = page.getByRole('button', { name: /taken|mark.*taken|done/i })
    await expect(takenBtn.first()).toBeVisible({ timeout: 5_000 })
    await takenBtn.first().click()

    // The modal should close
    await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 5_000 })

    // The card should now reflect a "done" or checked state
    // We look for either a visual indicator or the aria-label update
    await expect(
      page.locator('[data-status="done"], [aria-label*="taken" i], [aria-label*="done" i]').first()
    ).toBeVisible({ timeout: 8_000 })
  })
})
