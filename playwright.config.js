import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
    testDir: './tests',
    fullyParallel: true,
    workers: process.env.CI ? 2 : 4,
    retries: 0,
    timeout: 30_000,
    reporter: [['html', { open: 'never' }], ['line']],
    use: {
        baseURL: 'http://localhost:3000',
        trace: 'on-first-retry',
    },
    projects: [
        { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    ],
    webServer: {
        command: 'npx serve . --listen 3000',
        url: 'http://localhost:3000',
        reuseExistingServer: !process.env.CI,
    },
});
