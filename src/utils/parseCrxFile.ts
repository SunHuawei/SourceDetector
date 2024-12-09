import JSZip from 'jszip';
import { crxToZip } from './crx-to-zip';
import { ParsedCrxFile, CrxFile } from '../types';

const CACHE_EXPIRATION = 5000; // 5 seconds
const cache = new Map<string, ParsedCrxFile>();

export async function parsedCrxFileFromCrxFile(crxFile: CrxFile): Promise<ParsedCrxFile | null> {
    const blob = crxFile.blob;
    return parsedCrxFileFromBlob(blob, crxFile.timestamp);
}

export async function parsedCrxFileFromBlob(blob: Blob, timestamp: number): Promise<ParsedCrxFile | null> {
    console.log('blob', blob, typeof blob);
    const buffer = await blob.arrayBuffer();
    console.log('buffer', buffer);
    // Convert CRX to ZIP
    const { zip } = await crxToZip(buffer);
    console.log('zip', zip);
    const jszip = await JSZip.loadAsync(zip);
    console.log('jszip', jszip);
    const parsedFileCount = Object.values(jszip.files).filter(file => !file.dir).length;
    const size = zip.size;
    return {
        zip: jszip,
        count: parsedFileCount,
        timestamp,
        blob,
        size
    };
}

export async function parsedCrxFileFromUrl(crxUrl: string): Promise<ParsedCrxFile | null> {
    try {
        console.log('parseCrxFile', crxUrl);
        const cached = cache.get(crxUrl);
        console.log('cached', cached);
        if (cached && (Date.now() - cached.timestamp) < CACHE_EXPIRATION) {
            console.log('cached', cached);
            return cached;
        }

        const response = await fetch(crxUrl);
        console.log('response', response);
        const blob = await response.blob();

        const result = await parsedCrxFileFromBlob(blob, Date.now());

        if (result) {
            cache.set(crxUrl, result);
        }

        return result;
    } catch (error) {
        console.error('Error parsing CRX file:', error);
        return null;
    }
}

// Parse CRX file and extract source maps
export async function parseCrxFile(crxUrl: string): Promise<ParsedCrxFile | null> {
    if (typeof crxUrl === 'object') {
        return parsedCrxFileFromCrxFile(crxUrl);
    } else {
        return parsedCrxFileFromUrl(crxUrl);
    }
}
