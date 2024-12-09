import { AppSettings } from '@/types';

export const MESSAGE_TYPES = {
    FOUND_SOURCE_MAP: 'FOUND_SOURCE_MAP',
    COLLECT_SOURCEMAP: 'COLLECT_SOURCEMAP',
    GET_SOURCEMAP: 'GET_SOURCEMAP',
    DELETE_SOURCEMAP: 'DELETE_SOURCEMAP',
    GET_STORAGE_STATS: 'GET_STORAGE_STATS',
    UPDATE_SETTINGS: 'UPDATE_SETTINGS',
    GET_SETTINGS: 'GET_SETTINGS',
    CLEAR_HISTORY: 'CLEAR_HISTORY',
    GET_PAGE_DATA: 'GET_PAGE_DATA',
    GET_ALL_PAGES: 'GET_ALL_PAGES',
    DELETE_PAGE: 'DELETE_PAGE',
    GET_FILE_DATA: 'GET_FILE_DATA',
    EXPORT_DATA: 'EXPORT_DATA',
    IMPORT_DATA: 'IMPORT_DATA',
    CLEAR_DATA: 'CLEAR_DATA'
} as const;

export const FILE_TYPES = {
    JS: 'js',
    CSS: 'css'
} as const;

export const STORAGE_LIMITS = {
    MIN_CLEANUP_THRESHOLD: 100, // MB
    MAX_CLEANUP_THRESHOLD: 2000, // MB
    MIN_FILE_SIZE: 1, // MB
    MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB
    MAX_TOTAL_SIZE: 100 * 1024 * 1024, // 100MB
    MAX_FILES: 1000,
    MIN_RETENTION_DAYS: 1,
    MAX_RETENTION_DAYS: 365
} as const;

export const DEFAULT_SETTINGS: AppSettings = {
    darkMode: false,
    autoCollect: true,
    autoCleanup: true,
    cleanupThreshold: 500,
    retentionDays: 30,
    collectJs: true,
    collectCss: true,
    maxFileSize: 100,
    maxTotalSize: 100,
    maxFiles: 1000
}; 
