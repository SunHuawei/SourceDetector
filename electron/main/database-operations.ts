import BetterSqlite3, { Statement } from 'better-sqlite3';
import crypto from 'crypto';

// Types
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

export interface AppSettings {
    id: string;
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
    enableDesktopApp: boolean;
}

export interface CrxFile {
    id: string;
    pageUrl: string;
    pageTitle: string;
    crxUrl: string;
    blob: Buffer;
    size: number;
    timestamp: number;
    count: number;
}

export interface StorageStats {
    usedSpace: number;
    totalSize: number;
    fileCount: number;
    uniqueSiteCount: number;
    pagesCount: number;
    oldestTimestamp: number;
}

export class DatabaseOperations {
    private db: BetterSqlite3.Database;
    private statements: {
        // Source Map Files
        insertSourceMapFile: Statement;
        getSourceMapFile: Statement;
        getSourceMapFileByUrl: Statement;
        getLatestSourceMapFiles: Statement;
        updateSourceMapFile: Statement;
        // Pages
        insertPage: Statement;
        getPage: Statement;
        getPageByUrl: Statement;
        // Page Source Maps
        insertPageSourceMap: Statement;
        getPageSourceMaps: Statement;
        // Settings
        getSettings: Statement;
        insertSettings: Statement;
        updateSettings: Statement;
        // CRX Files
        insertCrxFile: Statement;
        getCrxFile: Statement;
        getCrxFileByUrl: Statement;
        updateCrxFile: Statement;
        // Stats
        getSourceMapFilesCount: Statement;
        getPagesCount: Statement;
        getTotalSize: Statement;
        getOldestTimestamp: Statement;
        getUniqueSites: Statement;
    };

    constructor(db: BetterSqlite3.Database) {
        this.db = db;
        this.statements = this.prepareStatements();
    }

    private prepareStatements() {
        return {
            // Source Map Files
            insertSourceMapFile: this.db.prepare(`
                INSERT INTO source_map_files (id, url, source_map_url, content, original_content, 
                    file_type, size, timestamp, version, hash, is_latest)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `),
            getSourceMapFile: this.db.prepare('SELECT * FROM source_map_files WHERE id = ?'),
            getSourceMapFileByUrl: this.db.prepare('SELECT * FROM source_map_files WHERE url = ?'),
            getLatestSourceMapFiles: this.db.prepare('SELECT * FROM source_map_files WHERE is_latest = 1'),
            updateSourceMapFile: this.db.prepare(`
                UPDATE source_map_files 
                SET content = ?, original_content = ?, size = ?, timestamp = ?, 
                    version = ?, hash = ?, is_latest = ?
                WHERE id = ?
            `),

            // Pages
            insertPage: this.db.prepare('INSERT INTO pages (id, url, title, timestamp) VALUES (?, ?, ?, ?)'),
            getPage: this.db.prepare('SELECT * FROM pages WHERE id = ?'),
            getPageByUrl: this.db.prepare('SELECT * FROM pages WHERE url = ?'),

            // Page Source Maps
            insertPageSourceMap: this.db.prepare(
                'INSERT INTO page_source_maps (id, page_id, source_map_id, timestamp) VALUES (?, ?, ?, ?)'
            ),
            getPageSourceMaps: this.db.prepare('SELECT * FROM page_source_maps WHERE page_id = ?'),

            // Settings
            getSettings: this.db.prepare('SELECT * FROM settings ORDER BY id DESC LIMIT 1'),
            insertSettings: this.db.prepare(`
                INSERT INTO settings (id, dark_mode, auto_collect, auto_cleanup, cleanup_threshold,
                    retention_days, collect_js, collect_css, max_file_size, max_total_size,
                    max_files, enable_desktop_app)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `),
            updateSettings: this.db.prepare(`
                UPDATE settings SET
                dark_mode = ?, auto_collect = ?, auto_cleanup = ?, cleanup_threshold = ?,
                retention_days = ?, collect_js = ?, collect_css = ?, max_file_size = ?,
                max_total_size = ?, max_files = ?, enable_desktop_app = ?
                WHERE id = ?
            `),

            // CRX Files
            insertCrxFile: this.db.prepare(`
                INSERT INTO crx_files (id, page_url, page_title, crx_url, blob, size, timestamp, count)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `),
            getCrxFile: this.db.prepare('SELECT * FROM crx_files WHERE id = ?'),
            getCrxFileByUrl: this.db.prepare('SELECT * FROM crx_files WHERE page_url = ?'),
            updateCrxFile: this.db.prepare(`
                UPDATE crx_files
                SET blob = ?, size = ?, timestamp = ?, count = ?
                WHERE id = ?
            `),

            // Stats
            getSourceMapFilesCount: this.db.prepare('SELECT COUNT(*) as count FROM source_map_files'),
            getPagesCount: this.db.prepare('SELECT COUNT(*) as count FROM pages'),
            getTotalSize: this.db.prepare('SELECT SUM(size) as total FROM source_map_files'),
            getOldestTimestamp: this.db.prepare('SELECT MIN(timestamp) as oldest FROM source_map_files'),
            getUniqueSites: this.db.prepare('SELECT COUNT(DISTINCT url) as count FROM pages')
        };
    }

    // Source Map Files
    addSourceMapFile(file: Omit<SourceMapFile, 'id'>): SourceMapFile {
        const id = crypto.randomUUID();
        this.statements.insertSourceMapFile.run(
            id, file.url, file.sourceMapUrl, file.content, file.originalContent,
            file.fileType, file.size, file.timestamp, file.version, file.hash,
            file.isLatest ? 1 : 0
        );
        return { ...file, id };
    }

