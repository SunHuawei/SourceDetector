import { FILE_TYPES, MESSAGE_TYPES } from '@/background/constants';
import {
    fetchWithRetry,
    checkCorsAccess,
    formatError
} from './utils';

// 存储已处理的文件 URL，避免重复处理
const processedUrls = new Set<string>();

// 监听 script 和 link 标签的加载
function observeDOM() {
    const observer = new MutationObserver(mutations => {
        mutations.forEach(mutation => {
            mutation.addedNodes.forEach(node => {
                if (node instanceof HTMLElement) {
                    if (node.tagName === 'SCRIPT') {
                        processScript(node as HTMLScriptElement);
                    } else if (node.tagName === 'LINK' && node.getAttribute('rel') === 'stylesheet') {
                        processStylesheet(node as HTMLLinkElement);
                    }
                }
            });
        });
    });

    observer.observe(document.documentElement, {
        childList: true,
        subtree: true
    });

    // 处理已存在的标签
    document.querySelectorAll('script').forEach(script =>
        processScript(script as HTMLScriptElement)
    );
    document.querySelectorAll('link[rel="stylesheet"]').forEach(link =>
        processStylesheet(link as HTMLLinkElement)
    );
}

// 处理 JavaScript 文件
async function processScript(script: HTMLScriptElement) {
    const src = script.src;
    if (!src || processedUrls.has(src)) return;

    try {
        const sourceMapUrl = await findSourceMapUrl(src);
        if (sourceMapUrl) {
            await notifySourceMapFound(src, sourceMapUrl, FILE_TYPES.JS);
        }
    } catch (error) {
        console.error(`Error processing script ${src}:`, formatError(error));
    }
}

// 处理 CSS 文件
async function processStylesheet(link: HTMLLinkElement) {
    const href = link.href;
    if (!href || processedUrls.has(href)) return;

    try {
        const sourceMapUrl = await findSourceMapUrl(href);
        if (sourceMapUrl) {
            await notifySourceMapFound(href, sourceMapUrl, FILE_TYPES.CSS);
        }
    } catch (error) {
        console.error(`Error processing stylesheet ${href}:`, formatError(error));
    }
}

// 查找 sourcemap URL
async function findSourceMapUrl(url: string): Promise<string | null> {
    processedUrls.add(url);

    try {
        const response = await fetchWithRetry(url);
        const text = await response.text();

        // Get the last line of the file
        const lastLine = text.split('\n').pop()?.trim() || '';

        // Check if the last line contains sourceMappingURL
        const match = lastLine.match(/\/\/[#@]\s*sourceMappingURL=([^\s]+)$/);
        if (!match) return null;

        const sourceMapPath = match[1];
        if (!sourceMapPath) return null;

        // Build complete sourcemap URL
        const sourceMapUrl = sourceMapPath.startsWith('http')
            ? sourceMapPath
            : new URL(sourceMapPath, url).href;

        // Check if sourcemap is accessible
        if (await checkCorsAccess(sourceMapUrl)) {
            return sourceMapUrl;
        }

        return null;
    } catch (error) {
        console.error(`Error finding sourcemap for ${url}:`, formatError(error));
        return null;
    }
}

// 通知后台服务发现了 sourcemap
async function notifySourceMapFound(sourceUrl: string, mapUrl: string, fileType: 'js' | 'css') {
    try {
        const response = await chrome.runtime.sendMessage({
            type: MESSAGE_TYPES.FOUND_SOURCE_MAP,
            data: {
                sourceUrl,
                mapUrl,
                fileType,
                timestamp: Date.now()
            }
        });

        if (!response?.success) {
            console.warn(`Failed to collect sourcemap: ${response?.reason || 'Unknown error'}`);
        }
    } catch (error) {
        console.error('Error notifying sourcemap:', formatError(error));
    }
}

// 启动观察
observeDOM(); 