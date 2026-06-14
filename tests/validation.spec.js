import { test, expect } from '@playwright/test';

// Title + both planning checks answered "No" → the rest of the form is revealed.
async function openRest(page, title = 'X') {
    await page.goto('/');
    await page.fill('#isoTitle', title);
    await page.check('#majorAccidentNo');
    await page.check('#waitShutdownNo');
    await page.locator('#restBlock').waitFor({ state: 'visible' });
}

async function expectAlert(page, re) {
    await expect(page.locator('#alertModal')).toBeVisible();
    await expect(page.locator('#alertModalBody')).toContainText(re);
}

async function dismissAlert(page) {
    await page.locator('#alertModal .modal-footer .btn-primary').click();
    await expect(page.locator('#alertModal')).toBeHidden();
}

test('Next is hidden until a title is entered', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#gatingBlock')).toBeHidden();
    await expect(page.locator('#nextBtn')).toBeHidden();

    await page.fill('#isoTitle', 'Job');
    await expect(page.locator('#gatingBlock')).toBeVisible();
    await expect(page.locator('#nextBtn')).toBeHidden();
});

test('missing fluid is rejected with a modal', async ({ page }) => {
    await openRest(page);
    await page.click('#nextBtn');
    await expectAlert(page, /fluid/i);
});

test('missing operating temperature is rejected', async ({ page }) => {
    await openRest(page);
    await page.selectOption('#fluidSelect', { label: 'Diesel' });
    await page.click('#nextBtn');
    await expectAlert(page, /temperature/i);
});

test('missing duration is rejected', async ({ page }) => {
    await openRest(page);
    await page.selectOption('#fluidSelect', { label: 'Diesel' });
    await page.fill('#operatingTemp', '20');
    await page.click('#nextBtn');
    await expectAlert(page, /how long|duration/i);
});

test('stage 2 requires line description and isolation selection', async ({ page }) => {
    await openRest(page);
    await page.selectOption('#fluidSelect', { label: 'Diesel' });
    await page.fill('#operatingTemp', '20');
    await page.selectOption('#period', 'oneOrLess');
    await page.click('#nextBtn');
    await page.locator('#calcBtn').waitFor({ state: 'visible' });

    // No line description.
    await page.click('#calcBtn');
    await expectAlert(page, /description/i);
    await dismissAlert(page);

    // Description but no isolation selected.
    await page.fill('#lineDesc', 'A line');
    await page.click('#calcBtn');
    await expectAlert(page, /isolation/i);
    await expect(page.locator('#outCard')).toBeHidden();
});

test('"Other" fluid requires a name', async ({ page }) => {
    await openRest(page);
    await page.selectOption('#fluidSelect', 'other');
    await page.fill('#operatingTemp', '20');
    await page.selectOption('#period', 'oneOrLess');
    await page.click('#nextBtn');
    await expectAlert(page, /fluid/i);
});
