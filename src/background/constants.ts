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
    CLEAR_DATA: 'CLEAR_DATA',
    GET_ALL_SOURCE_MAPS: 'GET_ALL_SOURCE_MAPS',
    GET_CRX_FILE: 'GET_CRX_FILE',
    DOWNLOAD_CRX_FILE: 'DOWNLOAD_CRX_FILE',
    GET_SERVER_STATUS: 'GET_SERVER_STATUS',
    SERVER_STATUS_CHANGED: 'SERVER_STATUS_CHANGED'
} as const;

interface NumberSetting {
    min: number;
    max: number;
    default: number;
    unit?: string;
}

export const FILE_TYPES = {
    JS: 'js',
    CSS: 'css'
} as const;

export const SETTINGS = {
    FILE_TYPES,
    STORAGE: {
        CLEANUP_THRESHOLD: {
            min: 128,
            max: 4 * 1024 * 1024, // 4TB
            default: 2 * 1024, // 2GB
            unit: 'MB'
        } as NumberSetting,
        FILE_SIZE: {
            min: 1,
            max: 256,
            default: 32,
            unit: 'MB'
        } as NumberSetting,
        TOTAL_SIZE: {
            min: 64,
            max: 4 * 1024, // 4GB
            default: 1024,
            unit: 'MB'
        } as NumberSetting,
        FILES_COUNT: {
            min: 8,
            max: 1024,
            default: 1024,
            unit: 'files'
        } as NumberSetting,
        RETENTION_DAYS: {
            min: 1,
            max: 365,
            default: 30,
            unit: 'days'
        } as NumberSetting
    }
} as const;

export const STORAGE_LIMITS = SETTINGS.STORAGE;

export const DEFAULT_SETTINGS: AppSettings = {
    id: 'settings',
    cleanupThreshold: 1000
};