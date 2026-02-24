const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
  });
  const page = await context.newPage();

  await page.goto('http://localhost:5173', { waitUntil: 'domcontentloaded' });

  // Wait for the demo app to auto-initialize (isDemo=true skips login)
  // Look for the main app header/nav to confirm we're past the loading screen
  try {
    await page.waitForFunction(() => !document.querySelector('[class*="loading"]'), { timeout: 8000 });
  } catch {}
  await page.waitForTimeout(3000);
  await page.screenshot({ path: 'ss-01-loaded.png' });
  console.log('01 loaded');

  // Find and click the Meds tab in bottom nav
  const medsTab = page.locator('button').filter({ hasText: /^meds$/i }).first();
  const medsTabVisible = await medsTab.isVisible({ timeout: 2000 }).catch(() => false);
  if (medsTabVisible) {
    await medsTab.click();
    await page.waitForTimeout(600);
  }
  await page.screenshot({ path: 'ss-02-meds.png' });
  console.log('02 meds tab');

  // Click first medication in the list
  const firstMedBtn = page.locator('ul button, li button, [role="listitem"] button').first();
  const firstMedVisible = await firstMedBtn.isVisible({ timeout: 2000 }).catch(() => false);
  if (firstMedVisible) {
    await firstMedBtn.click();
    await page.waitForTimeout(600);
  }
  await page.screenshot({ path: 'ss-03-detail.png' });
  console.log('03 med detail');

  // Click Edit
  const editBtn = page.locator('button').filter({ hasText: /^edit$/i }).first();
  if (await editBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await editBtn.click();
    await page.waitForTimeout(600);
  }
  await page.screenshot({ path: 'ss-04-edit-once.png', fullPage: true });
  console.log('04 edit (once daily)');

  // Switch to Three times daily
  const freqSelect = page.locator('select').filter({ hasText: /once|twice|three/i }).first();
  if (await freqSelect.isVisible({ timeout: 2000 }).catch(() => false)) {
    await freqSelect.selectOption('3');
    await page.waitForTimeout(400);
    await page.screenshot({ path: 'ss-05-three-times.png', fullPage: true });
    console.log('05 three times daily');

    await freqSelect.selectOption('2');
    await page.waitForTimeout(400);
    await page.screenshot({ path: 'ss-06-twice-daily.png', fullPage: true });
    console.log('06 twice daily');

    await freqSelect.selectOption('1');
    await page.waitForTimeout(400);
    await page.screenshot({ path: 'ss-07-once-daily.png', fullPage: true });
    console.log('07 once daily');
  }

  await browser.close();
  console.log('Done');
})().catch(e => { console.error(e.message); process.exit(1); });
