import JSZip from 'jszip';
import { SourceMapFile } from '@/types';

/**
 * Format file size to human readable string
 */
export function formatFileSize(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
        size /= 1024;
        unitIndex++;
    }

    return `${size.toFixed(2)} ${units[unitIndex]}`;
}

/**
 * Create a download URL for a file
 */
export function createDownloadUrl(file: SourceMapFile): string {
    const blob = new Blob([file.content], { type: 'application/json' });
    return URL.createObjectURL(blob);
}

/**
 * Clean up a download URL
 */
export function revokeDownloadUrl(url: string): void {
    URL.revokeObjectURL(url);
}

/**
 * Format a timestamp to a readable date string
 */
export function formatDate(timestamp: number): string {
    return new Date(timestamp).toLocaleString();
}

/**
 * Create a ZIP file containing sourcemaps
 */
export async function createZipFile(files: SourceMapFile[]): Promise<Blob> {
    const zip = new JSZip();

    // Group files by type
    const jsFiles = files.filter(f => f.fileType === 'js');
    const cssFiles = files.filter(f => f.fileType === 'css');

    // Add JS files
    if (jsFiles.length > 0) {
        const jsFolder = zip.folder('js');
        jsFiles.forEach(file => {
            const fileName = new URL(file.url).pathname.split('/').pop() || 'unknown.js.map';
            jsFolder?.file(fileName, file.content);
        });
    }

    // Add CSS files
    if (cssFiles.length > 0) {
        const cssFolder = zip.folder('css');
        cssFiles.forEach(file => {
            const fileName = new URL(file.url).pathname.split('/').pop() || 'unknown.css.map';
            cssFolder?.file(fileName, file.content);
        });
    }

    // Generate metadata.json
    const metadata = {
        timestamp: Date.now(),
        fileCount: files.length,
        files: files.map(f => ({
            url: f.url,
            sourceMapUrl: f.sourceMapUrl,
            fileType: f.fileType,
            size: f.size
        }))
    };
    zip.file('metadata.json', JSON.stringify(metadata, null, 2));

    return await zip.generateAsync({ type: 'blob' });
}

/**
 * Get icon for file type
 */
export function getFileTypeIcon(fileType: 'js' | 'css'): string {
    return fileType === 'js' ? '📄' : '🎨';
}

/**
 * Extract filename from URL
 */
export function getFileNameFromUrl(url: string): string {
    try {
        const urlObj = new URL(url);
        const fileName = urlObj.pathname.split('/').pop();
        return fileName || 'unknown';
    } catch {
        return 'unknown';
    }
}

/**
 * Create a hash for a given string
 */
export function createHash(algorithm: string) {
    const encoder = new TextEncoder();

    return {
        update(data: string) {
            const buffer = encoder.encode(data);
            return {
                async digest(encoding: string) {
                    const hashBuffer = await crypto.subtle.digest(algorithm.toUpperCase(), buffer);
                    const hashArray = Array.from(new Uint8Array(hashBuffer));
                    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
                }
            };
        }
    };
} 