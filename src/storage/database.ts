import Dexie, { Table } from 'dexie';
import { SourceMapFile, AppSettings } from '@/types';
import { DEFAULT_SETTINGS } from '@/background/constants';

export class SourceCollectorDB extends Dexie {
    sourceMapFiles!: Table<SourceMapFile>;
    settings!: Table<AppSettings>;

    constructor() {
        super('SourceCollectorDB');
        this.version(1).stores({
            sourceMapFiles: '++id, url, sourceMapUrl, fileType, pageUrl, timestamp',
            settings: '++id'
        });
    }

    async getSettings(): Promise<AppSettings> {
        const settings = await this.settings.toArray();
        return settings[0] || DEFAULT_SETTINGS;
    }

    async updateSettings(settings: Partial<AppSettings>): Promise<void> {
        const currentSettings = await this.getSettings();
        const updatedSettings = { ...currentSettings, ...settings };
        await this.settings.clear();
        await this.settings.add(updatedSettings);
    }

    async getStorageStats() {
        const files = await this.sourceMapFiles.toArray();
        const totalSize = files.reduce((sum, file) => sum + file.size, 0);
        const oldestFile = files.reduce((oldest, file) =>
            file.timestamp < oldest.timestamp ? file : oldest
            , files[0]);

        return {
            usedSpace: totalSize,
            totalSize: totalSize,
            fileCount: files.length,
            oldestTimestamp: oldestFile?.timestamp || Date.now()
        };
    }
} 