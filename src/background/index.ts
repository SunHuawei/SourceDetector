import { SourceDetectorDB } from '@/storage/database';
import { AppSettings, PageData, ResolvedPageContext } from '@/types';
import { getActiveRules } from '@/storage/rules';
import { isExtensionPage } from '@/utils/isExtensionPage';
import { scanCode } from '@/utils/leakScanner';
import { parseCrxFile } from '@/utils/parseCrxFile';
import { SourceMapConsumer } from 'source-map-js';
import { MESSAGE_TYPES } from './constants';
import { createHash } from './utils';
import { browserAPI } from '@/utils/browser-polyfill';
import {
    extractSourceMapUrlFromContent,
    getFileTypeFromUrl,
    isPageUrlCandidate,
    normalizePageUrl,
    pickResolvedPageContext
} from './pageContext';

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
let currentPage: { url: string; title: string; tabId?: number } | null = null;

async function setBadgeState(text: string, options?: { color?: string; tabId?: number }) {
    const actionDetails = typeof options?.tabId === 'number' ? { tabId: options.tabId } : {};
    await browserAPI.action.setBadgeText({ text, ...actionDetails });
    if (text && options?.color) {
        await browserAPI.action.setBadgeBackgroundColor({ color: options.color, ...actionDetails });
    }
}

// Function to update badge
async function updateBadge(url: string, isCrx: boolean = false, tabId?: number) {
    try {
        const normalizedUrl = normalizePageUrl(url);
        if (!normalizedUrl) {
            await setBadgeState('', { tabId });
            return;
        }

        if (isCrx) {
            const crxFile = await db.getCrxFileByPageUrl(normalizedUrl);
            if (crxFile) {
                await setBadgeState(String(crxFile.count), { color: '#4CAF50', tabId });
            } else {
                await setBadgeState('', { tabId });
            }
        } else {
            const files = await db.getPageFiles(normalizedUrl);
            const latestFiles = files.filter(file => file.isLatest);
            const hasLeakFindings = files.some((file) => (file.findings?.length ?? 0) > 0);

            if (latestFiles.length > 0) {
                await setBadgeState(String(latestFiles.length), {
                    color: hasLeakFindings ? '#F44336' : '#4CAF50',
                    tabId
                });
            } else {
                await setBadgeState('', { tabId });
            }
        }
    } catch (error) {
        console.error('Error updating badge:', error);
        await setBadgeState('', { tabId });
    }
}

// Function to update current page information
async function updateCurrentPage() {
    try {
        const [tab] = await browserAPI.tabs.query({ active: true, currentWindow: true });
        if (tab?.url && tab?.title && !isExtensionPage(tab.url)) {
            const normalizedUrl = normalizePageUrl(tab.url);
            currentPage = {
                url: normalizedUrl,
                title: tab.title,
                tabId: tab.id
            };
            await updateBadge(normalizedUrl, false, tab.id);
        }
    } catch (error) {
        console.error('Error updating current page:', error);
    }
}

// Monitor tab updates
browserAPI.tabs.onUpdated.addListener(async (_tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete' && tab.url) {
        if (isExtensionPage(tab.url)) {
            await updateCrxPage(tab);
        } else {
            await updateCurrentPage();
        }
    }
});
async function onTabActivated() {
    const [activeTab] = await browserAPI.tabs.query({ active: true, currentWindow: true });
    if (isExtensionPage(activeTab?.url || '')) {
        await updateCrxPage(activeTab);
    } else {
        await updateCurrentPage();
    }
}

// Monitor tab activation
browserAPI.tabs.onActivated.addListener(onTabActivated);

// Monitor window focus
browserAPI.windows.onFocusChanged.addListener(onTabActivated);

