import { getDefaultSettingsWithSystemPreference } from '@/background/constants';
import { AppSettings, Page, PageSourceMap, SourceMapFile, CrxFile } from '@/types';
import Dexie from 'dexie';

const DB_VERSION = 1;
const DB_NAME = 'SourceDetectorDB';

export class SourceDetectorDB extends Dexie {
    sourceMapFiles!: Dexie.Table<SourceMapFile, string>;
    pages!: Dexie.Table<Page, string>;
    pageSourceMaps!: Dexie.Table<PageSourceMap, string>;
    settings!: Dexie.Table<AppSettings, number>;
    crxFiles!: Dexie.Table<CrxFile, number>;

    constructor() {
        super(DB_NAME);

        this.version(DB_VERSION).stores({
            sourceMapFiles: 'id, url, timestamp, fileType, isLatest, hash, size',
            pages: 'id, url, timestamp',
            pageSourceMaps: 'id, pageId, sourceMapId, timestamp',
            settings: '++id',
            crxFiles: '++id, pageUrl, pageTitle, crxUrl, blob, size, timestamp, count'
        });
    }

    async addCrxFile(crxFile: CrxFile & { version?: number }): Promise<CrxFile> {
        const id = await this.crxFiles.add(crxFile);
        return { ...crxFile, id };
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
                .eachPrimaryKey(url => {
                    try {
                        uniqueSites.add(new URL(url).hostname);
                    } catch {
                        uniqueSites.add(url);
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