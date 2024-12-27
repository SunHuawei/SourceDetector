interface DatabaseAPI {
  // Database Info
  getPath: () => Promise<{ success: boolean; data: string | null; error?: string }>;

  // Source Map Files
  getSourceMapFile: (id: number) => Promise<{ success: boolean; data?: any; error?: string }>;
  getSourceMapFileByUrl: (url: string) => Promise<{ success: boolean; data?: any; error?: string }>;
  getLatestSourceMapFiles: () => Promise<{ success: boolean; data?: any[]; error?: string }>;

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

  // Stats
  getStorageStats: () => Promise<{ success: boolean; data?: any; error?: string }>;

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
      sourceMaps: Array<{ id: number; fileName: string }>;
      hasMore: boolean;
    };
    error?: string;
  }>;
}

declare global {
  interface Window {
    database: DatabaseAPI;
  }
}

export {}; 