import { Page, PageSourceMap, SourceMapFile } from '../../types';
import { GroupedSourceMapFile, groupSourceMapFiles } from '../../utils/sourceMapUtils';

export interface SourceExplorerPageEntry {
    id: number;
    title: string;
    url: string;
    hostname: string;
    timestamp: number;
    leakCount: number;
    groupedFiles: GroupedSourceMapFile[];
}

export interface SourceExplorerDomainEntry {
    hostname: string;
    leakCount: number;
    pages: SourceExplorerPageEntry[];
    groupedFiles: GroupedSourceMapFile[];
}

export interface SourceExplorerNavigationOptions {
    pageUrl?: string;
    sourceUrl?: string;
    sourceMapFileId?: number;
}

export interface SourceExplorerSelection {
    selectedDomainHostname: string | null;
    selectedPageId: number | null;
    selectedGroupUrl: string | null;
    selectedFileId: number | null;
}

function getFileName(url: string): string {
    return url.split('/').pop() || url;
}

function getFindingsCount(file: SourceMapFile | undefined): number {
    return file?.findings?.length ?? 0;
}

function sortVersions(versions: SourceMapFile[]): SourceMapFile[] {
    return [...versions].sort((left, right) => {
        if (left.version !== right.version) {
            return right.version - left.version;
        }
        if (left.timestamp !== right.timestamp) {
            return right.timestamp - left.timestamp;
        }
        return right.id - left.id;
    });
}

function sortGroupedFiles(groups: GroupedSourceMapFile[]): GroupedSourceMapFile[] {
    return [...groups].sort((left, right) => {
        const leftFindings = getFindingsCount(left.versions[0]);
        const rightFindings = getFindingsCount(right.versions[0]);
        if (leftFindings !== rightFindings) {
            return rightFindings - leftFindings;
        }
        return getFileName(left.url).localeCompare(getFileName(right.url));
    });
}

function getHostname(url: string): string {
    try {
        const parsed = new URL(url);
        if (parsed.hostname.length > 0) {
            return parsed.hostname;
        }
        if (parsed.protocol === 'file:') {
            return 'local-files';
        }
        return parsed.protocol.replace(':', '') || 'unknown';
    } catch {
        return 'unknown';
    }
}

function mergeGroupedFiles(groups: GroupedSourceMapFile[]): GroupedSourceMapFile[] {
    const versionsByUrl = new Map<string, Map<number, SourceMapFile>>();

    for (const group of groups) {
        if (!versionsByUrl.has(group.url)) {
            versionsByUrl.set(group.url, new Map<number, SourceMapFile>());
        }
        const versionsMap = versionsByUrl.get(group.url);
        if (!versionsMap) {
            continue;
        }
        for (const version of group.versions) {
            versionsMap.set(version.id, version);
        }
    }

    const merged = Array.from(versionsByUrl.entries())
        .map(([url, versionMap]) => {
            const versions = sortVersions(Array.from(versionMap.values()));
            return {
                url,
                fileType: versions[0]?.fileType ?? 'js',
                versions
            } as GroupedSourceMapFile;
        });

    return sortGroupedFiles(merged);
}

function buildPageEntries(
    pages: Page[],
    pageSourceMaps: PageSourceMap[],
    sourceMapFiles: SourceMapFile[]
): SourceExplorerPageEntry[] {
    const sourceMapById = new Map<number, SourceMapFile>(
        sourceMapFiles.map((file) => [file.id, file] as const)
    );
    const sourceMapIdsByPageId = new Map<number, number[]>();

    for (const relation of pageSourceMaps) {
        if (!sourceMapIdsByPageId.has(relation.pageId)) {
            sourceMapIdsByPageId.set(relation.pageId, []);
        }
        sourceMapIdsByPageId.get(relation.pageId)?.push(relation.sourceMapId);
    }

    return [...pages]
        .sort((left, right) => right.timestamp - left.timestamp)
        .map((page) => {
            const sourceMapIds = sourceMapIdsByPageId.get(page.id) ?? [];
            const pageFiles = sourceMapIds
                .map((sourceMapId) => sourceMapById.get(sourceMapId))
                .filter((file): file is SourceMapFile => Boolean(file));
            const groupedFiles = sortGroupedFiles(groupSourceMapFiles(pageFiles));
            const latestFiles = groupedFiles
                .map((group) => group.versions[0])
                .filter((file): file is SourceMapFile => Boolean(file));
            const leakCount = latestFiles.reduce(
                (totalLeakCount, file) => totalLeakCount + getFindingsCount(file),
                0
            );

            return {
                id: page.id,
                title: page.title,
                url: page.url,
                hostname: getHostname(page.url),
                timestamp: page.timestamp,
                leakCount,
                groupedFiles
            };
        });
}

