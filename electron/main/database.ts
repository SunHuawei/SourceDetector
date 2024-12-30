import { app } from 'electron';
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

// Database types
export interface Migration {
    version: number;
    sql: string;
}

// Database migrations
const migrations: Migration[] = [
    {
        version: 1,
        sql: `
            CREATE TABLE IF NOT EXISTS sourceMapFiles (
                id INTEGER PRIMARY KEY,
                url TEXT NOT NULL,
                sourceMapUrl TEXT NOT NULL,
                content TEXT NOT NULL,
                originalContent TEXT NOT NULL,
                fileType TEXT NOT NULL,
                size INTEGER NOT NULL,
                timestamp INTEGER NOT NULL,
                version INTEGER NOT NULL,
                hash TEXT NOT NULL,
                isLatest INTEGER NOT NULL,
                isParsed INTEGER NOT NULL DEFAULT 0
            );

            CREATE TABLE IF NOT EXISTS parsedSourceFiles (
                id INTEGER PRIMARY KEY,
                path TEXT NOT NULL,
                content TEXT NOT NULL,
                sourceMapFileId INTEGER NOT NULL,
                timestamp INTEGER NOT NULL,
                FOREIGN KEY (sourceMapFileId) REFERENCES sourceMapFiles(id)
            );

            CREATE TABLE IF NOT EXISTS domains (
                id INTEGER PRIMARY KEY,
                domain TEXT NOT NULL,
                timestamp INTEGER NOT NULL
            );

            CREATE TABLE IF NOT EXISTS pages (
                id INTEGER PRIMARY KEY,
                url TEXT NOT NULL,
                title TEXT NOT NULL,
                domainId INTEGER NOT NULL,
                timestamp INTEGER NOT NULL,
                FOREIGN KEY (domainId) REFERENCES domains(id)
            );

            CREATE TABLE IF NOT EXISTS pageSourceMaps (
                id INTEGER PRIMARY KEY,
                pageId INTEGER NOT NULL,
                sourceMapId INTEGER NOT NULL,
                timestamp INTEGER NOT NULL,
                FOREIGN KEY (pageId) REFERENCES pages(id),
                FOREIGN KEY (sourceMapId) REFERENCES sourceMapFiles(id)
            );

            CREATE TABLE IF NOT EXISTS settings (
                cleanupThreshold INTEGER NOT NULL
            );

            CREATE TABLE IF NOT EXISTS crxFiles (
                id INTEGER PRIMARY KEY,
                pageUrl TEXT NOT NULL UNIQUE,
                pageTitle TEXT NOT NULL,
                crxUrl TEXT NOT NULL,
                blob BLOB NOT NULL,
                size INTEGER NOT NULL,
                timestamp INTEGER NOT NULL,
                count INTEGER NOT NULL DEFAULT 1,
                contentHash TEXT NOT NULL
            );

            CREATE INDEX IF NOT EXISTS idx_sourceMapFiles_url ON sourceMapFiles(url);
            CREATE INDEX IF NOT EXISTS idx_sourceMapFiles_timestamp ON sourceMapFiles(timestamp);
            CREATE INDEX IF NOT EXISTS idx_parsedSourceFiles_sourceMapFileId ON parsedSourceFiles(sourceMapFileId);
            CREATE INDEX IF NOT EXISTS idx_parsedSourceFiles_path ON parsedSourceFiles(path);
            CREATE INDEX IF NOT EXISTS idx_parsedSourceFiles_timestamp ON parsedSourceFiles(timestamp);
            CREATE INDEX IF NOT EXISTS idx_pages_url ON pages(url);
            CREATE INDEX IF NOT EXISTS idx_pages_timestamp ON pages(timestamp);
            CREATE INDEX IF NOT EXISTS idx_pageSourceMaps_pageId ON pageSourceMaps(pageId);
            CREATE INDEX IF NOT EXISTS idx_pageSourceMaps_sourceMapId ON pageSourceMaps(sourceMapId);
            CREATE INDEX IF NOT EXISTS idx_pageSourceMaps_timestamp ON pageSourceMaps(timestamp);
            CREATE INDEX IF NOT EXISTS idx_crxFiles_pageUrl ON crxFiles(pageUrl);
            CREATE INDEX IF NOT EXISTS idx_crxFiles_timestamp ON crxFiles(timestamp);
            CREATE INDEX IF NOT EXISTS idx_crxFiles_contentHash ON crxFiles(contentHash);
            CREATE INDEX IF NOT EXISTS idx_domains_domain ON domains(domain);
            CREATE INDEX IF NOT EXISTS idx_pages_domainId ON pages(domainId);
        `
    }
];

