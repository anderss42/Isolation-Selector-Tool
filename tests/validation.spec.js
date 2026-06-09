import { test, expect } from '@playwright/test';
import { fillStage1 } from './helpers.js';

// Register an auto-dismiss handler BEFORE triggering the action that causes the alert.
// page.once ensures the listener fires once and is removed. The handler dismisses
// the dialog immediately so the click can complete, then we assert the captured message.
async function nextAndExpectAlert(page, expectedMsg) {
    let capturedMsg = '';
    page.once('dialog', async dialog => { capturedMsg = dialog.message(); await dialog.dismiss(); });
    await page.click('#nextBtn');
    expect(capturedMsg, `expected alert containing "${expectedMsg}"`).toContain(expectedMsg);
}

async function calcAndExpectAlert(page, expectedMsg) {
    let capturedMsg = '';
    page.once('dialog', async dialog => { capturedMsg = dialog.message(); await dialog.dismiss(); });
    await page.click('#calcBtn');
    expect(capturedMsg, `expected alert containing "${expectedMsg}"`).toContain(expectedMsg);
}

// --- Stage 1 validation ---

test('stage 1: clicking Next with no title shows alert @quick', async ({ page }) => {
    await page.goto('/');
    await page.locator('label[for="boc"]').click();
    await nextAndExpectAlert(page, 'title for the isolation');
});

test('stage 1: clicking Next with no purpose shows alert @quick', async ({ page }) => {
    await page.goto('/');
    await page.fill('#isoTitle', 'Test isolation');
    // Do not select a purpose
    await nextAndExpectAlert(page, 'purpose of the isolation');
});

test('stage 1: clicking Next for BoC with no substance shows alert @quick', async ({ page }) => {
    await page.goto('/');
    await page.fill('#isoTitle', 'Test isolation');
    await page.locator('label[for="boc"]').click();
    // Do not select a substance
    await page.selectOption('#period', 'oneOrLess');
    await nextAndExpectAlert(page, 'substance');
});

test('stage 1: clicking Next for BoC with no duration shows alert @quick', async ({ page }) => {
    await page.goto('/');
    await page.fill('#isoTitle', 'Test isolation');
    await page.locator('label[for="boc"]').click();
    await page.locator('label[for="flammable"]').click();
    // Do not select a duration
    await nextAndExpectAlert(page, 'long');
});

test('stage 1: Motion requires only title and purpose to proceed @quick', async ({ page }) => {
    await page.goto('/');
    await page.fill('#isoTitle', 'Motion test');
    await page.locator('label[for="motion"]').click();
    await page.click('#nextBtn');
    // Should proceed without an alert
    await expect(page.locator('#calcBtn')).toBeVisible();
});

test('stage 1: CSE requires only title and purpose to proceed @quick', async ({ page }) => {
    await page.goto('/');
    await page.fill('#isoTitle', 'CSE test');
    await page.locator('label[for="cse"]').click();
    await page.click('#nextBtn');
    await expect(page.locator('#calcBtn')).toBeVisible();
});

// --- Stage 2 validation ---

test('stage 2 BoC: missing line description shows alert @quick', async ({ page }) => {
    await fillStage1(page, {
        title: 'Validation test',
        purpose: 'boc',
        substance: 'flammable',
        period: 'oneOrLess',
    });
    // Do not fill line description
    await page.fill('#pipeSizeNum', '10');
    await page.fill('#pressure', '50');
    await page.locator('label[for="spade"]').click();
    await calcAndExpectAlert(page, 'description of the line');
});

test('stage 2 BoC: missing pipe size shows alert @quick', async ({ page }) => {
    await fillStage1(page, {
        title: 'Validation test',
        purpose: 'boc',
        substance: 'flammable',
        period: 'oneOrLess',
    });
    await page.fill('#lineDesc', 'Test line');
    // Do not fill pipe size
    await page.fill('#pressure', '50');
    await page.locator('label[for="spade"]').click();
    await calcAndExpectAlert(page, 'size of the pipe');
});

test('stage 2 BoC: missing pressure shows alert @quick', async ({ page }) => {
    await fillStage1(page, {
        title: 'Validation test',
        purpose: 'boc',
        substance: 'flammable',
        period: 'oneOrLess',
    });
    await page.fill('#lineDesc', 'Test line');
    await page.fill('#pipeSizeNum', '10');
    // Do not fill pressure
    await page.locator('label[for="spade"]').click();
    await calcAndExpectAlert(page, 'pressure');
});

test('stage 2 BoC: missing isolation type shows alert @quick', async ({ page }) => {
    await fillStage1(page, {
        title: 'Validation test',
        purpose: 'boc',
        substance: 'flammable',
        period: 'oneOrLess',
    });
    await page.fill('#lineDesc', 'Test line');
    await page.fill('#pipeSizeNum', '10');
    await page.fill('#pressure', '50');
    // Do not select isolation type
    await calcAndExpectAlert(page, 'isolation');
});

test('stage 2 BoC: pressure value 0 is accepted (boundary isolation case) @quick', async ({ page }) => {
    await fillStage1(page, {
        title: 'Zero pressure test',
        purpose: 'boc',
        substance: 'flammable',
        period: 'oneOrLess',
        boundary: true,
    });
    // Pressure should have been set to 0 by showSpec — verify calculation proceeds
    await page.fill('#lineDesc', 'Test line');
    await page.fill('#pipeSizeNum', '6');
    // Leave pressure as 0 (auto-set by app)
    await page.locator('label[for="spade"]').click();

    // Should not show any alert — output card should appear
    await page.click('#calcBtn');
    await expect(page.locator('#outCard')).toBeVisible();
    const pressure = await page.locator('#outBar').textContent();
    expect(pressure.trim(), 'pressure should be 0 bar').toBe('0 bar');
});

test('stage 2 SBT: missing line description shows alert @quick', async ({ page }) => {
    await fillStage1(page, {
        title: 'SBT validation test',
        purpose: 'sbt',
        substance: 'flammable',
        period: 'oneOrLess',
    });
    await page.fill('#pressure', '50');
    await page.locator('label[for="sbb"]').click();
    await calcAndExpectAlert(page, 'description of the line');
});
