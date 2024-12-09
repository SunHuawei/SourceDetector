import { DEFAULT_SETTINGS } from '@/background/constants';
import { AppSettings, Page, PageSourceMap, SourceMapFile, CrxFile, SyncStatus } from '@/types';
import Dexie from 'dexie';

const DB_VERSION = 1;
const DB_NAME = 'SourceDetectorDB';

export class SourceDetectorDB extends Dexie {
    sourceMapFiles!: Dexie.Table<SourceMapFile, number>;
    pages!: Dexie.Table<Page, number>;
    pageSourceMaps!: Dexie.Table<PageSourceMap, number>;
    settings!: Dexie.Table<AppSettings, string>;
    crxFiles!: Dexie.Table<CrxFile, number>;
    syncStatus!: Dexie.Table<SyncStatus, string>;

    constructor() {
        super(DB_NAME);

        this.version(DB_VERSION).stores({
            sourceMapFiles: '++id, url, timestamp, fileType, isLatest, hash, size',
            pages: '++id, url, timestamp',
            pageSourceMaps: '++id, pageId, sourceMapId, timestamp',
            settings: 'id',
            crxFiles: '++id, pageUrl, pageTitle, crxUrl, blob, size, timestamp, count, contentHash',
            syncStatus: 'tableName'
        });
    }

    async addPage(page: Omit<Page, 'id'>): Promise<Page> {
        const id = await this.pages.add(page as any);
        return { ...page, id };
    }

    async addPageSourceMap(relation: Omit<PageSourceMap, 'id'>): Promise<PageSourceMap> {
        const id = await this.pageSourceMaps.add(relation as any);
        return { ...relation, id };
    }

    async addSourceMapFile(file: Omit<SourceMapFile, 'id'>): Promise<SourceMapFile> {
        const id = await this.sourceMapFiles.add(file as any);
        return { ...file, id };
    }

    async addCrxFile(file: Omit<CrxFile, 'id'>): Promise<CrxFile> {
        const id = await this.crxFiles.add(file as any);
        return { ...file, id };
    }

    async updateCrxFile(crxFile: CrxFile): Promise<void> {
        await this.crxFiles.put(crxFile);
    }

    async getCrxFileByPageUrl(pageUrl: string): Promise<CrxFile | undefined> {
        return this.crxFiles
            .where('pageUrl')
            .equals(pageUrl)
            .first();
    }

    async getSettings(): Promise<AppSettings> {
        try {
            const settings = await this.settings.toArray();
            if (settings.length === 0) {
                await this.settings.add(DEFAULT_SETTINGS);
                return DEFAULT_SETTINGS;
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
                ...settings,
                id: 'settings'
            };
            await this.settings.put(updatedSettings);
        } catch (error) {
            console.error('Error in updateSettings:', error);
            throw error;
        }
    }

    async getStorageStats() {
        // Run all queries in parallel for better performance
        let totalSize = 0;
        let oldestTimestamp = Date.now();

        // Count unique sites using index, processing one record at a time
        const uniqueSites = new Set();

        const [fileCount, pagesCount] = await Promise.all([

            // Get file count without loading data
            this.sourceMapFiles.count(),

            // Get page count without loading data
            this.pages.count(),

            // Get total size and oldest file in a single table scan
            this.sourceMapFiles.each((file: SourceMapFile) => {
                totalSize += file.size;
                if (file.timestamp < oldestTimestamp) {
                    oldestTimestamp = file.timestamp;
                }
            }),

            this.pages
                .orderBy('url')
                .each(page => {
                    try {
                        uniqueSites.add(new URL(page.url).hostname);
                    } catch {
                        uniqueSites.add(page.url);
                    }
                })
        ]);

        return {
            usedSpace: totalSize,
            totalSize: totalSize,
            fileCount,
            uniqueSiteCount: uniqueSites.size,
            pagesCount,
            oldestTimestamp: oldestTimestamp
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
            page = await this.addPage({
                url: pageUrl,
                title: pageTitle,
                timestamp: Date.now()
            });
        }

        // Check for existing relation
        const existingRelation = await this.pageSourceMaps
            .where('pageId').equals(page.id)
            .and(psm => psm.sourceMapId === sourceMap.id)
            .first();
        if (existingRelation) {
            return;
        }

        // Create page-sourcemap relation
        await this.addPageSourceMap({
            pageId: page.id,
            sourceMapId: sourceMap.id,
            timestamp: Date.now()
        });
    }

    // Sync status methods
    async getLastSyncId(table: string): Promise<number> {
        const status = await this.syncStatus.get(table);
        return status?.lastId || 0;
    }

    async updateLastSyncId(table: string, id: number): Promise<void> {
        await this.syncStatus.put({ tableName: table, lastId: id });
    }

    async getModifiedData(table: string, lastId: number, chunkSize: number): Promise<any[]> {
        const tableMap = {
            sourceMapFiles: this.sourceMapFiles,
            pages: this.pages,
            pageSourceMaps: this.pageSourceMaps,
            crxFiles: this.crxFiles
        };

        const dbTable = tableMap[table as keyof typeof tableMap];
        if (!dbTable) return [];

        return await dbTable
            .where('id')
            .above(lastId)
            .limit(chunkSize)
            .toArray();
    }
} 