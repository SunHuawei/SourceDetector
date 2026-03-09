import { defineConfig } from '@playwright/test';

export default defineConfig({
    testDir: './tests/e2e',
    fullyParallel: false,
    workers: 1,
    timeout: 120_000,
    expect: {
        timeout: 15_000
    },
    globalSetup: './tests/e2e/global-setup.ts',
    webServer: {
        command: 'python3 -m http.server 4173 --bind 127.0.0.1 --directory tests/mock-site',
        url: 'http://127.0.0.1:4173/index.html',
        reuseExistingServer: !process.env.CI,
        timeout: 60_000
    },
    use: {
        channel: 'chromium',
        headless: true,
        launchOptions: {
            args: ['--headless=new']
        },
        trace: 'on-first-retry',
        screenshot: 'only-on-failure',
        video: 'retain-on-failure'
    }
});
