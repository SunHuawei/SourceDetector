import { ipcMain } from 'electron';
import { DatabaseOperations } from './database-operations';
import { getDatabasePath } from './database.js';
import type { SourceMapFile, Page, PageSourceMap, AppSettings, CrxFile, StorageStats } from './database-operations';

export function setupIpcHandlers(dbOps: DatabaseOperations) {
    // Database Info
    ipcMain.handle('database:getPath', async () => {
        try {
            const path = getDatabasePath();
            return { success: true, data: path };
        } catch (error) {
            console.error('Error getting database path:', error);
            return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
        }
    });

    // Source Map Files
    ipcMain.handle('sourceMapFile:add', async (_event, file: Omit<SourceMapFile, 'id'>) => {
        try {
            return { success: true, data: dbOps.addSourceMapFile(file) };
        } catch (error) {
            console.error('Error adding source map file:', error);
            return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
        }
    });

    ipcMain.handle('sourceMapFile:get', async (_event, id: string) => {
        try {
            const file = dbOps.getSourceMapFile(id);
            return { success: true, data: file };
        } catch (error) {
            console.error('Error getting source map file:', error);
            return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
        }
    });

    ipcMain.handle('sourceMapFile:getByUrl', async (_event, url: string) => {
        try {
            const file = dbOps.getSourceMapFileByUrl(url);
            return { success: true, data: file };
        } catch (error) {
            console.error('Error getting source map file by URL:', error);
            return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
        }
    });

    ipcMain.handle('sourceMapFile:getLatest', async () => {
        try {
            const files = dbOps.getLatestSourceMapFiles();
            return { success: true, data: files };
        } catch (error) {
            console.error('Error getting latest source map files:', error);
            return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
        }
    });

    // Pages
    ipcMain.handle('page:add', async (_event, page: Omit<Page, 'id'>) => {
        try {
            return { success: true, data: dbOps.addPage(page) };
        } catch (error) {
            console.error('Error adding page:', error);
            return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
        }
    });

    ipcMain.handle('page:get', async (_event, id: string) => {
        try {
            const page = dbOps.getPage(id);
            return { success: true, data: page };
        } catch (error) {
            console.error('Error getting page:', error);
            return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
        }
    });

    ipcMain.handle('page:getByUrl', async (_event, url: string) => {
        try {
            const page = dbOps.getPageByUrl(url);
            return { success: true, data: page };
        } catch (error) {
            console.error('Error getting page by URL:', error);
            return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
        }
    });

    // Page Source Maps
    ipcMain.handle('pageSourceMap:add', async (_event, map: Omit<PageSourceMap, 'id'>) => {
        try {
            return { success: true, data: dbOps.addPageSourceMap(map) };
        } catch (error) {
            console.error('Error adding page source map:', error);
            return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
        }
    });

    ipcMain.handle('pageSourceMap:getByPageId', async (_event, pageId: string) => {
        try {
            const maps = dbOps.getPageSourceMaps(pageId);
            return { success: true, data: maps };
        } catch (error) {
            console.error('Error getting page source maps:', error);
            return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
        }
    });

    // Settings
    ipcMain.handle('settings:get', async () => {
        try {
            const settings = dbOps.getSettings();
            return { success: true, data: settings };
        } catch (error) {
            console.error('Error getting settings:', error);
            return { success: false, error: String(error) };
        }
    });

    ipcMain.handle('settings:update', async (_event, settings: Partial<AppSettings>) => {
        try {
            await dbOps.updateSettings(settings);
            return { success: true };
        } catch (error) {
            console.error('Error updating settings:', error);
            return { success: false, error: String(error) };
        }
    });

    // CRX Files
    ipcMain.handle('crxFile:add', async (_event, file: Omit<CrxFile, 'id'>) => {
        try {
            return { success: true, data: dbOps.addCrxFile(file) };
        } catch (error) {
            console.error('Error adding CRX file:', error);
            return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
        }
    });

    ipcMain.handle('crxFile:get', async (_event, id: string) => {
        try {
            const file = dbOps.getCrxFile(id);
            return { success: true, data: file };
        } catch (error) {
            console.error('Error getting CRX file:', error);
            return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
        }
    });

    ipcMain.handle('crxFile:getByUrl', async (_event, url: string) => {
        try {
            const file = dbOps.getCrxFileByUrl(url);
            return { success: true, data: file };
        } catch (error) {
            console.error('Error getting CRX file by URL:', error);
            return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
        }
    });

    ipcMain.handle('crxFile:update', async (_event, file: CrxFile) => {
        try {
            dbOps.updateCrxFile(file);
            return { success: true };
        } catch (error) {
            console.error('Error updating CRX file:', error);
            return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
        }
    });

    // Stats
    ipcMain.handle('stats:get', async () => {
        try {
            const stats = dbOps.getStorageStats();
            return { success: true, data: stats };
        } catch (error) {
            console.error('Error getting storage stats:', error);
            return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
        }
    });
}