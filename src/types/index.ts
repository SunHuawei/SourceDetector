import JSZip from 'jszip';

export interface Page {
    id: string;
    url: string;
    title: string;
    timestamp: number;
}

export interface PageSourceMap {
    id: string;
    pageId: string;
    sourceMapId: string;
    timestamp: number;
}

export interface SourceMapFile {
    id: string;
    url: string;
    sourceMapUrl: string;
    content: string;
    originalContent: string;
    fileType: 'js' | 'css';
    size: number;
    timestamp: number;
    version: number;
    hash: string;
    isLatest: boolean;
}

export interface SourceMapFoundData {
    pageTitle: string;
    pageUrl: string;
    sourceUrl: string;
    mapUrl: string;
    fileType: 'js' | 'css';
    originalContent: string;
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
    uniqueSiteCount: number;
    pagesCount: number;
    oldestTimestamp: number;
}

export interface AppSettings {
    id?: string;
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

export interface CrxFile {
    id?: string;
    pageUrl: string;
    pageTitle: string;
    crxUrl: string;
    blob: Blob;
    size: number;
    timestamp: number;
    count: number;
}

export interface ParsedCrxFile {
    zip: JSZip;
    size: number;
    count: number;
    timestamp: number;
    blob: Blob;
}

export interface SyncStatus {
    table: string;
    timestamp: number;
}