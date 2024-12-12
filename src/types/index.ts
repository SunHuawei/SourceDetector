export interface SourceMapFile {
    id: string;
    url: string;
    sourceMapUrl: string;
    content: string;
    originalContent: string;
    fileType: 'js' | 'css';
    size: number;
    timestamp: number;
    pageUrl: string;
    pageTitle: string;
    version: number;
    hash: string;
    isLatest: boolean;
}

export interface PageData {
    url: string;
    title: string;
    timestamp: number;
    files: SourceMapFile[];
}

export interface StorageStats {
    usedSpace: number;
    totalSize: number;
    fileCount: number;
    pagesCount: number;
    oldestTimestamp: number;
}

export interface AppSettings {
    darkMode: boolean;
    autoCollect: boolean;
    autoCleanup: boolean;
    cleanupThreshold: number;
    retentionDays: number;
    collectJs: boolean;
    collectCss: boolean;
    maxFileSize: number;
    maxTotalSize: number;
    maxFiles: number;
}

export interface Message<T = unknown> {
    type: string;
    payload: T;
} 