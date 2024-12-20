import JSZip from 'jszip';
import { SourceMapConsumer } from 'source-map-js';
import { SourceMapFile } from '@/types';

interface DownloadOptions {
    onError?: (error: Error) => void;
}

export class SourceMapDownloader {
    private static async createZipWithSourceMap(
        file: SourceMapFile,
        zip: JSZip,
        compiledFolder: JSZip,
        sourceFolder: JSZip
    ) {
        // Parse the source map
        const rawSourceMap = JSON.parse(file.content);
        const consumer = new SourceMapConsumer(rawSourceMap);

        // Get full path including domain for compiled file
        const originalUrl = new URL(file.url);
        const compiledPath = `${originalUrl.hostname}${originalUrl.pathname}`;
        
        // Add original file and source map maintaining the full path structure
        compiledFolder.file(compiledPath, file.originalContent);
        compiledFolder.file(`${compiledPath}.map`, file.content);

        // Process source files maintaining their relative paths
        const processedPaths = new Set<string>();
        consumer.sources.forEach((sourcePath) => {
            if (processedPaths.has(sourcePath)) return;
            processedPaths.add(sourcePath);

            const sourceContent = consumer.sourceContentFor(sourcePath);
            if (sourceContent) {
                // Clean up source path (remove leading slash and any '../' or './')
                const cleanPath = sourcePath
                    .replace(/^\//, '') // Remove leading /
                    .replace(/^(\.\.\/)*/, '') // Remove leading ../
                    .replace(/^(\.\/)*/, ''); // Remove leading ./

                // Add to source folder with full path structure
                sourceFolder.file(cleanPath, sourceContent);
            }
        });

        return { compiledPath, originalUrl };
    }

    private static async downloadZip(zip: JSZip, fileName: string) {
        const zipBlob = await zip.generateAsync({ type: "blob" });
        const url = URL.createObjectURL(zipBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    static async downloadSingle(file: SourceMapFile, options?: DownloadOptions) {
        try {
            const zip = new JSZip();
            const compiledFolder = zip.folder("compiled");
            const sourceFolder = zip.folder("src");

            if (!compiledFolder || !sourceFolder) {
                throw new Error('Failed to create folders');
            }

            const { compiledPath, originalUrl } = await this.createZipWithSourceMap(
                file,
                zip,
                compiledFolder,
                sourceFolder
            );

            const domainName = originalUrl.hostname.replace(/[^a-zA-Z0-9]/g, '_');
            const fileName = `${domainName}_${compiledPath.split('/').pop()}_v${file.version}_with_sources.zip`;

            await this.downloadZip(zip, fileName);
        } catch (error) {
            console.error('Error downloading source map:', error);
            options?.onError?.(error as Error);
        }
    }

    static async downloadAllLatest(files: SourceMapFile[], pageUrl: string, options?: DownloadOptions) {
        try {
            const zip = new JSZip();
            const compiledFolder = zip.folder("compiled");
            const sourceFolder = zip.folder("src");

            if (!compiledFolder || !sourceFolder) {
                throw new Error('Failed to create folders');
            }

            // Process each file
            for (const file of files) {
                try {
                    await this.createZipWithSourceMap(
                        file,
                        zip,
                        compiledFolder,
                        sourceFolder
                    );
                } catch (error) {
                    console.error(`Error processing file ${file.url}:`, error);
                    // Continue with other files
                }
            }

            const domainName = new URL(pageUrl).hostname.replace(/[^a-zA-Z0-9]/g, '_');
            const fileName = `${domainName}_all_latest_source_maps.zip`;

            await this.downloadZip(zip, fileName);
        } catch (error) {
            console.error('Error downloading source maps:', error);
            options?.onError?.(error as Error);
        }
    }
} 