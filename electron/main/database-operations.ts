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
    cleanupThreshold: number;
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
            getSettings: this.db.prepare('SELECT * FROM settings LIMIT 1'),
            insertSettings: this.db.prepare('INSERT INTO settings (cleanup_threshold) VALUES (?)'),
            updateSettings: this.db.prepare('UPDATE settings SET cleanup_threshold = ?'),

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
                cleanupThreshold: 128 * 1024 * 1024 // 128GB
            };
            this.statements.insertSettings.run(defaultSettings.cleanupThreshold);
            return defaultSettings;
        }
        return settings;
    }

    async updateSettings(settings: Partial<AppSettings>): Promise<void> {
        const result = this.statements.updateSettings.run(
            settings.cleanupThreshold
        );
        if (result.changes === 0) {
            throw new Error('Settings not found');
        }
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

    // Add new methods for sync status
    async updateSyncTimestamp(table: string, timestamp: number): Promise<void> {
        const sql = `INSERT INTO sync_status (table_name, timestamp) 
                    VALUES ('${table}', ${timestamp})
                    ON CONFLICT(table_name) DO UPDATE SET timestamp = excluded.timestamp`;
        await this.db.exec(sql);
    }

    async getLastSyncTimestamp(table: string): Promise<number> {
        const sql = `SELECT timestamp FROM sync_status WHERE table_name = '${table}'`;
        const result = await this.db.exec(sql);
        const rows = result as unknown as Array<{ timestamp: number }>;
        return rows[0]?.timestamp || 0;
    }

    // Add method to initialize sync status table
    async initializeSyncTable(): Promise<void> {
        await this.db.exec(`
            CREATE TABLE IF NOT EXISTS sync_status (
                table_name TEXT PRIMARY KEY,
                timestamp INTEGER NOT NULL
            )
        `);
    }
} 