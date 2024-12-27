/// <reference types="vite-electron-plugin/electron-env" />

declare namespace NodeJS {
  interface ProcessEnv {
    VSCODE_DEBUG?: 'true'
    /**
     * The built directory structure
     *
     * ```tree
     * ├─┬ dist-electron
     * │ ├─┬ main
     * │ │ └── index.js    > Electron-Main
     * │ └─┬ preload
     * │   └── index.mjs   > Preload-Scripts
     * ├─┬ dist
     * │ └── index.html    > Electron-Renderer
     * ```
     */
    APP_ROOT: string
    /** /dist/ or /public/ */
    VITE_PUBLIC: string
  }
}

interface Window {
    database: {
        // Database Info
        getPath: () => Promise<{ success: boolean; data?: string; error?: string; }>;

        // Source Map Files
        getSourceMapFile: (id: number) => Promise<{ success: boolean; data?: any; error?: string; }>;
        getSourceMapFileByUrl: (url: string) => Promise<{ success: boolean; data?: any; error?: string; }>;
        getLatestSourceMapFiles: () => Promise<{ success: boolean; data?: any; error?: string; }>;

        // Pages
        getPage: (id: number) => Promise<{ success: boolean; data?: any; error?: string; }>;
        getPageByUrl: (url: string) => Promise<{ success: boolean; data?: any; error?: string; }>;

        // Page Source Maps
        getPageSourceMaps: (pageId: string) => Promise<{ success: boolean; data?: any; error?: string; }>;

        // Settings
        getSettings: () => Promise<{ success: boolean; data?: any; error?: string; }>;
        updateSettings: (settings: any) => Promise<{ success: boolean; data?: any; error?: string; }>;

        // CRX Files
        getCrxFile: (id: number) => Promise<{ success: boolean; data?: any; error?: string; }>;
        getCrxFileByUrl: (url: string) => Promise<{ success: boolean; data?: any; error?: string; }>;

        // Stats
        getStorageStats: () => Promise<{ success: boolean; data?: any; error?: string; }>;

        // Source Tree
        getDomains: (offset: number, limit: number) => Promise<{ success: boolean; data?: { domains: Array<{ id: number; domain: string; }>; hasMore: boolean; }; error?: string; }>;
        getPages: (domainId: number, offset: number, limit: number) => Promise<{ success: boolean; data?: { pages: Array<{ id: number; url: string; }>; hasMore: boolean; }; error?: string; }>;
        getSourceMaps: (pageId: number, offset: number, limit: number) => Promise<{ success: boolean; data?: { sourceMaps: Array<{ id: number; fileName: string; }>; hasMore: boolean; }; error?: string; }>;
    };
}
