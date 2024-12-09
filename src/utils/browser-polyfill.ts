// Create a browser API compatibility layer
import browser from 'webextension-polyfill';

export const browserAPI = {
    storage: browser.storage,
    runtime: browser.runtime,
    tabs: browser.tabs,
    downloads: browser.downloads,
    webRequest: browser.webRequest,
    declarativeNetRequest: browser.declarativeNetRequest,
    action: browser.action,
    windows: browser.windows
};

// Helper types for better TypeScript support
export type BrowserStorage = typeof browser.storage;
export type BrowserRuntime = typeof browser.runtime;
export type BrowserTabs = typeof browser.tabs;
export type BrowserAction = typeof browser.action;
export type BrowserWebRequest = typeof browser.webRequest;
export type BrowserDeclarativeNetRequest = typeof browser.declarativeNetRequest; 