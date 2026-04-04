import { test, expect } from '@playwright/test'
import { loginAs } from './helpers'

test.describe('Chat widget voice replies', () => {
  test('renders voice-test replies inside the assistant thread', async ({ page }) => {
    await loginAs(page)
    await page.goto('/timeline?voiceTest=1', { waitUntil: 'networkidle' })

    await page.getByLabel('Open assistant').click()
    await expect(page.getByRole('dialog', { name: /marinloop assistant/i })).toBeVisible()

    const voiceTestInput = page.getByLabel('Test voice command')
    await voiceTestInput.fill('when is my next appointment?')
    await page.getByRole('button', { name: 'Run' }).click()

    const thread = page.getByRole('dialog', { name: /marinloop assistant/i })
    await expect(thread.getByText('when is my next appointment?', { exact: true })).toBeVisible()
    await expect(thread.getByText(/(your next appointment is|no upcoming appointments found\.)/i)).toBeVisible()
  })
})
