import { test, expect } from '@playwright/test';

test('page loads and shows the title', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle('Isolation Selector Tool');
    await expect(page.locator('h1')).toContainText('Isolation Selector Tool');
});