async function updateCrxPage(tab: browserAPI.tabs.Tab) {
    const url = tab.url;
    if (!url) return;
    const normalizedUrl = normalizePageUrl(url);
    await updateBadge(normalizedUrl, true, tab.id);
    const crxUrl = await getCrxUrl(normalizedUrl);
    if (crxUrl) {
        // check if the file exists
        let crxFile = await db.getCrxFileByPageUrl(normalizedUrl);
        if (!crxFile) {
            // Create empty content hash for new file
            const emptyBlob = new Blob();

            // save to db
            crxFile = await db.addCrxFile({
                pageUrl: normalizedUrl,
                pageTitle: tab.title || '',
                crxUrl: crxUrl,
                blob: emptyBlob,
                size: 0,
                timestamp: Date.now(),
                count: 0,
                contentHash: ''
            });
        }

        const result = await parseCrxFile(crxUrl);
        console.log('result', result);
        if (result && result.count > 0) {
            // Create content hash from blob
            const arrayBuffer = await result.blob.arrayBuffer();
            const uint8Array = new Uint8Array(arrayBuffer);
            const contentHash = await createHash('SHA-256')
                .update(Array.from(uint8Array).map(b => String.fromCharCode(b)).join(''))
                .digest('hex');

            await db.updateCrxFile({
                id: crxFile.id,
                pageUrl: normalizedUrl,
                pageTitle: tab.title || '',
                crxUrl: crxUrl,
                blob: result.blob,
                size: result.blob.size,
                count: result.count,
                timestamp: Date.now(),
                contentHash,
            });
            console.log('updateCrxFile', crxFile);
            // update badge
            await updateBadge(normalizedUrl, true, tab.id);
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

async function getLeakFindingsFromSourceMap(content: string, originalContent: string) {
    try {
        const activeRules = await getActiveRules();
        if (activeRules.length === 0) {
            return [];
        }

        const rawSourceMap = JSON.parse(content);
        const consumer = new SourceMapConsumer(rawSourceMap);
        const processedSources = new Set<string>();
        const sourceSegments: string[] = [originalContent];

        consumer.sources.forEach((sourcePath) => {
            if (processedSources.has(sourcePath)) {
                return;
            }
            processedSources.add(sourcePath);

            const sourceContent = consumer.sourceContentFor(sourcePath, true);
            if (sourceContent) {
                sourceSegments.push(sourceContent);
            }
        });

        return scanCode(sourceSegments.join('\n'), activeRules);
    } catch (error) {
        console.error('Error scanning source map content:', error);
        return [];
    }
}

interface RequestPageContextDetails {
    tabId?: number;
    initiator?: string;
    documentUrl?: string;
}

async function resolveRequestPageContext(details: RequestPageContextDetails): Promise<ResolvedPageContext | null> {
    let tabContext: ResolvedPageContext | null = null;

    if (typeof details.tabId === 'number' && details.tabId >= 0) {
        try {
            const tab = await browserAPI.tabs.get(details.tabId);
            if (tab?.url && isPageUrlCandidate(tab.url)) {
                tabContext = {
                    pageUrl: tab.url,
                    pageTitle: tab.title || currentPage?.title || '',
                    tabId: tab.id
                };
            }
        } catch (error) {
            console.debug('Unable to resolve tab context for source map detection:', error);
        }
    }

    return pickResolvedPageContext(
        tabContext,
        typeof details.documentUrl === 'string'
            ? { pageUrl: details.documentUrl, pageTitle: currentPage?.title || '' }
            : null,
        typeof details.initiator === 'string'
            ? { pageUrl: details.initiator, pageTitle: currentPage?.title || '' }
            : null
    );
}

// Listen for requests to detect JS/CSS files
browserAPI.webRequest.onCompleted.addListener(
    (details) => {
        if (isExtensionPage(details.url)) {
            return;
        }

        if (!/\.(js|css)([\?#].*)?$/i.test(details.url)) {
            return;
        }

        // Process asynchronously
        (async () => {
            try {
                // Get content from cache or fetch
                const content = await getFileContent(details.url);

                const mapUrl = extractSourceMapUrlFromContent(content);
                if (!mapUrl) {
                    return;
                }

                const fullMapUrl = mapUrl.startsWith('http')
                    ? mapUrl
                    : new URL(mapUrl, details.url).toString();

                const pageContext = await resolveRequestPageContext({
                    tabId: details.tabId,
                    initiator: (details as { initiator?: string }).initiator,
                    documentUrl: (details as { documentUrl?: string }).documentUrl
                });

                if (!pageContext?.pageUrl) {
                    return;
                }

                await handleSourceMapFound({
                    pageTitle: pageContext.pageTitle,
                    pageUrl: pageContext.pageUrl,
                    sourceUrl: details.url,
                    mapUrl: fullMapUrl,
                    fileType: getFileTypeFromUrl(details.url),
                    originalContent: content,
                    tabId: pageContext.tabId
                });
            } catch (error) {
                console.error('Error processing response:', error);
            }
        })();
    },
    { urls: ['<all_urls>'] }
);

// 监听消息
browserAPI.runtime.onMessage.addListener((message, _sender, sendResponse) => {
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
        const normalizedUrl = normalizePageUrl(data.url);
        const files = await db.getPageFiles(normalizedUrl);
        const pageData: PageData = {
            url: normalizedUrl,
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

// Task queue implementation
class TaskQueue {
    private queue: Map<string, Promise<any>> = new Map();

    async enqueue<T>(key: string, task: () => Promise<T>): Promise<T> {
        const currentTask = this.queue.get(key) || Promise.resolve();
        try {
            // Create a new task that waits for the current task to complete
            const newTask = currentTask.then(task, task);

            // Update the queue with the new task
            this.queue.set(key, newTask);

            // Wait for the task to complete and return its result
            const result = await newTask;

            // Clean up if this was the last task in the queue
            if (this.queue.get(key) === newTask) {
                this.queue.delete(key);
            }

            return result;
        } catch (error) {
            // Clean up on error
            if (this.queue.get(key) === currentTask) {
                this.queue.delete(key);
            }
            throw error;
        }
    }
}

const taskQueue = new TaskQueue();

// Function to handle source map found
async function handleSourceMapFound(data: { pageTitle: string; pageUrl: string; sourceUrl: string; mapUrl: string; fileType: 'js' | 'css'; originalContent: string; tabId?: number }): Promise<{ success: boolean; reason?: string }> {
    return taskQueue.enqueue('sourceMap', async () => {
        try {
            const normalizedPageUrl = normalizePageUrl(data.pageUrl);
            if (!normalizedPageUrl) {
                return { success: false, reason: 'Missing page url context' };
            }

            // Fetch content
            const content = await fetchSourceMapContent(data.sourceUrl, data.mapUrl);
            if (!content) return { success: false, reason: 'Failed to fetch content' };
            const findings = await getLeakFindingsFromSourceMap(content.content, content.originalContent);

            // Check existing file
            const existingFile = await db.sourceMapFiles.where('url').equals(data.sourceUrl).first();

            // Check if content unchanged
            if (existingFile && existingFile.hash === content.hash) {
                if (JSON.stringify(existingFile.findings ?? []) !== JSON.stringify(findings)) {
                    await db.sourceMapFiles.update(existingFile.id, { findings });
                }
                // Even if content is unchanged, we still need to associate it with the current page
                await db.addSourceMapToPage(normalizedPageUrl, data.pageTitle, existingFile);
                await updateBadge(normalizedPageUrl, false, data.tabId);
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
                url: data.sourceUrl,
                sourceMapUrl: data.mapUrl,
                content: content.content,
                originalContent: content.originalContent,
                fileType: data.fileType,
                size: content.size,
                timestamp: Date.now(),
                version: latestVersion + 1,
                hash: content.hash,
                isLatest: true,
                findings
            };

            // Store source map
            const savedSourceMapFile = await db.addSourceMapFile(sourceMapFile);

            // Associate with page
            await db.addSourceMapToPage(normalizedPageUrl, data.pageTitle, savedSourceMapFile);

            checkAndCleanStorage();
            // Update badge after storing new source map
            await updateBadge(normalizedPageUrl, false, data.tabId);

            return { success: true };
        } catch (error) {
            console.error('Error handling source map:', error);
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
async function checkAndCleanStorage() {
    try {
        const settings = await db.getSettings();
        const stats = await db.getStorageStats();
        if (stats.totalSize > settings.cleanupThreshold * 1024 * 1024) {
            // Delete oldest files first
            await db.sourceMapFiles
                .orderBy('timestamp')
                .limit(100)
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

        const platformInfo = await browserAPI.runtime.getPlatformInfo();
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