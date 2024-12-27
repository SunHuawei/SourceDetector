import { ipcMain } from 'electron';
import type { SourceMapFile, Page, PageSourceMap, AppSettings, CrxFile, StorageStats } from './database-operations';
import { DatabaseOperations } from './database-operations';
import { getDatabasePath } from './database';

export function setupIpcHandlers(dbOps: DatabaseOperations) {
    // Database Info
    ipcMain.handle('database:getPath', async () => {
        try {
            const path = getDatabasePath();
            return { success: true, data: path };
        } catch (error) {
            console.error('Error getting database path:', error);
            return { success: false, error: String(error) };
        }
    });

    // Get source map file by ID
    ipcMain.handle('getSourceMapFile', async (_, { id }: { id: number }) => {
        try {
            const file = dbOps.getSourceMapFile(id);
            return { success: true, data: file };
        } catch (error) {
            console.error('Error getting source map file:', error);
            return { success: false, error: String(error) };
        }
    });

    // Get source map file by URL
    ipcMain.handle('getSourceMapFileByUrl', async (_, { url }: { url: string }) => {
        try {
            const file = dbOps.getSourceMapFileByUrl(url);
            return { success: true, data: file };
        } catch (error) {
            console.error('Error getting source map file by URL:', error);
            return { success: false, error: String(error) };
        }
    });

    // Get latest source map files
    ipcMain.handle('getLatestSourceMapFiles', async () => {
        try {
            const files = dbOps.getLatestSourceMapFiles();
            return { success: true, data: files };
        } catch (error) {
            console.error('Error getting latest source map files:', error);
            return { success: false, error: String(error) };
        }
    });

    // Get page by ID
    ipcMain.handle('getPage', async (_, { id }: { id: number }) => {
        try {
            const page = dbOps.getPage(id);
            return { success: true, data: page };
        } catch (error) {
            console.error('Error getting page:', error);
            return { success: false, error: String(error) };
        }
    });

    // Get page by URL
    ipcMain.handle('getPageByUrl', async (_, { url }: { url: string }) => {
        try {
            const page = dbOps.getPageByUrl(url);
            return { success: true, data: page };
        } catch (error) {
            console.error('Error getting page by URL:', error);
            return { success: false, error: String(error) };
        }
    });

    // Get page source maps
    ipcMain.handle('getPageSourceMaps', async (_, { pageId }: { pageId: number }) => {
        try {
            const maps = dbOps.getPageSourceMaps(pageId);
            return { success: true, data: maps };
        } catch (error) {
            console.error('Error getting page source maps:', error);
            return { success: false, error: String(error) };
        }
    });

    // Get settings
    ipcMain.handle('getSettings', async () => {
        try {
            const settings = dbOps.getSettings();
            return { success: true, data: settings };
        } catch (error) {
            console.error('Error getting settings:', error);
            return { success: false, error: String(error) };
        }
    });

    // Update settings
    ipcMain.handle('updateSettings', async (_, settings: Partial<AppSettings>) => {
        try {
            await dbOps.updateSettings(settings);
            return { success: true };
        } catch (error) {
            console.error('Error updating settings:', error);
            return { success: false, error: String(error) };
        }
    });

    // Get CRX file by ID
    ipcMain.handle('getCrxFile', async (_, { id }: { id: number }) => {
        try {
            const file = dbOps.getCrxFile(id);
            return { success: true, data: file };
        } catch (error) {
            console.error('Error getting CRX file:', error);
            return { success: false, error: String(error) };
        }
    });

    // Get CRX file by URL
    ipcMain.handle('getCrxFileByUrl', async (_, { url }: { url: string }) => {
        try {
            const file = dbOps.getCrxFileByUrl(url);
            return { success: true, data: file };
        } catch (error) {
            console.error('Error getting CRX file by URL:', error);
            return { success: false, error: String(error) };
        }
    });

    // Get storage stats
    ipcMain.handle('getStorageStats', async () => {
        try {
            const stats = dbOps.getStorageStats();
            return { success: true, data: stats };
        } catch (error) {
            console.error('Error getting storage stats:', error);
            return { success: false, error: String(error) };
        }
    });
}