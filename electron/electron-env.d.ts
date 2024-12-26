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
        getPath: () => Promise<{ success: boolean; data: string | null; error?: string }>;

        // Source Map Files
        addSourceMapFile: (file: any) => Promise<{ success: boolean; data?: any; error?: string }>;
        getSourceMapFile: (id: string) => Promise<{ success: boolean; data?: any; error?: string }>;
        getSourceMapFileByUrl: (url: string) => Promise<{ success: boolean; data?: any; error?: string }>;
        getLatestSourceMapFiles: () => Promise<{ success: boolean; data?: any[]; error?: string }>;

        // Pages
        addPage: (page: any) => Promise<{ success: boolean; data?: any; error?: string }>;
        getPage: (id: string) => Promise<{ success: boolean; data?: any; error?: string }>;
        getPageByUrl: (url: string) => Promise<{ success: boolean; data?: any; error?: string }>;

        // Page Source Maps
        addPageSourceMap: (map: any) => Promise<{ success: boolean; data?: any; error?: string }>;
        getPageSourceMaps: (pageId: string) => Promise<{ success: boolean; data?: any[]; error?: string }>;

        // Settings
        getSettings: () => Promise<{ success: boolean; data?: any; error?: string }>;
        updateSettings: (settings: any) => Promise<{ success: boolean; error?: string }>;

        // CRX Files
        addCrxFile: (file: any) => Promise<{ success: boolean; data?: any; error?: string }>;
        getCrxFile: (id: string) => Promise<{ success: boolean; data?: any; error?: string }>;
        getCrxFileByUrl: (url: string) => Promise<{ success: boolean; data?: any; error?: string }>;
        updateCrxFile: (file: any) => Promise<{ success: boolean; error?: string }>;

        // Stats
        getStorageStats: () => Promise<{ success: boolean; data?: any; error?: string }>;
    };
}
