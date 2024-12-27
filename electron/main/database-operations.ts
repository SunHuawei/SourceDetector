import BetterSqlite3, { Statement } from 'better-sqlite3';
import crypto from 'crypto';

// Types
export interface AppSettings {
    id: string;
    cleanupThreshold: number;
}

export interface StorageStats {
    usedSpace: number;
    totalSize: number;
    fileCount: number;
    uniqueSiteCount: number;
    pagesCount: number;
    oldestTimestamp: number;
}

export interface SourceMapFile {
    id: number;
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
    id: number;
    url: string;
    title: string;
    timestamp: number;
}

export interface PageSourceMap {
    id: number;
    pageId: number;
    sourceMapId: number;
    timestamp: number;
}

export interface CrxFile {
    id: number;
    pageUrl: string;
    pageTitle: string;
    crxUrl: string;
    blob: Buffer;
    size: number;
    timestamp: number;
    count: number;
    contentHash: string;
}

export class DatabaseOperations {
    private statements: {
        insertSourceMapFile: Statement;
        updateSourceMapFile: Statement;
        getSourceMapFile: Statement;
        getSourceMapFileByUrl: Statement;
        getSourceMapFiles: Statement;
        getLatestSourceMapFiles: Statement;
        insertPage: Statement;
        getPage: Statement;
        getPageByUrl: Statement;
        getPages: Statement;
        insertPageSourceMap: Statement;
        getPageSourceMap: Statement;
        getPageSourceMaps: Statement;
        insertCrxFile: Statement;
        updateCrxFile: Statement;
        getCrxFile: Statement;
        getCrxFileByUrl: Statement;
        getCrxFiles: Statement;
        getSettings: Statement;
        updateSettings: Statement;
    };

    constructor(private db: BetterSqlite3.Database) {
        this.statements = {
            insertSourceMapFile: this.db.prepare(`
                INSERT INTO sourceMapFiles (
                    id, url, sourceMapUrl, content, originalContent, fileType, size, timestamp, version, hash, isLatest
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `),

            updateSourceMapFile: this.db.prepare(`
                UPDATE sourceMapFiles 
                SET content = ?, originalContent = ?, fileType = ?, size = ?, timestamp = ?, 
                version = ?, hash = ?, isLatest = ?
                WHERE id = ?`),

            getSourceMapFile: this.db.prepare('SELECT * FROM sourceMapFiles WHERE id = ?'),
            getSourceMapFileByUrl: this.db.prepare('SELECT * FROM sourceMapFiles WHERE url = ?'),
            getSourceMapFiles: this.db.prepare('SELECT * FROM sourceMapFiles'),
            getLatestSourceMapFiles: this.db.prepare('SELECT * FROM sourceMapFiles WHERE isLatest = 1'),

            insertPage: this.db.prepare(`
                INSERT INTO pages (
                    id, url, title, timestamp
                ) VALUES (?, ?, ?, ?)
            `),
            getPage: this.db.prepare('SELECT * FROM pages WHERE id = ?'),
            getPageByUrl: this.db.prepare('SELECT * FROM pages WHERE url = ?'),
            getPages: this.db.prepare('SELECT * FROM pages'),

            insertPageSourceMap: this.db.prepare(`
                INSERT INTO pageSourceMaps (
                    id, pageId, sourceMapId, timestamp
                ) VALUES (?, ?, ?, ?)
            `),
            getPageSourceMap: this.db.prepare('SELECT * FROM pageSourceMaps WHERE id = ?'),
            getPageSourceMaps: this.db.prepare('SELECT * FROM pageSourceMaps WHERE pageId = ?'),

            insertCrxFile: this.db.prepare(`
                INSERT INTO crxFiles (
                    id, pageUrl, pageTitle, crxUrl, blob, size, timestamp, count, contentHash
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `),

            updateCrxFile: this.db.prepare(`
                UPDATE crxFiles 
                SET blob = ?, size = ?, timestamp = ?, count = ?
                WHERE id = ?`),

            getCrxFile: this.db.prepare('SELECT * FROM crxFiles WHERE id = ?'),
            getCrxFileByUrl: this.db.prepare('SELECT * FROM crxFiles WHERE pageUrl = ?'),
            getCrxFiles: this.db.prepare('SELECT * FROM crxFiles'),

            getSettings: this.db.prepare('SELECT * FROM settings LIMIT 1'),
            updateSettings: this.db.prepare('UPDATE settings SET cleanupThreshold = ?')
        };
    }

    // Add the missing methods
    getSourceMapFileByUrl(url: string): SourceMapFile | undefined {
        return this.statements.getSourceMapFileByUrl.get(url) as SourceMapFile | undefined;
    }

    getLatestSourceMapFiles(): SourceMapFile[] {
        return this.statements.getLatestSourceMapFiles.all() as SourceMapFile[];
    }

    getPageByUrl(url: string): Page | undefined {
        return this.statements.getPageByUrl.get(url) as Page | undefined;
    }

    getCrxFileByUrl(url: string): CrxFile | undefined {
        const result = this.statements.getCrxFileByUrl.get(url) as CrxFile | undefined;
        if (result) {
            result.blob = Buffer.from(result.blob as unknown as Buffer);
        }
        return result;
    }

    getSettings(): AppSettings {
        const settings = this.statements.getSettings.get() as AppSettings | undefined;
        return settings || { id: 'settings', cleanupThreshold: 1000 };
    }

