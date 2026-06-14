import { test, expect } from '@playwright/test';
import { fillStage1, expectStage2, fillStage2AndCalculate } from './helpers.js';

test('return to input data, then recalculate', async ({ page }) => {
    await fillStage1(page, { fluidLabel: 'Diesel', temp: 20, period: 'oneOrLess' });
    await expectStage2(page);
    await fillStage2AndCalculate(page, { selIso: 'dbb' });

    await expect(page.locator('#outCard')).toBeVisible();

    await page.click('#backBtn');
    await expect(page.locator('#outCard')).toBeHidden();
    await expect(page.locator('#inputSection')).toBeVisible();
    // Stage 2 was open, so Calculate remains available.
    await expect(page.locator('#calcBtn')).toBeVisible();

    await page.click('#calcBtn');
    await expect(page.locator('#outCard')).toBeVisible();
});

test('back from a shutdown record returns to input', async ({ page }) => {
    await fillStage1(page, { title: 'Shutdown', majorAccident: 'yes' });
    await page.locator('#outCard').waitFor({ state: 'visible' });
    await page.click('#backBtn');
    await expect(page.locator('#inputSection')).toBeVisible();
    await expect(page.locator('#outCard')).toBeHidden();
});
