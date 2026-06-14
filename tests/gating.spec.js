import { test, expect } from '@playwright/test';
import { fillStage1, readOutput } from './helpers.js';

test('major accident answer defers to shutdown', async ({ page }) => {
    await fillStage1(page, { title: 'High risk job', majorAccident: 'yes' });
    await page.locator('#outCard').waitFor({ state: 'visible' });

    const out = await readOutput(page);
    expect(out.title).toBe('High risk job');
    expect(out.outcome).toContain('major accident event');
    expect(out.outcome).toContain('shut down');
    expect(out.outImg).toContain('stop');

    // Comparison and controls are hidden for a shutdown record.
    await expect(page.locator('#comparisonSection')).toBeHidden();
    await expect(page.locator('#controlsFooter')).toBeHidden();
    await expect(page.locator('#printBtn')).toBeVisible();
});

test('practicable to wait for shutdown defers to shutdown', async ({ page }) => {
    await fillStage1(page, { title: 'Shutdown job', waitShutdown: 'yes' });
    await page.locator('#outCard').waitFor({ state: 'visible' });

    const out = await readOutput(page);
    expect(out.outcome).toContain('reasonably practicable to wait for a shutdown');
    expect(out.outImg).toContain('stop');
});

test('answering Yes hides the rest of the form and shows a notice', async ({ page }) => {
    await page.goto('/');
    await page.fill('#isoTitle', 'Job');
    await page.check('#majorAccidentYes');
    await expect(page.locator('#gatingNotice')).toBeVisible();
    await expect(page.locator('#restBlock')).toBeHidden();
    await expect(page.locator('#nextBtn')).toBeVisible();
});