let db: Database.Database | null = null;
let dbPath: string | null = null;

export function getDatabasePath(): string | null {
    return dbPath;
}

export function initDatabase(): Database.Database {
    if (db) return db;

    // Ensure database directory exists
    const userDataPath = app.getPath('userData');
    const dbDir = path.join(userDataPath, 'database');
    if (!fs.existsSync(dbDir)) {
        fs.mkdirSync(dbDir, { recursive: true });
    }

    dbPath = path.join(dbDir, 'source-detector.sqlite');
    
    try {
        // Check if database file exists and is accessible
        if (fs.existsSync(dbPath)) {
            try {
                // Try to read the file to check if it's corrupted
                fs.accessSync(dbPath, fs.constants.R_OK | fs.constants.W_OK);
                
                // Try to open the database
                db = new Database(dbPath);
                
                // Test database connection
                db.prepare('SELECT 1').get();
            } catch (error) {
                console.error('Database file is corrupted or inaccessible:', error);
                
                // Backup corrupted file
                const backupPath = `${dbPath}.corrupted.${Date.now()}`;
                try {
                    fs.copyFileSync(dbPath, backupPath);
                    console.log(`Corrupted database backed up to ${backupPath}`);
                } catch (backupError) {
                    console.error('Failed to backup corrupted database:', backupError);
                }
                
                // Delete corrupted file
                fs.unlinkSync(dbPath);
                
                // Create new database
                db = new Database(dbPath);
            }
        } else {
            // Create new database if it doesn't exist
            db = new Database(dbPath);
        }

        // Enable foreign keys and WAL mode for better performance
        db.pragma('foreign_keys = ON');
        db.pragma('journal_mode = WAL');
        db.pragma('synchronous = NORMAL');
        db.pragma('temp_store = MEMORY');
        db.pragma('mmap_size = 30000000000');
        db.pragma('page_size = 32768');

        // Run migrations
        runMigrations(db);

        return db;
    } catch (error) {
        console.error('Failed to initialize database:', error);
        throw error;
    }
}

function runMigrations(db: Database.Database) {
    db.prepare(`
        CREATE TABLE IF NOT EXISTS migrations (
            version INTEGER PRIMARY KEY
        )
    `).run();

    const applied = db.prepare('SELECT version FROM migrations ORDER BY version').all() as { version: number }[];
    const appliedVersions = new Set(applied.map(m => m.version));

    const transaction = db.transaction(() => {
        for (const migration of migrations) {
            if (!appliedVersions.has(migration.version)) {
                console.log(`Running migration version ${migration.version}`);
                db.exec(migration.sql);
                db.prepare('INSERT INTO migrations (version) VALUES (?)').run(migration.version);
            }
        }
    });

    transaction();
}

export function closeDatabase() {
    if (db) {
        db.close();
        db = null;
    }
}

// Backup function
export function backupDatabase() {
    if (!db) return;

    const userDataPath = app.getPath('userData');
    const backupDir = path.join(userDataPath, 'database', 'backups');
    if (!fs.existsSync(backupDir)) {
        fs.mkdirSync(backupDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = path.join(backupDir, `backup-${timestamp}.sqlite`);

    try {
        db.backup(backupPath);
        console.log(`Database backed up to ${backupPath}`);

        // Clean up old backups (keep last 5)
        const backups = fs.readdirSync(backupDir)
            .filter(file => file.endsWith('.sqlite'))
            .map(file => path.join(backupDir, file));

        if (backups.length > 5) {
            backups
                .sort((a, b) => fs.statSync(a).mtime.getTime() - fs.statSync(b).mtime.getTime())
                .slice(0, backups.length - 5)
                .forEach(file => fs.unlinkSync(file));
        }
    } catch (error) {
        console.error('Database backup failed:', error);
    }
} 