import { test, expect } from '@playwright/test';
import { fillStage1, fillStage2AndCalculate, readOutput, MEETS_TEXT } from './helpers.js';

test.describe('Navigation', () => {
    test('back button returns to input section and hides output card @quick', async ({ page }) => {
        await fillStage1(page, {
            title: 'Nav test',
            purpose: 'boc',
            substance: 'flammable',
            period: 'oneOrLess',
        });
        await fillStage2AndCalculate(page, {
            lineDesc: 'Nav line',
            pipeSize: 10,
            pressure: 50,
            selIso: 'spade',
        });

        await expect(page.locator('#outCard'),      'outCard visible').toBeVisible();
        await expect(page.locator('#inputSection'), 'inputSection hidden').not.toBeVisible();

        await page.click('#backBtn');

        await expect(page.locator('#outCard'),      'outCard hidden after back').not.toBeVisible();
        await expect(page.locator('#inputSection'), 'inputSection visible after back').toBeVisible();
        await expect(page.locator('#backBtn'),      'backBtn hidden after back').not.toBeVisible();
        await expect(page.locator('#printBtn'),     'printBtn hidden after back').not.toBeVisible();
    });

    test('after going back, re-calculating shows updated output @quick', async ({ page }) => {
        await fillStage1(page, {
            title: 'Recalc test',
            purpose: 'boc',
            substance: 'flammable',
            period: 'oneOrLess',
        });
        await fillStage2AndCalculate(page, {
            lineDesc: 'First calculation',
            pipeSize: 10,
            pressure: 50,
            selIso: 'spade',
        });

        // Go back
        await page.click('#backBtn');

        // Change isolation to single and recalculate
        await page.locator('label[for="single"]').click();
        await page.fill('#lineDesc', 'Second calculation');
        await page.click('#calcBtn');
        await page.locator('#outCard').waitFor({ state: 'visible' });

        const out = await readOutput(page);
        expect(out.lineDesc, 'updated lineDesc').toBe('Second calculation');
        expect(out.isoSel,   'updated isolation').toContain('Single or double valve');
    });

    test('header is hidden when output is shown and restored after back @quick', async ({ page }) => {
        await fillStage1(page, {
            title: 'Header test',
            purpose: 'motion',
        });
        await fillStage2AndCalculate(page, { selIso: 'sbb' });

        await expect(page.locator('#header'), 'header hidden during output').not.toBeVisible();

        await page.click('#backBtn');
        await expect(page.locator('#header'), 'header visible after back').toBeVisible();
    });

    test('calcBtn is hidden when output is shown and visible after back @quick', async ({ page }) => {
        await fillStage1(page, {
            title: 'CalcBtn test',
            purpose: 'cse',
        });
        await fillStage2AndCalculate(page, { selIso: 'spade' });

        await expect(page.locator('#calcBtn'),  'calcBtn hidden during output').not.toBeVisible();
        await expect(page.locator('#printBtn'), 'printBtn visible during output').toBeVisible();

        await page.click('#backBtn');
        await expect(page.locator('#calcBtn'),  'calcBtn visible after back').toBeVisible();
        await expect(page.locator('#printBtn'), 'printBtn hidden after back').not.toBeVisible();
    });

    test('ICC number is preserved through the full flow @quick', async ({ page }) => {
        await fillStage1(page, {
            title: 'ICC test',
            purpose: 'boc',
            substance: 'nonHaz',
            period: 'oneOrLess',
            iccNo: 350000,
        });
        await fillStage2AndCalculate(page, {
            lineDesc: 'ICC line',
            pipeSize: 6,
            pressure: 10,
            selIso: 'spade',
        });

        // ICC number is used for the PDF filename — verify it's still in the field
        const iccVal = await page.locator('#iccNo').inputValue();
        expect(iccVal, 'ICC number preserved').toBe('350000');
    });

    test('page title is correct after navigation back @quick', async ({ page }) => {
        await fillStage1(page, { title: 'Title test', purpose: 'cse' });
        await fillStage2AndCalculate(page, { selIso: 'spade' });
        await page.click('#backBtn');
        await expect(page).toHaveTitle('Isolation Selector Tool');
    });
});
