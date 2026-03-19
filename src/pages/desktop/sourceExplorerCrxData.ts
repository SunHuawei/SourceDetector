import { CrxFile } from '@/types';

const EXTENSION_ID_PATTERN = /^[a-z]{32}$/;

export interface SourceExplorerCrxPackageIdentity {
    key: string;
    hostname: string;
    packageId: string | null;
    canonicalPageUrl: string;
}

export interface SourceExplorerCrxPackageGroup extends SourceExplorerCrxPackageIdentity {
    records: CrxFile[];
    latestRecord: CrxFile;
    totalSize: number;
}

function stripQueryAndHash(url: string): string {
    return (url.split('#')[0] ?? url).split('?')[0] ?? url;
}

function normalizePathname(pathname: string): string {
    const normalized = pathname.replace(/\/+$/, '');
    return normalized.length > 0 ? normalized : '/';
}

function isExtensionId(value: string): boolean {
    return EXTENSION_ID_PATTERN.test(value);
}

function extractExtensionIdFromSegments(segments: string[]): string | null {
    for (let index = segments.length - 1; index >= 0; index -= 1) {
        const candidate = segments[index].toLowerCase();
        if (isExtensionId(candidate)) {
            return candidate;
        }
    }
    return null;
}

function extractExtensionIdFromPageUrl(pageUrl: string): string | null {
    try {
        const parsed = new URL(pageUrl);
        const segments = parsed.pathname.split('/').filter(segment => segment.length > 0);
        return extractExtensionIdFromSegments(segments);
    } catch {
        const segments = stripQueryAndHash(pageUrl)
            .split('/')
            .filter(segment => segment.length > 0);
        return extractExtensionIdFromSegments(segments);
    }
}

function extractExtensionIdFromCrxUrl(crxUrl: string): string | null {
    try {
        const parsed = new URL(crxUrl);
        const directId = parsed.searchParams.get('id');
        if (directId && isExtensionId(directId.toLowerCase())) {
            return directId.toLowerCase();
        }

        const encodedPayload = parsed.searchParams.get('x');
        if (encodedPayload) {
            const decodedPayload = decodeURIComponent(encodedPayload);
            const payloadMatch = /(?:^|&)id=([a-z]{32})(?:&|$)/.exec(decodedPayload);
            if (payloadMatch) {
                return payloadMatch[1].toLowerCase();
            }
        }
    } catch {
        // Fall through to regex fallback below.
    }

    const fallbackMatch = /(?:[?&]id=|x=id%3D)([a-z]{32})/i.exec(crxUrl);
    return fallbackMatch ? fallbackMatch[1].toLowerCase() : null;
}

function resolveCrxPackageIdentity(crxFile: CrxFile): SourceExplorerCrxPackageIdentity {
    const packageId = extractExtensionIdFromPageUrl(crxFile.pageUrl)
        ?? extractExtensionIdFromCrxUrl(crxFile.crxUrl);

    try {
        const parsed = new URL(crxFile.pageUrl);
        const hostname = parsed.hostname.length > 0 ? parsed.hostname : 'unknown';
        const canonicalPageUrl = `${parsed.origin}${normalizePathname(parsed.pathname)}`;

        if (packageId) {
            return {
                key: `extension:${packageId}`,
                hostname,
                packageId,
                canonicalPageUrl
            };
        }

        return {
            key: `page:${hostname}${normalizePathname(parsed.pathname)}`,
            hostname,
            packageId: null,
            canonicalPageUrl
        };
    } catch {
        const strippedPageUrl = stripQueryAndHash(crxFile.pageUrl);
        if (packageId) {
            return {
                key: `extension:${packageId}`,
                hostname: 'unknown',
                packageId,
                canonicalPageUrl: strippedPageUrl.length > 0 ? strippedPageUrl : crxFile.pageUrl
            };
        }

        const fallbackPageUrl = strippedPageUrl.length > 0 ? strippedPageUrl : crxFile.pageUrl;
        return {
            key: `page:${fallbackPageUrl}`,
            hostname: 'unknown',
            packageId: null,
            canonicalPageUrl: fallbackPageUrl
        };
    }
}

export function buildCrxPackageGroups(crxFiles: CrxFile[]): SourceExplorerCrxPackageGroup[] {
    const groupsByKey = new Map<string, {
        identity: SourceExplorerCrxPackageIdentity;
        records: CrxFile[];
    }>();

    for (const crxFile of crxFiles) {
        const identity = resolveCrxPackageIdentity(crxFile);
        if (!groupsByKey.has(identity.key)) {
            groupsByKey.set(identity.key, {
                identity,
                records: []
            });
        }
        groupsByKey.get(identity.key)?.records.push(crxFile);
    }

    return Array.from(groupsByKey.values())
        .map((group) => {
            const records = [...group.records].sort((left, right) => {
                if (left.timestamp !== right.timestamp) {
                    return right.timestamp - left.timestamp;
                }
                return right.id - left.id;
            });

            const totalSize = records.reduce((sum, item) => sum + item.size, 0);
            const latestRecord = records[0];

            return {
                ...group.identity,
                records,
                latestRecord,
                totalSize
            };
        })
        .sort((left, right) => {
            if (left.latestRecord.timestamp !== right.latestRecord.timestamp) {
                return right.latestRecord.timestamp - left.latestRecord.timestamp;
            }
            return left.key.localeCompare(right.key);
        });
}

export function findCrxPackageGroupByRecordId(
    groups: SourceExplorerCrxPackageGroup[],
    recordId: number | null
): SourceExplorerCrxPackageGroup | undefined {
    if (typeof recordId !== 'number') {
        return undefined;
    }
    return groups.find(group => group.records.some(record => record.id === recordId));
}

export function findCrxPackageGroupByLookupUrl(
    groups: SourceExplorerCrxPackageGroup[],
    lookupUrl: string | undefined
): SourceExplorerCrxPackageGroup | undefined {
    if (!lookupUrl || lookupUrl.trim().length === 0) {
        return undefined;
    }

    const normalizedLookupUrl = stripQueryAndHash(lookupUrl);
    const lookupPackageId = extractExtensionIdFromPageUrl(lookupUrl)
        ?? extractExtensionIdFromCrxUrl(lookupUrl);

    if (lookupPackageId) {
        const packageMatch = groups.find(group => group.packageId === lookupPackageId);
        if (packageMatch) {
            return packageMatch;
        }
    }

    return groups.find(group => {
        if (group.canonicalPageUrl === normalizedLookupUrl) {
            return true;
        }
        return group.records.some(record => {
            if (record.crxUrl === lookupUrl) {
                return true;
            }
            return stripQueryAndHash(record.pageUrl) === normalizedLookupUrl;
        });
    });
}
