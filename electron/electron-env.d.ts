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

interface Database {
  getDomains: (offset: number, limit: number) => Promise<{ success: boolean; data?: { domains: Array<{ id: number; domain: string }>; hasMore: boolean; }; error?: string; }>;
  getPages: (domainId: number, offset: number, limit: number) => Promise<{ success: boolean; data?: { pages: Array<{ id: number; url: string }>; hasMore: boolean; }; error?: string; }>;
  getSourceMaps: (pageId: number, offset: number, limit: number) => Promise<{ success: boolean; data?: { sourceMaps: Array<{ id: number; url: string }>; hasMore: boolean; }; error?: string; }>;
  getSourceMapFile: (params: { id: number }) => Promise<{ success: boolean; data?: { id: number; fileType: string; content: string; url: string; isParsed: boolean; }; error?: string; }>;
  getParsedSourceFiles: (params: { sourceMapFileId: number }) => Promise<{ success: boolean; data?: Array<{ id: number; path: string; content: string; sourceMapFileId: number; timestamp: number; }>; error?: string; }>;
}

interface Window {
  database: Database;
  ipcRenderer: {
    on: (channel: string, func: (...args: any[]) => void) => void;
    removeListener: (channel: string, func: (...args: any[]) => void) => void;
  };
}
