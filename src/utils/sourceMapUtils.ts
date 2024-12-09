import { SourceMapFile } from '@/types';

export interface GroupedSourceMapFile {
    url: string;
    fileType: 'js' | 'css';
    versions: SourceMapFile[];
}

export function groupSourceMapFiles(files: SourceMapFile[]): GroupedSourceMapFile[] {
    const groups: { [key: string]: SourceMapFile[] } = {};
    
    // Group files by URL
    files.forEach(file => {
        if (!groups[file.url]) {
            groups[file.url] = [];
        }
        groups[file.url].push(file);
    });

    // Convert groups to array and sort versions
    return Object.entries(groups).map(([url, files]) => ({
        url,
        fileType: files[0].fileType,
        versions: files.sort((a, b) => b.version - a.version) // Sort by version descending
    }));
} 