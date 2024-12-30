import BetterSqlite3, { Statement } from 'better-sqlite3';
import crypto from 'crypto';

// Types
export interface AppSettings {
    id: string;
    cleanupThreshold: number;
}

export interface ParsedSourceFile {
    id: number;
    path: string;
    content: string;
    sourceMapFileId: number;
    timestamp: number;
}

export interface ParsedCrxFile {
    id: number;
    path: string;
    content: string;
    crxFileId: number;
    size: number;
    timestamp: number;
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
    isParsed: boolean;
}

export interface Domain {
    id: number;
    domain: string;
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
        insertDomain: Statement;
        getDomain: Statement;
        getDomains: Statement;
        insertParsedCrxFile: Statement;
        getParsedCrxFiles: Statement;
    };

    constructor(private db: BetterSqlite3.Database) {
        this.statements = {
            insertSourceMapFile: this.db.prepare(`
                INSERT INTO sourceMapFiles (
                    id, url, sourceMapUrl, content, originalContent, fileType, size, timestamp, version, hash, isLatest, isParsed
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `),

            updateSourceMapFile: this.db.prepare(`
                UPDATE sourceMapFiles 
                SET content = ?, originalContent = ?, fileType = ?, size = ?, timestamp = ?, 
                version = ?, hash = ?, isLatest = ?, isParsed = ?
                WHERE id = ?`),

            getSourceMapFile: this.db.prepare('SELECT * FROM sourceMapFiles WHERE id = ?'),
            getSourceMapFileByUrl: this.db.prepare('SELECT * FROM sourceMapFiles WHERE url = ?'),
            getSourceMapFiles: this.db.prepare('SELECT * FROM sourceMapFiles'),
            getLatestSourceMapFiles: this.db.prepare('SELECT * FROM sourceMapFiles WHERE isLatest = 1'),

            insertPage: this.db.prepare(`
                INSERT INTO pages (
                    id, url, title, domainId, timestamp
                ) VALUES (?, ?, ?, ?, ?)
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
            updateSettings: this.db.prepare('UPDATE settings SET cleanupThreshold = ?'),

            insertDomain: this.db.prepare('INSERT INTO domains (domain, timestamp) VALUES (?, ?)'),
            getDomain: this.db.prepare('SELECT * FROM domains WHERE domain = ?'),
            getDomains: this.db.prepare('SELECT * FROM domains'),

            insertParsedCrxFile: this.db.prepare(`
                INSERT INTO parsedCrxFiles (
                    path, content, crxFileId, size, timestamp
                ) VALUES (?, ?, ?, ?, ?)
            `),
            getParsedCrxFiles: this.db.prepare('SELECT * FROM parsedCrxFiles WHERE crxFileId = ?'),
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
            file.isLatest ? 1 : 0,
            file.isParsed ? 1 : 0
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
            file.isParsed ? 1 : 0,
            file.id
        );
    }

    getSourceMapFile(id: number): SourceMapFile | undefined {
        const result = this.statements.getSourceMapFile.get(id) as SourceMapFile | undefined;
        if (result) {
            result.isLatest = Boolean(result.isLatest);
            result.isParsed = Boolean(result.isParsed);
        }
        return result;
    }

    getSourceMapFiles(): SourceMapFile[] {
        const results = this.statements.getSourceMapFiles.all() as SourceMapFile[];
        return results.map(result => ({
            ...result,
            isLatest: Boolean(result.isLatest),
            isParsed: Boolean(result.isParsed)
        }));
    }

    addDomain(domain: string): number {
        const foundDomain = this.statements.getDomain.get(domain) as Domain | undefined;
        if (foundDomain) {
            return foundDomain.id;
        }
        this.statements.insertDomain.run(domain, Date.now());
        return (this.statements.getDomain.get(domain) as Domain).id;
    }

    addPage(page: Page): void {
        if (this.statements.getPage.get(page.id)) {
            return;
        }

        const domain = new URL(page.url).hostname;
        const domainId = this.addDomain(domain);

        this.statements.insertPage.run(page.id, page.url, page.title, domainId, page.timestamp);
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

    // Source Tree Methods
    getDomains(offset: number, limit: number): { domains: Domain[]; total: number } {
        const stmt = this.db.prepare<[number, number], { id: number; domain: string }>(
            `SELECT id, domain
             FROM domains
             ORDER BY domain
             LIMIT ? OFFSET ?`
        );
        const results = stmt.all(limit, offset);
        const domains = results.map(row => ({
            id: row.id,
            domain: row.domain
        }));

        const totalStmt = this.db.prepare<[], { total: number }>(
            `SELECT COUNT(*) as total FROM domains`
        );
        const [totalRow] = totalStmt.all();

        return { domains, total: totalRow.total };
    }

    getPagesByDomain(domainId: number, offset: number, limit: number): { pages: Page[]; total: number } {
        const stmt = this.db.prepare<[number, number, number], Page>(
            `SELECT id, url, title, timestamp
             FROM pages
             WHERE domainId = ?
             ORDER BY timestamp DESC
             LIMIT ? OFFSET ?`
        );
        const pages = stmt.all(domainId, limit, offset);

        const totalStmt = this.db.prepare<[number], { total: number }>(
            `SELECT COUNT(*) as total
             FROM pages
             WHERE domainId = ?`
        );
        const [totalRow] = totalStmt.all(domainId);

        return { pages, total: totalRow.total };
    }

    getSourceMapsByPage(pageId: string, offset: number, limit: number): { sourceMaps: SourceMapFile[]; total: number } {
        const stmt = this.db.prepare<[string, number, number], SourceMapFile>(
            `SELECT sm.id, sm.url, sm.sourceMapUrl, sm.content, sm.originalContent, sm.fileType,
                    sm.size, sm.timestamp, sm.version, sm.hash, sm.isLatest
             FROM sourceMapFiles sm
             JOIN pageSourceMaps psm ON sm.id = psm.sourceMapId
             WHERE psm.pageId = ?
             ORDER BY sm.timestamp DESC
             LIMIT ? OFFSET ?`
        );
        const sourceMaps = stmt.all(pageId, limit, offset);

        const totalStmt = this.db.prepare<[string], { total: number }>(
            `SELECT COUNT(*) as total
             FROM sourceMapFiles sm
             JOIN pageSourceMaps psm ON sm.id = psm.sourceMapId
             WHERE psm.pageId = ?`
        );
        const [totalRow] = totalStmt.all(pageId);

        return { sourceMaps, total: totalRow.total };
    }

    // Parsed Source Files
    createParsedSourceFiles(sourceMapFileId: number, files: Array<{ path: string; content: string }>): void {
        const timestamp = Date.now();
        const stmt = this.db.prepare(`
            INSERT INTO parsedSourceFiles (path, content, sourceMapFileId, timestamp)
            VALUES (@path, @content, @sourceMapFileId, @timestamp)
        `);

        const transaction = this.db.transaction((files: Array<{ path: string; content: string }>) => {
            for (const file of files) {
                stmt.run({
                    path: file.path,
                    content: file.content,
                    sourceMapFileId,
                    timestamp
                });
            }
        });

        transaction(files);
    }

    getParsedSourceFiles(sourceMapFileId: number): ParsedSourceFile[] {
        return this.db.prepare(`
            SELECT id, path, content, sourceMapFileId, timestamp
            FROM parsedSourceFiles
            WHERE sourceMapFileId = ?
            ORDER BY path
        `).all(sourceMapFileId) as ParsedSourceFile[];
    }

    createParsedCrxFiles(crxFileId: number, files: Array<{ path: string; content: string; size: number }>): void {
        const timestamp = Date.now();
        const stmt = this.db.prepare(`
            INSERT INTO parsedCrxFiles (path, content, crxFileId, size, timestamp)
            VALUES (@path, @content, @crxFileId, @size, @timestamp)
        `);

        const transaction = this.db.transaction((files: Array<{ path: string; content: string; size: number }>) => {
            for (const file of files) {
                stmt.run({
                    path: file.path,
                    content: file.content,
                    crxFileId,
                    size: file.size,
                    timestamp
                });
            }
        });

        transaction(files);
    }

    getParsedCrxFiles(crxFileId: number): ParsedCrxFile[] {
        return this.db.prepare(`
            SELECT id, path, content, crxFileId, size, timestamp
            FROM parsedCrxFiles
            WHERE crxFileId = ?
            ORDER BY path
        `).all(crxFileId) as ParsedCrxFile[];
    }
} 