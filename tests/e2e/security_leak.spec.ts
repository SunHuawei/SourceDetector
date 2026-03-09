import { test as base, chromium, expect, type BrowserContext, type Page, type Worker } from '@playwright/test';
import { existsSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const EXTENSION_PATH = path.resolve(process.cwd(), 'dist/chrome');
const EXTENSION_MANIFEST_PATH = path.resolve(EXTENSION_PATH, 'manifest.json');
const MOCK_SITE_URL = 'http://127.0.0.1:4173/index.html';
const MOCK_SOURCE_MAP_URL = 'http://127.0.0.1:4173/app.bundle.js.map';
const BADGE_RED_RGB = [244, 67, 54];

interface LeakDetectionState {
    badgeText: string;
    badgeColor: number[];
    fileCount: number;
    findingCount: number;
    fileNames: string[];
    activeTabUrl: string;
    findingsByFile: Array<{ sourceUrl: string; findings: number }>;
}

type ExtensionFixtures = {
    context: BrowserContext;
    serviceWorker: Worker;
};

const test = base.extend<ExtensionFixtures>({
    context: async ({}, use) => {
        if (!existsSync(EXTENSION_MANIFEST_PATH)) {
            throw new Error(`Expected extension build at ${EXTENSION_MANIFEST_PATH}`);
        }

        const userDataDir = await mkdtemp(path.join(os.tmpdir(), 'source-detector-e2e-'));
        const context = await chromium.launchPersistentContext(userDataDir, {
            channel: 'chromium',
            headless: true,
            args: [
                '--headless=new',
                `--disable-extensions-except=${EXTENSION_PATH}`,
                `--load-extension=${EXTENSION_PATH}`
            ]
        });

        try {
            await use(context);
        } finally {
            await context.close();
            await rm(userDataDir, { recursive: true, force: true });
        }
    },
    serviceWorker: async ({ context }, use) => {
        let serviceWorker = context.serviceWorkers()[0];
        if (!serviceWorker) {
            serviceWorker = await context.waitForEvent('serviceworker');
        }
        await use(serviceWorker);
    }
});

test('detects security leak and shows OpenAI warning in popup', async ({ context, serviceWorker }) => {
    const sitePage = await context.newPage();
    await sitePage.goto(MOCK_SITE_URL);
    await expect(sitePage.getByRole('heading', { name: 'SourceDetector Mock Site' })).toBeVisible();
 await sitePage.waitForTimeout(3000); // Wait for background script to intercept JS files

    const sourceMapResponse = await sitePage.request.get(MOCK_SOURCE_MAP_URL);
    expect(sourceMapResponse.ok()).toBeTruthy();
    const sourceMapBody = await sourceMapResponse.json() as { file?: string; sources?: unknown };
    expect(sourceMapBody.file).toBe('app.bundle.js');
    expect(Array.isArray(sourceMapBody.sources)).toBe(true);

    let detectionState: LeakDetectionState | null = null;
    let pollAttempt = 0;

    await expect
        .poll(
            async () => {
                pollAttempt += 1;
                detectionState = await serviceWorker.evaluate(async (): Promise<LeakDetectionState | null> => {
                    const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
                    if (!activeTab?.id || !activeTab.url) {
                        return null;
                    }

                    const badgeText = await new Promise<string>((resolve) => {
                        chrome.action.getBadgeText({ tabId: activeTab.id as number }, (text) => resolve(text ?? ''));
                    });

                    const badgeColor = await new Promise<number[]>((resolve) => {
                        chrome.action.getBadgeBackgroundColor({ tabId: activeTab.id as number }, (color) => {
                            resolve(Array.isArray(color) ? color.map((channel) => Number(channel)) : []);
                        });
                    });

                    const pageDataResponse = await new Promise<any>((resolve) => {
                        chrome.runtime.sendMessage(
                            {
                                type: 'GET_PAGE_DATA',
                                data: { url: activeTab.url }
                            },
                            (response) => resolve(response)
                        );
                    });

                    const files = Array.isArray(pageDataResponse?.data?.files) ? pageDataResponse.data.files : [];
                    const findingCount = files.reduce((total: number, file: any) => {
                        const fileFindings = Array.isArray(file?.findings) ? file.findings.length : 0;
                        return total + fileFindings;
                    }, 0);
                    const findingsByFile = files.map((file: any) => ({
                        sourceUrl: String(file?.url ?? ''),
                        findings: Array.isArray(file?.findings) ? file.findings.length : 0
                    }));
                    const fileNames = files.map((file: any) => {
                        const sourceUrl = String(file?.url ?? '');
                        const segments = sourceUrl.split('/');
                        return segments[segments.length - 1] || sourceUrl;
                    });

                    return {
                        badgeText,
                        badgeColor,
                        fileCount: files.length,
                        findingCount,
                        fileNames,
                        activeTabUrl: activeTab.url,
                        findingsByFile
                    };
                });

                console.log(`[security_leak][poll #${pollAttempt}] detectionState: ${JSON.stringify(detectionState)}`);

                return Boolean(
                    detectionState
                    && detectionState.badgeText === '1'
                    && detectionState.fileCount >= 1
                    && detectionState.findingCount > 0
                    && detectionState.fileNames.includes('app.bundle.js')
                );
            },
            {
                timeout: 30_000,
                intervals: [500, 1000, 1500]
            }
        )
        .toBe(true);

    expect(detectionState).not.toBeNull();
    expect(detectionState?.badgeColor.slice(0, 3)).toEqual(BADGE_RED_RGB);

    const extensionId = new URL(serviceWorker.url()).host;
    await sitePage.bringToFront();
    let popupPage: Page;

    try {
        const popupPromise = context.waitForEvent('page', { timeout: 5_000 });
        await serviceWorker.evaluate(async () => {
            await chrome.action.openPopup();
        });
        popupPage = await popupPromise;
    } catch {
        popupPage = await context.newPage();
        await popupPage.goto(`chrome-extension://${extensionId}/popup/index.html`);
        await sitePage.bringToFront();
        await popupPage.reload();
    }

    await popupPage.waitForLoadState('domcontentloaded');

    await expect(popupPage.getByRole('heading', { name: 'Source Maps' })).toBeVisible();

    const sourceFileRow = popupPage.locator('tr', { hasText: 'app.bundle.js' });
    await expect(sourceFileRow).toBeVisible();

    const warningIcon = sourceFileRow.getByLabel('Potential leak findings');
    await expect(warningIcon).toBeVisible();

    await warningIcon.hover();
    await expect(popupPage.getByRole('tooltip')).toContainText('OpenAI');
});
