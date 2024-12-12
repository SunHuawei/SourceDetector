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
    GET_ALL_SOURCE_MAPS: 'GET_ALL_SOURCE_MAPS'
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

// Create default settings without dark mode preference
const createDefaultSettings = (darkMode: boolean): AppSettings => ({
    darkMode,
    autoCollect: true,
    autoCleanup: true,
    cleanupThreshold: SETTINGS.STORAGE.CLEANUP_THRESHOLD.default,
    retentionDays: SETTINGS.STORAGE.RETENTION_DAYS.default,
    collectJs: true,
    collectCss: true,
    maxFileSize: SETTINGS.STORAGE.FILE_SIZE.default,
    maxTotalSize: SETTINGS.STORAGE.TOTAL_SIZE.default,
    maxFiles: SETTINGS.STORAGE.FILES_COUNT.default
});

// Default settings with light mode
export const DEFAULT_SETTINGS = createDefaultSettings(false);

// Helper to get settings with system preference
export const getDefaultSettingsWithSystemPreference = (): AppSettings => {
    const prefersDarkMode = typeof window !== 'undefined'
        && window.matchMedia?.('(prefers-color-scheme: dark)').matches;
    return createDefaultSettings(!!prefersDarkMode);
};
