import { SourceCollectorDB } from '@/storage/database';
import { SourceMapFile, AppSettings, PageData } from '@/types';
import { MESSAGE_TYPES, FILE_TYPES } from './constants';

const db = new SourceCollectorDB();

// 存储当前页面的信息
let currentPage: { url: string; title: string } | null = null;

// 监听标签页更新
chrome.tabs.onUpdated.addListener((_, changeInfo, tab) => {
    if (changeInfo.status === 'complete' && tab.url && tab.title) {
        currentPage = {
            url: tab.url,
            title: tab.title
        };
    }
});

// 监听消息
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    console.log(_sender);
    const handleMessage = async () => {
        console.log(message);
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

async function handleGetPageData(data: { url: string }) {
    try {
        const files = await db.sourceMapFiles.where('pageUrl').equals(data.url).toArray();
        const pageData: PageData = {
            url: data.url,
            title: currentPage?.title || '',
            timestamp: Date.now(),
            files: files
        };
        console.log('------page data------', pageData);
        return { success: true, data: pageData };
    } catch (error) {
        console.error('Error getting page data:', error);
        return { success: false, reason: String(error) };
    }
}

async function handleGetFileData(data: { url: string }) {
    try {
        const file = await db.sourceMapFiles.where('url').equals(data.url).first();
        console.log('------file------', file);
        return { success: true, data: file };
    } catch (error) {
        console.error('Error getting file data:', error);
        return { success: false, reason: String(error) };
    }
}

// 处理发现的 sourcemap
async function handleSourceMapFound(data: { sourceUrl: string; mapUrl: string; fileType: 'js' | 'css' }) {
    try {
        console.log(data);
        const settings = await db.getSettings();

        // 检查文件类型是否需要收集
        if (
            (data.fileType === FILE_TYPES.JS && !settings.collectJs) ||
            (data.fileType === FILE_TYPES.CSS && !settings.collectCss)
        ) {
            return { success: false, reason: 'File type not collected' };
        }

        // 获取 sourcemap 内容
        const response = await fetch(data.mapUrl);
        if (!response.ok) {
            throw new Error(`Failed to fetch sourcemap: ${response.status}`);
        }

        const content = await response.text();
        const size = new Blob([content]).size;

        // 检查文件大小
        if (size > settings.maxFileSize * 1024 * 1024) {
            return { success: false, reason: 'File too large' };
        }

        // 创建 sourcemap 记录
        const sourceMapFile: SourceMapFile = {
            id: crypto.randomUUID(),
            url: data.sourceUrl,
            sourceMapUrl: data.mapUrl,
            content,
            fileType: data.fileType,
            size,
            timestamp: Date.now(),
            pageUrl: currentPage?.url || '',
            pageTitle: currentPage?.title || ''
        };

        // 存储文件
        await db.sourceMapFiles.add(sourceMapFile);

        // 检查是否需要清理存储
        if (settings.autoCleanup) {
            await checkAndCleanStorage(settings);
        }

        return { success: true };
    } catch (error) {
        console.error('Error handling sourcemap:', error);
        return { success: false, reason: String(error) };
    }
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

// 清空历史记录
async function handleClearHistory() {
    try {
        await db.sourceMapFiles.clear();
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