    getSourceMapFile(id: string): SourceMapFile | undefined {
        const result = this.statements.getSourceMapFile.get(id) as SourceMapFile | undefined;
        if (result) {
            result.isLatest = Boolean(result.isLatest);
        }
        return result;
    }

    getSourceMapFileByUrl(url: string): SourceMapFile | undefined {
        const result = this.statements.getSourceMapFileByUrl.get(url) as SourceMapFile | undefined;
        if (result) {
            result.isLatest = Boolean(result.isLatest);
        }
        return result;
    }

    getLatestSourceMapFiles(): SourceMapFile[] {
        const results = this.statements.getLatestSourceMapFiles.all() as SourceMapFile[];
        return results.map(result => ({
            ...result,
            isLatest: Boolean(result.isLatest)
        }));
    }

    // Pages
    addPage(page: Omit<Page, 'id'>): Page {
        const id = crypto.randomUUID();
        this.statements.insertPage.run(id, page.url, page.title, page.timestamp);
        return { ...page, id };
    }

    getPage(id: string): Page | undefined {
        return this.statements.getPage.get(id) as Page | undefined;
    }

    getPageByUrl(url: string): Page | undefined {
        return this.statements.getPageByUrl.get(url) as Page | undefined;
    }

    // Page Source Maps
    addPageSourceMap(map: Omit<PageSourceMap, 'id'>): PageSourceMap {
        const id = crypto.randomUUID();
        this.statements.insertPageSourceMap.run(id, map.pageId, map.sourceMapId, map.timestamp);
        return { ...map, id };
    }

    getPageSourceMaps(pageId: string): PageSourceMap[] {
        return this.statements.getPageSourceMaps.all(pageId) as PageSourceMap[];
    }

    // Settings
    getSettings(): AppSettings {
        const settings = this.statements.getSettings.get() as AppSettings | undefined;
        if (!settings) {
            const defaultSettings: AppSettings = {
                id: crypto.randomUUID(),
                darkMode: false,
                autoCollect: true,
                autoCleanup: false,
                cleanupThreshold: 1000,
                retentionDays: 30,
                collectJs: true,
                collectCss: true,
                maxFileSize: 10485760,
                maxTotalSize: 104857600,
                maxFiles: 1000,
                enableDesktopApp: false
            };
            this.statements.insertSettings.run(
                defaultSettings.id, defaultSettings.darkMode ? 1 : 0,
                defaultSettings.autoCollect ? 1 : 0, defaultSettings.autoCleanup ? 1 : 0,
                defaultSettings.cleanupThreshold, defaultSettings.retentionDays,
                defaultSettings.collectJs ? 1 : 0, defaultSettings.collectCss ? 1 : 0,
                defaultSettings.maxFileSize, defaultSettings.maxTotalSize,
                defaultSettings.maxFiles, defaultSettings.enableDesktopApp ? 1 : 0
            );
            return defaultSettings;
        }
        return {
            ...settings,
            darkMode: Boolean(settings.darkMode),
            autoCollect: Boolean(settings.autoCollect),
            autoCleanup: Boolean(settings.autoCleanup),
            collectJs: Boolean(settings.collectJs),
            collectCss: Boolean(settings.collectCss),
            enableDesktopApp: Boolean(settings.enableDesktopApp)
        };
    }

    updateSettings(settings: AppSettings): void {
        this.statements.updateSettings.run(
            settings.darkMode ? 1 : 0, settings.autoCollect ? 1 : 0,
            settings.autoCleanup ? 1 : 0, settings.cleanupThreshold,
            settings.retentionDays, settings.collectJs ? 1 : 0,
            settings.collectCss ? 1 : 0, settings.maxFileSize,
            settings.maxTotalSize, settings.maxFiles,
            settings.enableDesktopApp ? 1 : 0, settings.id
        );
    }

    // CRX Files
    addCrxFile(file: Omit<CrxFile, 'id'>): CrxFile {
        const id = crypto.randomUUID();
        this.statements.insertCrxFile.run(
            id, file.pageUrl, file.pageTitle, file.crxUrl,
            file.blob, file.size, file.timestamp, file.count
        );
        return { ...file, id };
    }

    getCrxFile(id: string): CrxFile | undefined {
        const result = this.statements.getCrxFile.get(id) as CrxFile | undefined;
        if (result) {
            result.blob = Buffer.from(result.blob as unknown as Buffer);
        }
        return result;
    }

    getCrxFileByUrl(url: string): CrxFile | undefined {
        const result = this.statements.getCrxFileByUrl.get(url) as CrxFile | undefined;
        if (result) {
            result.blob = Buffer.from(result.blob as unknown as Buffer);
        }
        return result;
    }

    updateCrxFile(file: CrxFile): void {
        this.statements.updateCrxFile.run(
            file.blob, file.size, file.timestamp,
            file.count, file.id
        );
    }

    // Stats
    getStorageStats(): StorageStats {
        const fileCount = (this.statements.getSourceMapFilesCount.get() as { count: number }).count;
        const pagesCount = (this.statements.getPagesCount.get() as { count: number }).count;
        const totalSize = (this.statements.getTotalSize.get() as { total: number | null }).total || 0;
        const oldestTimestamp = (this.statements.getOldestTimestamp.get() as { oldest: number | null }).oldest || Date.now();
        const uniqueSiteCount = (this.statements.getUniqueSites.get() as { count: number }).count;

        return {
            usedSpace: totalSize,
            totalSize,
            fileCount,
            uniqueSiteCount,
            pagesCount,
            oldestTimestamp
        };
    }
} 