export function buildSourceExplorerDomains(
    pages: Page[],
    pageSourceMaps: PageSourceMap[],
    sourceMapFiles: SourceMapFile[]
): SourceExplorerDomainEntry[] {
    const pageEntries = buildPageEntries(pages, pageSourceMaps, sourceMapFiles);
    const domainMap = new Map<string, SourceExplorerDomainEntry>();

    for (const pageEntry of pageEntries) {
        if (!domainMap.has(pageEntry.hostname)) {
            domainMap.set(pageEntry.hostname, {
                hostname: pageEntry.hostname,
                leakCount: 0,
                pages: [],
                groupedFiles: []
            });
        }

        const domainEntry = domainMap.get(pageEntry.hostname);
        if (!domainEntry) {
            continue;
        }

        domainEntry.pages.push(pageEntry);
    }

    const domains = Array.from(domainMap.values()).map((domain) => {
        const groupedFiles = mergeGroupedFiles(domain.pages.flatMap((page) => page.groupedFiles));
        const latestFiles = groupedFiles
            .map((group) => group.versions[0])
            .filter((file): file is SourceMapFile => Boolean(file));

        return {
            ...domain,
            leakCount: latestFiles.reduce(
                (totalLeakCount, file) => totalLeakCount + getFindingsCount(file),
                0
            ),
            pages: [...domain.pages].sort((left, right) => right.timestamp - left.timestamp),
            groupedFiles
        };
    });

    return domains.sort((left, right) => {
        if (left.leakCount !== right.leakCount) {
            return right.leakCount - left.leakCount;
        }
        if (left.pages.length !== right.pages.length) {
            return right.pages.length - left.pages.length;
        }
        return left.hostname.localeCompare(right.hostname);
    });
}

export function getDomainGroupedFiles(
    domains: SourceExplorerDomainEntry[],
    hostname: string | null
): GroupedSourceMapFile[] {
    if (!hostname) {
        return [];
    }
    const domain = domains.find((item) => item.hostname === hostname);
    return domain?.groupedFiles ?? [];
}

function findDomainBySourceMapFileId(
    domains: SourceExplorerDomainEntry[],
    sourceMapFileId: number | undefined
): SourceExplorerDomainEntry | undefined {
    if (typeof sourceMapFileId !== 'number') {
        return undefined;
    }
    return domains.find((domain) =>
        domain.groupedFiles.some((group) =>
            group.versions.some((version) => version.id === sourceMapFileId)
        )
    );
}

function findDomainBySourceUrl(
    domains: SourceExplorerDomainEntry[],
    sourceUrl: string | undefined
): SourceExplorerDomainEntry | undefined {
    if (!sourceUrl) {
        return undefined;
    }
    return domains.find((domain) =>
        domain.groupedFiles.some((group) => group.url === sourceUrl)
    );
}

function findDomainByPageUrl(
    domains: SourceExplorerDomainEntry[],
    pageUrl: string | undefined
): SourceExplorerDomainEntry | undefined {
    if (!pageUrl) {
        return undefined;
    }
    return domains.find((domain) =>
        domain.pages.some((page) => page.url === pageUrl)
    );
}

function getDefaultDomain(domains: SourceExplorerDomainEntry[]): SourceExplorerDomainEntry | undefined {
    return domains.find((domain) => domain.leakCount > 0) ?? domains[0];
}

export function resolveSourceExplorerSelection(
    domains: SourceExplorerDomainEntry[],
    options: SourceExplorerNavigationOptions
): SourceExplorerSelection {
    const selectedDomain = findDomainBySourceMapFileId(domains, options.sourceMapFileId)
        ?? findDomainBySourceUrl(domains, options.sourceUrl)
        ?? findDomainByPageUrl(domains, options.pageUrl)
        ?? getDefaultDomain(domains);

    if (!selectedDomain) {
        return {
            selectedDomainHostname: null,
            selectedPageId: null,
            selectedGroupUrl: null,
            selectedFileId: null
        };
    }

    const selectedGroup = (typeof options.sourceMapFileId === 'number'
        ? selectedDomain.groupedFiles.find((group) =>
            group.versions.some((version) => version.id === options.sourceMapFileId)
        )
        : undefined)
        ?? (options.sourceUrl
            ? selectedDomain.groupedFiles.find((group) => group.url === options.sourceUrl)
            : undefined)
        ?? selectedDomain.groupedFiles.find((group) => getFindingsCount(group.versions[0]) > 0)
        ?? selectedDomain.groupedFiles[0];

    let selectedPage = options.pageUrl
        ? selectedDomain.pages.find((page) => page.url === options.pageUrl)
        : undefined;

    if (!selectedPage && selectedGroup) {
        selectedPage = selectedDomain.pages.find((page) =>
            page.groupedFiles.some((group) => group.url === selectedGroup.url)
        );
    }

    const selectedFileId = (typeof options.sourceMapFileId === 'number'
        && selectedGroup?.versions.some((version) => version.id === options.sourceMapFileId))
        ? options.sourceMapFileId
        : selectedGroup?.versions[0]?.id ?? null;

    return {
        selectedDomainHostname: selectedDomain.hostname,
        selectedPageId: selectedPage?.id ?? selectedDomain.pages[0]?.id ?? null,
        selectedGroupUrl: selectedGroup?.url ?? null,
        selectedFileId
    };
}
