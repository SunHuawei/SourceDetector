import JSZip from 'jszip';
import { crxToZip } from './crx-to-zip';
import { ParsedCrxFile, CrxFile } from '../types';

const CACHE_EXPIRATION = 5000; // 5 seconds
const cache = new Map<string, ParsedCrxFile>();

export async function parsedCrxFileFromCrxFile(crxFile: CrxFile): Promise<ParsedCrxFile | null> {
  const blob = crxFile.blob;
  return parsedCrxFileFromBlob(blob, crxFile.timestamp);
}

export async function parsedCrxFileFromBlob(
  blob: Blob,
  timestamp: number
): Promise<ParsedCrxFile | null> {
  const buffer = await blob.arrayBuffer();
  const { zip } = await crxToZip(buffer);
  const jszip = await JSZip.loadAsync(zip);
  const parsedFileCount = Object.values(jszip.files).filter(file => !file.dir).length;
  const size = zip.size;

  return {
    zip: jszip,
    count: parsedFileCount,
    timestamp,
    blob,
    size,
  };
}

export async function parsedCrxFileFromUrl(crxUrl: string): Promise<ParsedCrxFile | null> {
  try {
    const cached = cache.get(crxUrl);
    if (cached && Date.now() - cached.timestamp < CACHE_EXPIRATION) {
      return cached;
    }

    const response = await fetch(crxUrl);
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
export async function parseCrxFile(crxInput: string | CrxFile): Promise<ParsedCrxFile | null> {
  if (typeof crxInput === 'object') {
    return parsedCrxFileFromCrxFile(crxInput);
  } else {
    return parsedCrxFileFromUrl(crxInput);
  }
}
