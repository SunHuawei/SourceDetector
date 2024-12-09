/// <reference types="chrome"/>

declare namespace chrome {
    export interface Runtime {
        sendMessage: <T = any>(
            message: any,
            responseCallback?: (response: T) => void
        ) => void;
        onMessage: {
            addListener: (
                callback: (
                    message: any,
                    sender: chrome.runtime.MessageSender,
                    sendResponse: (response?: any) => void
                ) => void | boolean
            ) => void;
        };
    }

    export interface Tabs {
        query: (queryInfo: {
            active: boolean;
            currentWindow: boolean;
        }) => Promise<chrome.tabs.Tab[]>;
    }

    export interface Storage {
        local: {
            get: <T>(keys?: string | string[] | null) => Promise<T>;
            set: (items: { [key: string]: any }) => Promise<void>;
            remove: (keys: string | string[]) => Promise<void>;
            clear: () => Promise<void>;
        };
    }
} 