    updateSettings(settings: Partial<AppSettings>): void {
        this.statements.updateSettings.run(settings.cleanupThreshold);
    }

    getStorageStats(): StorageStats {
        const sourceMapFiles = this.getSourceMapFiles();
        const pages = this.getPages();
        
        let totalSize = 0;
        let oldestTimestamp = Date.now();
        const uniqueSites = new Set<string>();

        for (const file of sourceMapFiles) {
            totalSize += file.size;
            if (file.timestamp < oldestTimestamp) {
                oldestTimestamp = file.timestamp;
            }
        }

        for (const page of pages) {
            try {
                uniqueSites.add(new URL(page.url).hostname);
            } catch {
                uniqueSites.add(page.url);
            }
        }

        return {
            usedSpace: totalSize,
            totalSize,
            fileCount: sourceMapFiles.length,
            uniqueSiteCount: uniqueSites.size,
            pagesCount: pages.length,
            oldestTimestamp
        };
    }

    addSourceMapFile(file: SourceMapFile): void {
        if (this.statements.getSourceMapFile.get(file.id)) {
            return;
        }
        this.statements.insertSourceMapFile.run(
            file.id,
            file.url,
            file.sourceMapUrl,
            file.content,
            file.originalContent,
            file.fileType,
            file.size,
            file.timestamp,
            file.version,
            file.hash,
            file.isLatest ? 1 : 0
        );
    }

    updateSourceMapFile(file: SourceMapFile): void {
        this.statements.updateSourceMapFile.run(
            file.content,
            file.originalContent,
            file.fileType,
            file.size,
            file.timestamp,
            file.version,
            file.hash,
            file.isLatest ? 1 : 0,
            file.id
        );
    }

    getSourceMapFile(id: number): SourceMapFile | undefined {
        const result = this.statements.getSourceMapFile.get(id) as SourceMapFile | undefined;
        if (result) {
            result.isLatest = Boolean(result.isLatest);
        }
        return result;
    }

    getSourceMapFiles(): SourceMapFile[] {
        const results = this.statements.getSourceMapFiles.all() as SourceMapFile[];
        return results.map(result => ({
            ...result,
            isLatest: Boolean(result.isLatest)
        }));
    }

    addPage(page: Page): void {
        if (this.statements.getPage.get(page.id)) {
            return;
        }
        this.statements.insertPage.run(page.id, page.url, page.title, page.timestamp);
    }

    getPage(id: number): Page | undefined {
        return this.statements.getPage.get(id) as Page | undefined;
    }

    getPages(): Page[] {
        return this.statements.getPages.all() as Page[];
    }

    addPageSourceMap(map: PageSourceMap): void {
        if (this.statements.getPageSourceMap.get(map.id)) {
            return;
        }
        this.statements.insertPageSourceMap.run(map.id, map.pageId, map.sourceMapId, map.timestamp);
    }

    getPageSourceMap(id: number): PageSourceMap | undefined {
        return this.statements.getPageSourceMap.get(id) as PageSourceMap | undefined;
    }

    getPageSourceMaps(pageId: number): PageSourceMap[] {
        return this.statements.getPageSourceMaps.all(pageId) as PageSourceMap[];
    }

    addCrxFile(file: CrxFile): void {
        if (this.statements.getCrxFile.get(file.id)) {
            return;
        }

        // Insert new record
        this.statements.insertCrxFile.run(
            file.id,
            file.pageUrl,
            file.pageTitle,
            file.crxUrl,
            file.blob,
            file.size,
            file.timestamp,
            file.count,
            file.contentHash
        );
    }

    updateCrxFile(file: CrxFile): void {
        this.statements.updateCrxFile.run(
            file.blob,
            file.size,
            file.timestamp,
            file.count,
            file.id
        );
    }

    getCrxFile(id: number): CrxFile | undefined {
        const result = this.statements.getCrxFile.get(id) as CrxFile | undefined;
        if (result) {
            result.blob = Buffer.from(result.blob as unknown as Buffer);
        }
        return result;
    }

    getCrxFiles(): CrxFile[] {
        const results = this.statements.getCrxFiles.all() as CrxFile[];
        return results.map(result => ({
            ...result,
            blob: Buffer.from(result.blob as unknown as Buffer)
        }));
    }

    getModifiedData(table: string, lastId: number, chunkSize: number): any[] {
        const tableMap = {
            sourceMapFiles: 'SELECT * FROM sourceMapFiles WHERE id > ? ORDER BY id LIMIT ?',
            pages: 'SELECT * FROM pages WHERE id > ? ORDER BY id LIMIT ?',
            pageSourceMaps: 'SELECT * FROM pageSourceMaps WHERE id > ? ORDER BY id LIMIT ?',
            crxFiles: 'SELECT * FROM crxFiles WHERE id > ? ORDER BY id LIMIT ?'
        };

        const query = tableMap[table as keyof typeof tableMap];
        if (!query) return [];

        const results = this.db.prepare(query).all(lastId, chunkSize);
        if (table === 'sourceMapFiles') {
            return (results as SourceMapFile[]).map(result => ({
                ...result,
                isLatest: Boolean(result.isLatest)
            }));
        } else if (table === 'crxFiles') {
            return (results as CrxFile[]).map(result => ({
                ...result,
                blob: Buffer.from(result.blob as unknown as Buffer)
            }));
        }
        return results;
    }
} 