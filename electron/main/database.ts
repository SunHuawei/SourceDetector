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
            CREATE TABLE IF NOT EXISTS source_map_files (
                id TEXT PRIMARY KEY,
                url TEXT NOT NULL,
                source_map_url TEXT NOT NULL,
                content TEXT NOT NULL,
                original_content TEXT NOT NULL,
                file_type TEXT CHECK(file_type IN ('js', 'css')) NOT NULL,
                size INTEGER NOT NULL,
                timestamp INTEGER NOT NULL,
                version INTEGER NOT NULL,
                hash TEXT NOT NULL,
                is_latest BOOLEAN NOT NULL
            );

            CREATE TABLE IF NOT EXISTS pages (
                id TEXT PRIMARY KEY,
                url TEXT NOT NULL,
                title TEXT NOT NULL,
                timestamp INTEGER NOT NULL
            );

            CREATE TABLE IF NOT EXISTS page_source_maps (
                id TEXT PRIMARY KEY,
                page_id TEXT NOT NULL,
                source_map_id TEXT NOT NULL,
                timestamp INTEGER NOT NULL,
                FOREIGN KEY (page_id) REFERENCES pages(id) ON DELETE CASCADE,
                FOREIGN KEY (source_map_id) REFERENCES source_map_files(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS settings (
                cleanup_threshold INTEGER NOT NULL DEFAULT 1000
            );

            CREATE TABLE IF NOT EXISTS crx_files (
                id TEXT PRIMARY KEY,
                page_url TEXT NOT NULL,
                page_title TEXT NOT NULL,
                crx_url TEXT NOT NULL,
                blob BLOB NOT NULL,
                size INTEGER NOT NULL,
                timestamp INTEGER NOT NULL,
                count INTEGER NOT NULL DEFAULT 0
            );

            CREATE INDEX IF NOT EXISTS idx_source_map_files_url ON source_map_files(url);
            CREATE INDEX IF NOT EXISTS idx_source_map_files_timestamp ON source_map_files(timestamp);
            CREATE INDEX IF NOT EXISTS idx_pages_url ON pages(url);
            CREATE INDEX IF NOT EXISTS idx_pages_timestamp ON pages(timestamp);
            CREATE INDEX IF NOT EXISTS idx_page_source_maps_page_id ON page_source_maps(page_id);
            CREATE INDEX IF NOT EXISTS idx_page_source_maps_source_map_id ON page_source_maps(source_map_id);
            CREATE INDEX IF NOT EXISTS idx_crx_files_page_url ON crx_files(page_url);
        `
    },
    {
        version: 2,
        sql: `
            CREATE TABLE IF NOT EXISTS sync_status (
                table_name TEXT PRIMARY KEY,
                timestamp INTEGER NOT NULL
            );

            -- Initialize sync status for all tables
            INSERT OR IGNORE INTO sync_status (table_name, timestamp) VALUES
                ('sourceMapFiles', 0),
                ('pages', 0),
                ('pageSourceMaps', 0),
                ('settings', 0),
                ('crxFiles', 0);
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
    
    // Initialize database
    db = new Database(dbPath, {
        verbose: process.env.NODE_ENV === 'development' ? console.log : undefined
    });

    // Enable foreign keys and WAL mode for better performance
    db.pragma('foreign_keys = ON');
    db.pragma('journal_mode = WAL');

    // Run migrations
    runMigrations(db);

    return db;
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