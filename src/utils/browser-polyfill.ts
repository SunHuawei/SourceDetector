// Create a browser API compatibility layer
import browser from 'webextension-polyfill';

export const browserAPI = {
    action: browser.action,
    runtime: browser.runtime,
    tabs: browser.tabs,
    webRequest: browser.webRequest,
    windows: browser.windows
};

// Helper types for better TypeScript support
export type BrowserStorage = typeof browser.storage;
export type BrowserRuntime = typeof browser.runtime;
export type BrowserTabs = typeof browser.tabs;
export type BrowserAction = typeof browser.action;
export type BrowserWebRequest = typeof browser.webRequest;