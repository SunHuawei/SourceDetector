import { SourceDetectorDB } from '@/storage/database';
import { AppSettings, PageData } from '@/types';
import { tauriClient } from '@/utils/tauri-client';
import { FILE_TYPES, MESSAGE_TYPES } from './constants';
import { createHash } from './utils';
import { parseCrxFile, parsedCrxFileFromCrxFile } from '@/utils/parseCrxFile';
import { isExtensionPage } from '@/utils/isExtensionPage';

const db = new SourceDetectorDB();

// Simple in-memory cache with 5s expiration
const CACHE_EXPIRATION = 5000; // 5 seconds
const cache = new Map<string, { content: string; timestamp: number }>();

// Function to get content from cache or fetch
async function getFileContent(url: string): Promise<string> {
    try {
        const now = Date.now();
        const cached = cache.get(url);

        // Return cached content if it exists and hasn't expired
        if (cached && (now - cached.timestamp) < CACHE_EXPIRATION) {
            return cached.content;
        }

        // Fetch fresh content
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Failed to fetch ${url}: ${response.status}`);
        }
        const content = await response.text();

        // Update cache
        cache.set(url, { content, timestamp: now });

        // Clean old entries periodically
        if (cache.size > 100) { // Prevent memory leaks
            for (const [key, value] of cache.entries()) {
                if (now - value.timestamp > CACHE_EXPIRATION) {
                    cache.delete(key);
                }
            }
        }

        return content;
    } catch (error) {
        console.error('Error getting file content:', error);
        throw error;
    }
}

// Store current page information
let currentPage: { url: string; title: string } | null = null;

// Function to update badge
async function updateBadge(url: string, isCrx: boolean = false) {
    try {
        if (isCrx) {
            const crxFile = await db.getCrxFileByPageUrl(url);
            if (crxFile) {
                console.log('updateBadge', url, crxFile.count)
                await chrome.action.setBadgeText({ text: String(crxFile.count) });
                await chrome.action.setBadgeBackgroundColor({ color: '#4CAF50' });
            } else {
                console.log('updateBadge', url, 0)
                await chrome.action.setBadgeText({ text: '' });
            }
        } else {
            // Get source maps for current page using the new schema
            const files = await db.getPageFiles(url);
            const latestFiles = files.filter(file => file.isLatest);

            // Update badge text and color
            if (latestFiles.length > 0) {
                console.log('updateBadge', url, latestFiles.length)
                await chrome.action.setBadgeText({ text: String(latestFiles.length) });
                await chrome.action.setBadgeBackgroundColor({ color: '#4CAF50' }); // Green color
            } else {
                console.log('updateBadge', url, 0)
                await chrome.action.setBadgeText({ text: '' });
            }
        }
    } catch (error) {
        console.error('Error updating badge:', error);
        await chrome.action.setBadgeText({ text: '' });
    }
}

// Function to update current page information
async function updateCurrentPage() {
    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab?.url && tab?.title && !isExtensionPage(tab.url)) {
            currentPage = {
                url: tab.url,
                title: tab.title
            };
            // Update badge when page changes
            await updateBadge(tab.url);
        }
    } catch (error) {
        console.error('Error updating current page:', error);
    }
}

// Monitor tab updates
chrome.tabs.onUpdated.addListener(async (_tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete' && tab.url) {
        console.log('tab.url', tab.url, isExtensionPage(tab.url))
        if (isExtensionPage(tab.url)) {
            await updateCrxPage(tab);
        } else {
            await updateCurrentPage();
        }
    }
});
async function onTabActivated() {
    const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (isExtensionPage(activeTab?.url || '')) {
        await updateCrxPage(activeTab);
    } else {
        await updateCurrentPage();
    }
}

// Monitor tab activation
chrome.tabs.onActivated.addListener(onTabActivated);

// Monitor window focus
chrome.windows.onFocusChanged.addListener(onTabActivated);

async function updateCrxPage(tab: chrome.tabs.Tab) {
    const url = tab.url;
    if (!url) return;
    await updateBadge(url, true);
    const crxUrl = await getCrxUrl(url);
    if (crxUrl) {
        // check if the file exists
        let crxFile = await db.getCrxFileByPageUrl(url);
        if (!crxFile) {
            // save to db
            crxFile = await db.addCrxFile({
                pageUrl: url,
                pageTitle: tab.title || '',
                crxUrl: crxUrl,
                blob: new Blob(),
                size: 0,
                timestamp: Date.now(),
                count: 0
            });
        }

        const result = await parseCrxFile(crxUrl);
        console.log('result', result);
        if (result && result.count > 0) {
            await db.updateCrxFile({
                id: crxFile.id,
                pageUrl: url,
                pageTitle: tab.title || '',
                crxUrl: crxUrl,
                blob: result.blob,
                size: result.blob.size,
                count: result.count,
                timestamp: Date.now(),
            });
            console.log('updateCrxFile', crxFile);
            // update badge
            await updateBadge(url, true);
        }
    }
}

// Modify fetchSourceMapContent to use cache
async function fetchSourceMapContent(sourceUrl: string, mapUrl: string): Promise<{
    content: string;
    originalContent: string;
    size: number;
    hash: string;
} | null> {
    try {
        // Get both files using the caching function
        const content = await getFileContent(mapUrl);
        const originalContent = await getFileContent(sourceUrl);

        // Calculate size and hash
        const size = new Blob([content]).size + new Blob([originalContent]).size;
        const hash = await createHash('SHA-256')
            .update(content + originalContent)
            .digest('hex');

        return { content, originalContent, size, hash };
    } catch (error) {
        console.error('Error fetching source map content:', error);
        return null;
    }
}

// Listen for requests to detect JS/CSS files
chrome.webRequest.onCompleted.addListener(
    (details) => {
        if (isExtensionPage(details.url)) {
            return;
        }

        console.log('details', details.initiator)
        if (!/\.(js|css)(\?.*)?$/.test(details.url)) {
            return;
        }

        // Process asynchronously
        (async () => {
            try {
                // Get content from cache or fetch
                const content = await getFileContent(details.url);

                // Check for source map in the last line
                // lastLine is like this:
                // /*# sourceMappingURL=https://example.com/path/to/map.css.map */
                // or
                // //# sourceMappingURL=https://example.com/path/to/map.css.map
                const lastLine = content.split('\n').pop()?.trim() || '';
                const sourceMapMatch = lastLine.match(/#\s*sourceMappingURL=([^\s\*]+)/);

                if (sourceMapMatch) {
                    const mapUrl = sourceMapMatch[1];
                    const fullMapUrl = mapUrl.startsWith('http')
                        ? mapUrl
                        : new URL(mapUrl, details.url).toString();

                    await handleSourceMapFound({
                        pageTitle: currentPage?.title || '',
                        pageUrl: currentPage?.url || '',
                        sourceUrl: details.url,
                        mapUrl: fullMapUrl,
                        fileType: details.url.endsWith('.css') ? 'css' : 'js',
                        originalContent: content
                    });
                }
            } catch (error) {
                console.error('Error processing response:', error);
            }
        })();
    },
    { urls: ['<all_urls>'] }
);

// 监听消息
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    const handleMessage = async () => {
        try {
            switch (message.type) {
                case MESSAGE_TYPES.FOUND_SOURCE_MAP:
                    return await handleSourceMapFound(message.data);
                case MESSAGE_TYPES.GET_SOURCEMAP:
                    return await handleGetSourceMap(message.data);
                case MESSAGE_TYPES.DELETE_SOURCEMAP:
                    return await handleDeleteSourceMap(message.data);
                case MESSAGE_TYPES.GET_STORAGE_STATS:
                    return await handleGetStorageStats();
                case MESSAGE_TYPES.GET_SETTINGS:
                    return await handleGetSettings();
                case MESSAGE_TYPES.UPDATE_SETTINGS:
                    return await handleUpdateSettings(message.data);
                case MESSAGE_TYPES.CLEAR_HISTORY:
                    return await handleClearHistory();
                case MESSAGE_TYPES.GET_FILE_DATA:
                    return await handleGetFileData(message.data);
                case MESSAGE_TYPES.GET_PAGE_DATA:
                    return await handleGetPageData(message.data);
                case MESSAGE_TYPES.GET_ALL_SOURCE_MAPS:
                    return await handleGetAllSourceMaps();
                case MESSAGE_TYPES.CLEAR_DATA:
                    return await handleClearData();
                case MESSAGE_TYPES.GET_CRX_FILE:
                    return await handleGetCrxFile(message.data);
                default:
                    return { success: false, reason: 'Unknown message type' };
            }
        } catch (error) {
            console.error('Error handling message:', error);
            return { success: false, reason: String(error) };
        }
    };

    handleMessage().then(sendResponse);
    return true;
});

async function handleGetCrxFile(data: { url: string }) {
    try {
        const crxFile = await db.getCrxFileByPageUrl(data.url);
        if (!crxFile) return { success: false, reason: 'CRX file not found' };

        return { success: true, data: crxFile };
    } catch (error) {
        console.error('Error getting CRX file:', error);
        return { success: false, reason: String(error) };
    }
}

async function handleClearData() {
    try {
        await db.sourceMapFiles.clear();
        return { success: true };
    } catch (error) {
        console.error('Error clearing data:', error);
        return { success: false, reason: String(error) };
    }
}

async function handleGetPageData(data: { url: string }) {
    try {
        const files = await db.getPageFiles(data.url);
        const pageData: PageData = {
            url: data.url,
            title: currentPage?.title || '',
            timestamp: Date.now(),
            files: files
        };
        return { success: true, data: pageData };
    } catch (error) {
        console.error('Error getting page data:', error);
        return { success: false, reason: String(error) };
    }
}

async function handleGetFileData(data: { url: string }) {
    try {
        const file = await db.sourceMapFiles.where('url').equals(data.url).first();
        return { success: true, data: file };
    } catch (error) {
        console.error('Error getting file data:', error);
        return { success: false, reason: String(error) };
    }
}

// Main handler for source map discovery
async function handleSourceMapFound(data: { pageTitle: string; pageUrl: string; sourceUrl: string; mapUrl: string; fileType: 'js' | 'css'; originalContent: string }) {
    try {
        const settings = await db.getSettings();
        let desktopResult = false;
        let indexedDBResult = false;

        // Process with desktop app if enabled
        if (settings.enableDesktopApp) {
            desktopResult = await handleSourceMapFoundWithDesktop(data);
        }

        // Always process with IndexedDB
        const indexedDBResponse = await handleSourceMapFoundWithIndexedDB(data);
        indexedDBResult = indexedDBResponse.success;

        return {
            success: settings.enableDesktopApp ? (desktopResult || indexedDBResult) : indexedDBResult,
            reason: settings.enableDesktopApp && !desktopResult && !indexedDBResult
                ? 'Failed to store in both destinations'
                : !indexedDBResult
                    ? indexedDBResponse.reason || 'Failed to store in IndexedDB'
                    : undefined
        };
    } catch (error) {
        console.error('Error handling source map:', error);
        return { success: false, reason: String(error) };
    }
}

// Handle storing source map in desktop app
async function handleSourceMapFoundWithDesktop(data: { pageTitle: string; pageUrl: string; sourceUrl: string; mapUrl: string; fileType: 'js' | 'css'; originalContent: string }) {
    try {
        const content = await fetchSourceMapContent(data.sourceUrl, data.mapUrl);
        if (!content) return false;

        const sourceMap = {
            url: data.sourceUrl,
            source_map_url: data.mapUrl,
            content: content.content,
            original_content: content.originalContent,
            file_type: data.fileType,
            size: content.size,
            hash: content.hash,
        };

        // Send to Tauri app
        return await tauriClient.sendSourceMap(
            data.pageUrl,
            data.pageTitle,
            sourceMap
        );
    } catch (error) {
        console.error('Error processing source map for desktop:', error);
        return false;
    }
}

// Lock mechanism
class DatabaseLock {
    private locks: Map<string, Promise<void>> = new Map();
    private readonly timeout: number;

    constructor(timeoutMs: number = 10000) { // Default 10s timeout
        this.timeout = timeoutMs;
    }

    private createTimeoutPromise(): Promise<void> {
        return new Promise((_, reject) => {
            setTimeout(() => {
                reject(new Error('Lock acquisition timeout'));
            }, this.timeout);
        });
    }

    async acquireLock(key: string): Promise<() => void> {
        let releaseLock: () => void;
        const newLockPromise = new Promise<void>(resolve => {
            releaseLock = () => {
                this.locks.delete(key);
                resolve();
            };
        });

        const currentLock = this.locks.get(key);
        if (currentLock) {
            try {
                await Promise.race([currentLock, this.createTimeoutPromise()]);
            } catch (error) {
                console.error('Error waiting for lock:', error);
                this.locks.delete(key);
                throw error;
            }
        }

        this.locks.set(key, newLockPromise);
        return releaseLock!;
    }

    async withLock<T>(key: string, operation: () => Promise<T>): Promise<T> {
        let releaseLock: (() => void) | undefined;
        try {
            releaseLock = await this.acquireLock(key);
            return await operation();
        } finally {
            releaseLock?.();
        }
    }
}

const dbLock = new DatabaseLock();

// Handle storing source map in IndexedDB
async function handleSourceMapFoundWithIndexedDB(data: { pageTitle: string; pageUrl: string; sourceUrl: string; mapUrl: string; fileType: 'js' | 'css'; originalContent: string }) {
    return dbLock.withLock('sourceMap', async () => {
        try {
            const settings = await db.getSettings();

            // Check file type collection settings
            if (
                (data.fileType === FILE_TYPES.JS && !settings.collectJs) ||
                (data.fileType === FILE_TYPES.CSS && !settings.collectCss)
            ) {
                return { success: false, reason: 'File type not collected' };
            }

            const content = await fetchSourceMapContent(data.sourceUrl, data.mapUrl);
            if (!content) return { success: false, reason: 'Failed to fetch content' };

            // Check file size
            if (content.size > settings.maxFileSize * 1024 * 1024) {
                return { success: false, reason: 'File too large' };
            }

            // Check existing file
            const existingFile = await db.sourceMapFiles.where('url').equals(data.sourceUrl).first();

            // Check if content unchanged
            if (existingFile && existingFile.hash === content.hash) {
                // Even if content is unchanged, we still need to associate it with the current page
                await db.addSourceMapToPage(data.pageUrl, data.pageTitle, existingFile);
                return { success: true, reason: 'File content unchanged but added to page' };
            }

            // Update existing versions if they exist
            if (existingFile) {
                const existingFiles = await db.sourceMapFiles
                    .where('url')
                    .equals(data.sourceUrl)
                    .toArray();
                await Promise.all(
                    existingFiles.map(file =>
                        db.sourceMapFiles.update(file.id, { isLatest: false })
                    )
                );
            }

            // Get latest version number
            const latestVersion = existingFile ?
                (await db.sourceMapFiles
                    .where('url')
                    .equals(data.sourceUrl)
                    .toArray())
                    .reduce((max, file) => Math.max(max, file.version), 0) : 0;

            // Create new source map record
            const sourceMapFile = {
                id: content.hash,
                url: data.sourceUrl,
                sourceMapUrl: data.mapUrl,
                content: content.content,
                originalContent: content.originalContent,
                fileType: data.fileType,
                size: content.size,
                timestamp: Date.now(),
                version: latestVersion + 1,
                hash: content.hash,
                isLatest: true
            };

            // Store source map
            await db.sourceMapFiles.add(sourceMapFile);

            // Associate with page
            await db.addSourceMapToPage(data.pageUrl, data.pageTitle, sourceMapFile);

            // Check storage cleanup
            if (settings.autoCleanup) {
                await checkAndCleanStorage(settings);
            }

            // Update badge after storing new source map
            await updateBadge(data.pageUrl);

            return { success: true };
        } catch (error) {
            console.error('Error handling source map for IndexedDB:', error);
            return { success: false, reason: String(error) };
        }
    });
}

// 获取 sourcemap
async function handleGetSourceMap(data: { url: string }) {
    try {
        const file = await db.sourceMapFiles
            .where('url')
            .equals(data.url)
            .first();

        return { success: true, data: file };
    } catch (error) {
        console.error('Error getting sourcemap:', error);
        return { success: false, reason: String(error) };
    }
}

// 删除 sourcemap
async function handleDeleteSourceMap(data: { url: string }) {
    try {
        await db.sourceMapFiles
            .where('url')
            .equals(data.url)
            .delete();

        return { success: true };
    } catch (error) {
        console.error('Error deleting sourcemap:', error);
        return { success: false, reason: String(error) };
    }
}

// 获取存储统计信息
async function handleGetStorageStats() {
    try {
        const stats = await db.getStorageStats();
        return { success: true, data: stats };
    } catch (error) {
        console.error('Error getting storage stats:', error);
        return { success: false, reason: String(error) };
    }
}

// 获取设置
async function handleGetSettings() {
    try {
        const settings = await db.getSettings();
        return { success: true, data: settings };
    } catch (error) {
        console.error('Error getting settings:', error);
        return { success: false, reason: String(error) };
    }
}

// 更新设置
async function handleUpdateSettings(settings: Partial<AppSettings>) {
    try {
        await db.updateSettings(settings);
        return { success: true };
    } catch (error) {
        console.error('Error updating settings:', error);
        return { success: false, reason: String(error) };
    }
}

// 清空史记
async function handleClearHistory() {
    try {
        await Promise.all([
            db.sourceMapFiles.clear(),
            db.pages.clear(),
            db.pageSourceMaps.clear()
        ]);
        return { success: true };
    } catch (error) {
        console.error('Error clearing history:', error);
        return { success: false, reason: String(error) };
    }
}

// 检查并清理存储
async function checkAndCleanStorage(settings: AppSettings) {
    try {
        const stats = await db.getStorageStats();
        if (stats.totalSize > settings.cleanupThreshold * 1024 * 1024) {
            const cutoffDate = Date.now() - settings.retentionDays * 24 * 60 * 60 * 1000;
            await db.sourceMapFiles
                .where('timestamp')
                .below(cutoffDate)
                .delete();
        }
    } catch (error) {
        console.error('Error cleaning storage:', error);
    }
}

async function handleGetAllSourceMaps() {
    try {
        const files = await db.sourceMapFiles.toArray();
        return { success: true, data: files };
    } catch (error) {
        console.error('Error getting all source maps:', error);
        return { success: false, reason: String(error) };
    }
}

// Get CRX download URL from extension page
async function getCrxUrl(url: string): Promise<string | null> {
    try {
        // Extract extension ID from various URL patterns
        const cws_pattern = /^https?:\/\/(?:chrome.google.com\/webstore|chromewebstore.google.com)\/.+?\/([a-z]{32})(?=[\/#?]|$)/;
        const match = cws_pattern.exec(url);
        const extId = match?.[1] || url.split('/')[6]?.split('?')[0] || url.split('//')[1]?.split('/')[0];
        if (!extId || !/^[a-z]{32}$/.test(extId)) return null;

        const platformInfo = await chrome.runtime.getPlatformInfo();
        const version = navigator.userAgent.split("Chrome/")[1]?.split(" ")[0] || '9999.0.9999.0';

        // Construct URL with all necessary parameters
        let downloadUrl = 'https://clients2.google.com/service/update2/crx?response=redirect';
        downloadUrl += '&os=' + platformInfo.os;
        downloadUrl += '&arch=' + platformInfo.arch;
        downloadUrl += '&os_arch=' + platformInfo.arch;
        downloadUrl += '&nacl_arch=' + platformInfo.nacl_arch;
        // Use chromiumcrx as product ID since we're not Chrome
        downloadUrl += '&prod=chromiumcrx';
        downloadUrl += '&prodchannel=unknown';
        downloadUrl += '&prodversion=' + version;
        downloadUrl += '&acceptformat=crx2,crx3';
        downloadUrl += '&x=id%3D' + extId;
        downloadUrl += '%26uc';

        return downloadUrl;
    } catch (error) {
        console.error('Error getting CRX URL:', error);
        return null;
    }
}
