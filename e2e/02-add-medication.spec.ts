/**
 * E2E: Add a medication
 *
 * Signs in as the shared E2E user, navigates to Medications, adds a new med,
 * and verifies it appears in the list.
 */
import { test, expect } from '@playwright/test'
import { loginAs, goToTab } from './helpers'

const MED_NAME = `E2E-Ibuprofen-${Date.now()}`

test.describe('Add medication', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page)
  })

  test('user can add a medication and see it in the list', async ({ page }) => {
    await goToTab(page, 'Meds')

    // Open Add Medication modal
    await page.getByRole('button', { name: /add medication/i }).first().click()

    // Fill the form
    await page.fill('input[id="med-name"], input[placeholder*="Amoxicillin" i]', MED_NAME)
    await page.fill('input[id="med-dose"], input[placeholder*="dosage" i], input[placeholder*="500mg" i]', '400mg')

    // Supply field
    const supplyInput = page.locator('input[id="med-supply"], input[placeholder*="supply" i]')
    if (await supplyInput.count() > 0) {
      await supplyInput.fill('30')
    }

    // Submit
    await page.getByRole('button', { name: /save|add medication|add med/i }).last().click()

    // Verify the med appears in the list
    await expect(page.getByText(MED_NAME)).toBeVisible({ timeout: 10_000 })
  })
})
