import { SourceDetectorDB } from '@/storage/database';
import { AppSettings, CrxFile, PageData } from '@/types';
import { isExtensionPage } from '@/utils/isExtensionPage';
import { parseCrxFile } from '@/utils/parseCrxFile';
import { MESSAGE_TYPES } from './constants';
import { createHash } from './utils';

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
            // Create empty content hash for new file
            const emptyBlob = new Blob();

            // save to db
            crxFile = await db.addCrxFile({
                pageUrl: url,
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
                pageUrl: url,
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
                case MESSAGE_TYPES.GET_SERVER_STATUS:
                    return { success: true, data: { isOnline: serverStatus } };
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
async function handleSourceMapFound(data: { pageTitle: string; pageUrl: string; sourceUrl: string; mapUrl: string; fileType: 'js' | 'css'; originalContent: string }): Promise<{ success: boolean; reason?: string }> {
    return taskQueue.enqueue('sourceMap', async () => {
        try {
            // Fetch content
            const content = await fetchSourceMapContent(data.sourceUrl, data.mapUrl);
            if (!content) return { success: false, reason: 'Failed to fetch content' };

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
            };

            // Store source map
            const savedSourceMapFile = await db.addSourceMapFile(sourceMapFile);

            // Associate with page
            await db.addSourceMapToPage(data.pageUrl, data.pageTitle, savedSourceMapFile);

            checkAndCleanStorage();
            // Update badge after storing new source map
            await updateBadge(data.pageUrl);

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

// Server configuration
const SERVER_CONFIG = {
    host: '127.0.0.1',
    port: '63798'
};

const SERVER_URL = `http://${SERVER_CONFIG.host}:${SERVER_CONFIG.port}`;
const HEARTBEAT_INTERVAL = 1000; // 1 second
const SYNC_CHECK_INTERVAL = 30 * 1000; // Check every 30 seconds

// Tables to sync
const TableChunkSizeMap = {
    crxFiles: 1,
    sourceMapFiles: 1,
    pages: 100,
    pageSourceMaps: 100
} as const;

let serverStatus = false;

// Function to check server health
async function checkServerHealth(): Promise<boolean> {
    try {
        const response = await fetch(`${SERVER_URL}/health`, {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
            }
        });
        const { status } = await response.json();
        return response.ok && status === 'ok';
    } catch (error) {
        console.error('Error checking server health:', error);
        return false;
    }
}

// Heartbeat function
async function checkServerStatus() {
    serverStatus = await checkServerHealth();

    // Broadcast status to all tabs
    chrome.runtime.sendMessage({
        type: MESSAGE_TYPES.SERVER_STATUS_CHANGED,
        data: { isOnline: serverStatus }
    }).catch(() => { }); // Ignore errors if no listeners
}

// Function to convert Blob to base64
async function blobToBase64(blob: Blob): Promise<string> {
    const arrayBuffer = await blob.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);

    // Process the array in chunks to avoid call stack size exceeded
    const chunkSize = 0x8000; // 32KB chunks
    let result = '';

    for (let i = 0; i < uint8Array.length; i += chunkSize) {
        const chunk = uint8Array.slice(i, i + chunkSize);
        result += String.fromCharCode.apply(null, Array.from(chunk));
    }

    return btoa(result);
}

// Function to sync data to server
async function syncDataToServer() {
    try {
        for (const table of Object.keys(TableChunkSizeMap)) {
            console.log('syncDataToServer', table);
            let lastId = await db.getLastSyncId(table);
            console.log('lastId', lastId);
            let modifiedData = await db.getModifiedData(table, lastId, TableChunkSizeMap[table as keyof typeof TableChunkSizeMap]);
            console.log('modifiedData', modifiedData);

            while (modifiedData.length > 0) {
                try {
                    let processedChunk = table === 'crxFiles'
                        ? await Promise.all(modifiedData.map(async (file) => {
                            const crxFile = file as CrxFile;
                            return {
                                ...crxFile,
                                blob: await blobToBase64(crxFile.blob)
                            };
                        }))
                        : modifiedData;

                    const response = await fetch(`${SERVER_URL}/sync`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            table,
                            lastId,
                            data: processedChunk
                        })
                    });

                    if (response.ok) {
                        const result = await response.json();

                        // Log failed records for debugging
                        if (result.failedRecords?.length > 0) {
                            console.log(`Failed records for ${table}:`, result.failedRecords);
                        }

                        // Update last synced ID to the last successful record's ID
                        if (result.lastSuccessId > lastId) {
                            lastId = result.lastSuccessId;
                            await db.updateLastSyncId(table, lastId);
                        }

                        console.log(`Synced ${modifiedData.length} records for ${table}`);
                    } else {
                        console.log(`Failed to sync chunk: ${response.statusText}`);
                        break;
                    }
                } catch (error) {
                    console.log('error', error);
                }

                modifiedData = await db.getModifiedData(table, lastId, TableChunkSizeMap[table as keyof typeof TableChunkSizeMap]);
                console.log('modifiedData2', modifiedData);
            }
        }

        console.log('Data sync completed successfully');
    } catch (error) {
        console.error('Error syncing data:', error);
    }
}

// Function to check server status and trigger sync
async function checkServerAndSync() {
    console.log('checkServerAndSync');
    if (await checkServerHealth()) {
        console.log('checkServerAndSync2');
        await syncDataToServer();
    }
}

// Start heartbeat and sync
setInterval(checkServerStatus, HEARTBEAT_INTERVAL);
setInterval(checkServerAndSync, SYNC_CHECK_INTERVAL);

// // Initial checks
// checkServerStatus();
// checkServerAndSync();