import { getDefaultSettingsWithSystemPreference } from '@/background/constants';
import { AppSettings, Page, PageSourceMap, SourceMapFile } from '@/types';
import Dexie from 'dexie';

const DB_VERSION = 3;
const DB_NAME = 'SourceCollectorDB';

export class SourceCollectorDB extends Dexie {
    sourceMapFiles!: Dexie.Table<SourceMapFile, string>;
    pages!: Dexie.Table<Page, string>;
    pageSourceMaps!: Dexie.Table<PageSourceMap, string>;
    settings!: Dexie.Table<AppSettings, number>;

    constructor() {
        super(DB_NAME);

        this.version(DB_VERSION).stores({
            sourceMapFiles: 'id, url, timestamp, fileType, isLatest, hash',
            pages: 'id, url, timestamp',
            pageSourceMaps: 'id, pageId, sourceMapId, timestamp',
            settings: '++id'
        });
    }

    async getSettings(): Promise<AppSettings> {
        try {
            const settings = await this.settings.toArray();
            if (settings.length === 0) {
                const defaultSettings = {
                    ...getDefaultSettingsWithSystemPreference(),
                    id: undefined  // Let Dexie handle auto-increment
                };
                const id = await this.settings.add(defaultSettings);
                return { ...defaultSettings, id };
            }
            return settings[0];
        } catch (error) {
            console.error('Error in getSettings:', error);
            throw error;
        }
    }

    async updateSettings(settings: Partial<AppSettings>): Promise<void> {
        try {
            const currentSettings = await this.getSettings();
            const updatedSettings = { 
                ...currentSettings, 
                ...settings 
            };
            await this.settings.where('id').equals(currentSettings.id!).modify(updatedSettings);
        } catch (error) {
            console.error('Error in updateSettings:', error);
            throw error;
        }
    }

    async getStorageStats() {
        const files = await this.sourceMapFiles.toArray();
        const pages = await this.pages.toArray();
        const totalSize = files.reduce((sum, file) => sum + file.size, 0);
        const oldestFile = files.reduce((oldest, file) =>
            file.timestamp < oldest.timestamp ? file : oldest
            , files[0]);

        return {
            usedSpace: totalSize,
            totalSize: totalSize,
            fileCount: files.length,
            pagesCount: pages.length,
            oldestTimestamp: oldestFile?.timestamp || Date.now()
        };
    }

    async getPageFiles(pageUrl: string): Promise<SourceMapFile[]> {
        const page = await this.pages.where('url').equals(pageUrl).first();
        if (!page) return [];

        const pageSourceMaps = await this.pageSourceMaps
            .where('pageId')
            .equals(page.id)
            .toArray();

        const sourceMapIds = pageSourceMaps.map(psm => psm.sourceMapId);
        return await this.sourceMapFiles
            .where('id')
            .anyOf(sourceMapIds)
            .toArray();
    }

    async addSourceMapToPage(pageUrl: string, pageTitle: string, sourceMap: SourceMapFile): Promise<void> {
        // Get or create page
        let page = await this.pages.where('url').equals(pageUrl).first();
        if (!page) {
            page = {
                id: crypto.randomUUID(),
                url: pageUrl,
                title: pageTitle,
                timestamp: Date.now()
            };
            await this.pages.add(page);
        }

        // Create page-sourcemap relation
        const pageSourceMap: PageSourceMap = {
            id: crypto.randomUUID(),
            pageId: page.id,
            sourceMapId: sourceMap.id,
            timestamp: Date.now()
        };
        await this.pageSourceMaps.add(pageSourceMap);
    }
} 