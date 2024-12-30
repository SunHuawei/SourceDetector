interface DatabaseAPI {
  // Database Info
  getPath: () => Promise<{ success: boolean; data: string | null; error?: string }>;

  // Source Map Files
  getSourceMapFile: (id: number) => Promise<{ success: boolean; data?: any; error?: string }>;
  getSourceMapFileByUrl: (url: string) => Promise<{ success: boolean; data?: any; error?: string }>;
  getLatestSourceMapFiles: () => Promise<{ success: boolean; data?: any[]; error?: string }>;

  // Parsed Source Files
  getParsedSourceFiles: (params: { sourceMapFileId: number }) => Promise<{ success: boolean; data?: Array<{ id: number; path: string; content: string; sourceMapFileId: number; timestamp: number; }>; error?: string }>;

  // Pages
  getPage: (id: number) => Promise<{ success: boolean; data?: any; error?: string }>;
  getPageByUrl: (url: string) => Promise<{ success: boolean; data?: any; error?: string }>;

  // Page Source Maps
  getPageSourceMaps: (pageId: string) => Promise<{ success: boolean; data?: any[]; error?: string }>;

  // Settings
  getSettings: () => Promise<{ success: boolean; data?: any; error?: string }>;
  updateSettings: (settings: any) => Promise<{ success: boolean; error?: string }>;

  // CRX Files
  getCrxFile: (id: number) => Promise<{ success: boolean; data?: any; error?: string }>;
  getCrxFileByUrl: (url: string) => Promise<{ success: boolean; data?: any; error?: string }>;
  getCrxFiles: () => Promise<{ success: boolean; data: any[] }>;
  getParsedCrxFiles: (params: { crxFileId: number }) => Promise<{ success: boolean; data: any[] }>;

  // Stats
  getStorageStats: () => Promise<{
    success: boolean;
    data?: {
      usedSpace: number;
      totalSize: number;
      fileCount: number;
      crxFileCount: number;
      uniqueSiteCount: number;
      pagesCount: number;
      oldestTimestamp: number;
    };
    error?: string;
  }>;

  // Source Tree
  getDomains: (offset: number, limit: number) => Promise<{
    success: boolean;
    data?: {
      domains: Array<{ id: number; domain: string }>;
      hasMore: boolean;
    };
    error?: string;
  }>;
  getPages: (domainId: number, offset: number, limit: number) => Promise<{
    success: boolean;
    data?: {
      pages: Array<{ id: number; url: string }>;
      hasMore: boolean;
    };
    error?: string;
  }>;
  getSourceMaps: (pageId: number, offset: number, limit: number) => Promise<{
    success: boolean;
    data?: {
      sourceMaps: Array<{ id: number; url: string }>;
      hasMore: boolean;
    };
    error?: string;
  }>;

  // Events
  onSelectFile: (callback: (event: Electron.IpcRendererEvent, data: { url: string; type: 'crx' | 'sourcemap' }) => void) => void;
}

declare global {
  interface Window {
    database: DatabaseAPI;
  }
}

export {}; 