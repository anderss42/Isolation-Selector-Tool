import { test, expect } from '@playwright/test';
import { fillStage1, expectStage2, fillStage2AndCalculate, readOutput } from './helpers.js';

test('page loads with title and populated fluid dropdown', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('h1')).toContainText('Isolation Selector Tool');

    // Dropdown is populated by JS with 4 optgroups + an "Other" option.
    await expect(page.locator('#fluidSelect optgroup')).toHaveCount(4);
    await expect(page.locator('#fluidSelect option', { hasText: 'Other' })).toHaveCount(1);
    await expect(page.locator('#fluidSelect option', { hasText: 'Crude Oil' })).toHaveCount(1);

    // Reveal the rest of the form (title + both planning checks = No).
    await page.fill('#isoTitle', 'Job');
    await page.check('#majorAccidentNo');
    await page.check('#waitShutdownNo');
    await page.locator('#restBlock').waitFor({ state: 'visible' });

    // "Other" manual entry is hidden until selected.
    await expect(page.locator('#otherFluidWrap')).toBeHidden();
    await page.selectOption('#fluidSelect', 'other');
    await expect(page.locator('#otherFluidWrap')).toBeVisible();
});

test('happy path reaches output and shows PDF button', async ({ page }) => {
    await fillStage1(page, { fluidLabel: 'Diesel', temp: 20, period: 'oneOrLess' });
    await expectStage2(page);
    await fillStage2AndCalculate(page, { selIso: 'dbb' });

    const out = await readOutput(page);
    expect(out.fluid).toContain('Diesel');
    expect(out.fluid).toContain('Group 3');
    await expect(page.locator('#printBtn')).toBeVisible();
});
