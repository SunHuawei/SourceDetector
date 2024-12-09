import JSZip from 'jszip';

export interface Page {
    id: number;
    url: string;
    title: string;
    timestamp: number;
}

export interface PageSourceMap {
    id: number;
    pageId: number;
    sourceMapId: number;
    timestamp: number;
}

export interface SourceMapFile {
    id: number;
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
    id: string;
    cleanupThreshold: number;
}

export interface Message<T = unknown> {
    type: string;
    payload: T;
} 

export interface CrxFile {
    id: number;
    pageUrl: string;
    pageTitle: string;
    crxUrl: string;
    blob: Blob;
    size: number;
    timestamp: number;
    count: number;
    contentHash: string;
}

export interface ParsedCrxFile {
    zip: JSZip;
    size: number;
    count: number;
    timestamp: number;
    blob: Blob;
}

export interface SyncStatus {
    tableName: string;
    lastId: number;
}