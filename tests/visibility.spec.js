import { test, expect } from '@playwright/test';

// Verify that the correct form fields are shown or hidden depending on purpose selection.
// Hidden sections use display:none; visible ones use display:block.

test.describe('Field visibility per purpose', () => {
    test('on load — substance, duration, boundary, line-spec sections are hidden @quick', async ({ page }) => {
        await page.goto('/');
        await expect(page.locator('#subHide'),             'substance section').not.toBeVisible();
        await expect(page.locator('#durHide'),             'duration section').not.toBeVisible();
        await expect(page.locator('#boundHide'),           'boundary section').not.toBeVisible();
        await expect(page.locator('#lineSpecificationDiv'),'line spec panel').not.toBeVisible();
        await expect(page.locator('#calcBtn'),             'calcBtn').not.toBeVisible();
    });

    test('selecting BoC shows substance, duration and boundary sections @quick', async ({ page }) => {
        await page.goto('/');
        await page.locator('label[for="boc"]').click();
        await expect(page.locator('#subHide'),   'substance').toBeVisible();
        await expect(page.locator('#durHide'),   'duration').toBeVisible();
        await expect(page.locator('#boundHide'), 'boundary').toBeVisible();
    });

    test('selecting SBT shows substance, duration and boundary sections @quick', async ({ page }) => {
        await page.goto('/');
        await page.locator('label[for="sbt"]').click();
        await expect(page.locator('#subHide'),   'substance').toBeVisible();
        await expect(page.locator('#durHide'),   'duration').toBeVisible();
        await expect(page.locator('#boundHide'), 'boundary').toBeVisible();
    });

    test('selecting Motion hides substance, duration and boundary sections @quick', async ({ page }) => {
        await page.goto('/');
        await page.locator('label[for="motion"]').click();
        await expect(page.locator('#subHide'),   'substance').not.toBeVisible();
        await expect(page.locator('#durHide'),   'duration').not.toBeVisible();
        await expect(page.locator('#boundHide'), 'boundary').not.toBeVisible();
    });

    test('selecting CSE hides substance, duration and boundary sections @quick', async ({ page }) => {
        await page.goto('/');
        await page.locator('label[for="cse"]').click();
        await expect(page.locator('#subHide'),   'substance').not.toBeVisible();
        await expect(page.locator('#durHide'),   'duration').not.toBeVisible();
        await expect(page.locator('#boundHide'), 'boundary').not.toBeVisible();
    });

    test('switching from BoC to Motion re-hides BoC-specific fields @quick', async ({ page }) => {
        await page.goto('/');
        await page.locator('label[for="boc"]').click();
        await expect(page.locator('#subHide'), 'sub visible after boc').toBeVisible();
        await page.locator('label[for="motion"]').click();
        await expect(page.locator('#subHide'), 'sub hidden after motion').not.toBeVisible();
    });

    test('after clicking Next for BoC — line-spec panel and calcBtn appear @quick', async ({ page }) => {
        await page.goto('/');
        await page.fill('#isoTitle', 'Vis test');
        await page.locator('label[for="boc"]').click();
        await page.locator('label[for="flammable"]').click();
        await page.selectOption('#period', 'oneOrLess');
        await page.click('#nextBtn');

        await expect(page.locator('#lineSpecificationDiv'), 'line spec panel').toBeVisible();
        await expect(page.locator('#calcBtn'),              'calcBtn').toBeVisible();
        await expect(page.locator('#lineHide'),             'lineDesc field').toBeVisible();
        await expect(page.locator('#pipeHide'),             'pipeSize field').toBeVisible();
        await expect(page.locator('#pressHide'),            'pressure field').toBeVisible();
    });

    test('after clicking Next for Motion — line desc, pipe and pressure fields are hidden @quick', async ({ page }) => {
        await page.goto('/');
        await page.fill('#isoTitle', 'Vis test');
        await page.locator('label[for="motion"]').click();
        await page.click('#nextBtn');

        await expect(page.locator('#lineSpecificationDiv'), 'line spec panel').toBeVisible();
        await expect(page.locator('#calcBtn'),              'calcBtn').toBeVisible();
        await expect(page.locator('#lineHide'),  'lineDesc field').not.toBeVisible();
        await expect(page.locator('#pipeHide'),  'pipeSize field').not.toBeVisible();
        await expect(page.locator('#pressHide'), 'pressure field').not.toBeVisible();
    });

    test('after clicking Next for CSE — line desc, pipe and pressure fields are hidden @quick', async ({ page }) => {
        await page.goto('/');
        await page.fill('#isoTitle', 'Vis test');
        await page.locator('label[for="cse"]').click();
        await page.click('#nextBtn');

        await expect(page.locator('#lineHide'),  'lineDesc field').not.toBeVisible();
        await expect(page.locator('#pipeHide'),  'pipeSize field').not.toBeVisible();
        await expect(page.locator('#pressHide'), 'pressure field').not.toBeVisible();
    });

    test('SBT — pipe size field is visible but pre-filled to 0.5 after Next @quick', async ({ page }) => {
        await page.goto('/');
        await page.fill('#isoTitle', 'SBT vis test');
        await page.locator('label[for="sbt"]').click();
        await page.locator('label[for="flammable"]').click();
        await page.selectOption('#period', 'oneOrLess');
        await page.click('#nextBtn');

        await expect(page.locator('#pipeHide'), 'pipeSize visible').toBeVisible();
        const pipeVal = await page.locator('#pipeSizeNum').inputValue();
        expect(pipeVal, 'pipe pre-filled to 0.5').toBe('0.5');
    });

    test('boundary checkbox triggers pressure to 0 after Next @quick', async ({ page }) => {
        await page.goto('/');
        await page.fill('#isoTitle', 'Boundary vis test');
        await page.locator('label[for="boc"]').click();
        await page.locator('label[for="flammable"]').click();
        await page.selectOption('#period', 'oneOrLess');
        await page.check('#boundary');
        await page.click('#nextBtn');
        await page.locator('#calcBtn').waitFor({ state: 'visible' });

        const pressureVal = await page.locator('#pressure').inputValue();
        expect(pressureVal, 'pressure auto-set to 0').toBe('0');
    });

    test('output card is hidden on initial load and input section is visible @quick', async ({ page }) => {
        await page.goto('/');
        await expect(page.locator('#outCard'),      'outCard initially hidden').not.toBeVisible();
        await expect(page.locator('#inputSection'), 'inputSection initially shown').toBeVisible();
        await expect(page.locator('#backBtn'),      'backBtn initially hidden').not.toBeVisible();
        await expect(page.locator('#printBtn'),     'printBtn initially hidden').not.toBeVisible();
    });
});
