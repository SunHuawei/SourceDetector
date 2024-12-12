import Dexie, { Table } from 'dexie';
import { SourceMapFile, AppSettings } from '@/types';
import { DEFAULT_SETTINGS, getDefaultSettingsWithSystemPreference } from '@/background/constants';

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
        if (settings.length === 0) {
            const defaultSettings = getDefaultSettingsWithSystemPreference();
            await this.settings.add(defaultSettings);
            return defaultSettings;
        }
        return settings[0];
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