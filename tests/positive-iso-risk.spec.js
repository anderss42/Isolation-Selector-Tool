import { test, expect } from '@playwright/test';
import { fillStage1, expectStage2, fillStage2AndCalculate, readOutput } from './helpers.js';

// positiveIsoRisk = false ("No" answer) means the spade is safe to fit.
// The tool auto-applies spade (Category I) and hides the isolation type picker.

test('positiveIsoRisk=no hides picker and shows posIsoNotice', async ({ page }) => {
    await fillStage1(page, {
        otherGroup: 1, otherName: 'Gas', temp: 20, period: 'oneOrLess',
        positiveIsoRisk: false,
    });
    await expectStage2(page);
    await expect(page.locator('#isoTypeSection')).toBeHidden();
    await expect(page.locator('#posIsoNotice')).toBeVisible();
    await expect(page.locator('#cseNotice')).toBeHidden();
});

test('positiveIsoRisk=no forces Category I for any group', async ({ page }) => {
    for (const group of [1, 2, 3, 4]) {
        await fillStage1(page, {
            otherGroup: group, otherName: `G${group}`, temp: 20, period: 'oneOrLess',
            positiveIsoRisk: false,
        });
        await expectStage2(page);
        await fillStage2AndCalculate(page, { lineDesc: `G${group} line` });
        const out = await readOutput(page);
        expect(out.minReqText, `group ${group}`).toContain('Category I');
        expect(out.outcome).toContain('meets the minimum standard');
        await page.click('#backBtn');
    }
});

test('positiveIsoRisk=no output shows "No" for positive isolation risk field', async ({ page }) => {
    await fillStage1(page, {
        otherGroup: 2, otherName: 'Chem', temp: 20, period: 'oneOrLess',
        positiveIsoRisk: false,
    });
    await expectStage2(page);
    await fillStage2AndCalculate(page);
    const out = await readOutput(page);
    expect(out.posIsoRisk).toBe('No');
});

test('positiveIsoRisk=no takes priority over all other rules', async ({ page }) => {
    // Even with all other flags set, positiveIsoRisk=no → Category I
    await fillStage1(page, {
        otherGroup: 4, otherName: 'G4', temp: 20, period: 'moreThanShift',
        positiveIsoRisk: false,
        hotWork: true, flareVentDrains: true, sbt: true, boundary: true,
    });
    await expectStage2(page);
    await fillStage2AndCalculate(page);
    const out = await readOutput(page);
    expect(out.minReqText).toContain('Category I');
    expect(out.posIsoRisk).toBe('No');
});

test('positiveIsoRisk=yes shows the valve picker (spadeOption always hidden)', async ({ page }) => {
    await fillStage1(page, {
        otherGroup: 1, otherName: 'Gas', temp: 20, period: 'oneOrLess',
        positiveIsoRisk: true,
    });
    await expectStage2(page);
    await expect(page.locator('#isoTypeSection')).toBeVisible();
    await expect(page.locator('#posIsoNotice')).toBeHidden();
    await expect(page.locator('#cseNotice')).toBeHidden();
    // Spade option is always hidden — user never selects it manually
    await expect(page.locator('#spadeOption')).toBeHidden();
    // Valve options are visible
    await expect(page.locator('label[for="dbb"]')).toBeVisible();
    await expect(page.locator('label[for="sbb"]')).toBeVisible();
    await expect(page.locator('label[for="single"]')).toBeVisible();
    await expect(page.locator('label[for="twin_seal"]')).toBeVisible();
});

test('positiveIsoRisk=yes output shows "Yes" for positive isolation risk field', async ({ page }) => {
    await fillStage1(page, {
        otherGroup: 1, otherName: 'Gas', temp: 20, period: 'oneOrLess',
        positiveIsoRisk: true,
    });
    await expectStage2(page);
    await fillStage2AndCalculate(page, { selIso: 'dbb' });
    const out = await readOutput(page);
    expect(out.posIsoRisk).toBe('Yes');
});

test('back from positiveIsoRisk=no path and recalculate', async ({ page }) => {
    await fillStage1(page, {
        otherGroup: 1, otherName: 'Gas', temp: 20, period: 'oneOrLess',
        positiveIsoRisk: false,
    });
    await expectStage2(page);
    await fillStage2AndCalculate(page);
    await page.click('#backBtn');

    // Back to Stage 2 — picker should still be hidden
    await expect(page.locator('#isoTypeSection')).toBeHidden();
    await expect(page.locator('#posIsoNotice')).toBeVisible();
    await expect(page.locator('#calcBtn')).toBeVisible();

    // Recalculate
    await page.click('#calcBtn');
    await page.locator('#outCard').waitFor({ state: 'visible' });
    const out = await readOutput(page);
    expect(out.minReqText).toContain('Category I');
});
