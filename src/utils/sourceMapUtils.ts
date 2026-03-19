import { SourceMapFileSummary } from '@/types';

export interface GroupedSourceMapFile<T extends SourceMapFileSummary = SourceMapFileSummary> {
  url: string;
  fileType: 'js' | 'css';
  versions: T[];
}

export interface SourceMapTreeFileNode<T extends SourceMapFileSummary = SourceMapFileSummary> {
  id: string;
  name: string;
  group: GroupedSourceMapFile<T>;
}

export interface SourceMapTreeDirectoryNode<T extends SourceMapFileSummary = SourceMapFileSummary> {
  id: string;
  name: string;
  path: string;
  directories: SourceMapTreeDirectoryNode<T>[];
  files: SourceMapTreeFileNode<T>[];
}

interface SourceMapTreeBuildOptions {
  idPrefix?: string;
}

interface ParsedSourceMapPath {
  directorySegments: string[];
  fileName: string;
}

export function groupSourceMapFiles<T extends SourceMapFileSummary>(
  files: T[]
): GroupedSourceMapFile<T>[] {
  const groups: { [key: string]: T[] } = {};

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
    versions: files.sort((a, b) => b.version - a.version), // Sort by version descending
  }));
}

function stripQueryAndHash(url: string): string {
  return (url.split('#')[0] ?? url).split('?')[0] ?? url;
}

function parseSourceMapPath(url: string): ParsedSourceMapPath {
  try {
    const parsed = new URL(url);
    const pathnameSegments = parsed.pathname.split('/').filter(segment => segment.length > 0);
    const fallbackFileName = parsed.hostname.length > 0 ? parsed.hostname : 'unknown';
    const fileName = pathnameSegments.pop() ?? fallbackFileName;
    const hostname = parsed.hostname.length > 0 ? parsed.hostname : 'unknown';

    return {
      directorySegments: [hostname, ...pathnameSegments],
      fileName: fileName.length > 0 ? fileName : fallbackFileName,
    };
  } catch {
    const sanitizedUrl = stripQueryAndHash(url);
    const pathSegments = sanitizedUrl.split('/').filter(segment => segment.length > 0);
    const fallbackFileName = sanitizedUrl.length > 0 ? sanitizedUrl : 'unknown';
    const fileName = pathSegments.pop() ?? fallbackFileName;

    return {
      directorySegments: pathSegments.length > 0 ? pathSegments : ['unknown'],
      fileName: fileName.length > 0 ? fileName : fallbackFileName,
    };
  }
}

export function getSourceMapFileName(url: string): string {
  return parseSourceMapPath(url).fileName;
}

export function getSourceMapDirectorySegments(url: string): string[] {
  return parseSourceMapPath(url).directorySegments;
}

export function getSourceMapDirectoryNodeId(path: string, idPrefix = ''): string {
  return `${idPrefix}dir:${path}`;
}

export function getSourceMapFileNodeId(url: string, idPrefix = ''): string {
  return `${idPrefix}file:${url}`;
}

interface MutableSourceMapTreeDirectoryNode<T extends SourceMapFileSummary> {
  id: string;
  name: string;
  path: string;
  directoriesByName: Map<string, MutableSourceMapTreeDirectoryNode<T>>;
  files: SourceMapTreeFileNode<T>[];
}

function createMutableSourceMapDirectoryNode<T extends SourceMapFileSummary>(
  name: string,
  path: string,
  idPrefix: string
): MutableSourceMapTreeDirectoryNode<T> {
  return {
    id: getSourceMapDirectoryNodeId(path, idPrefix),
    name,
    path,
    directoriesByName: new Map<string, MutableSourceMapTreeDirectoryNode<T>>(),
    files: [],
  };
}

function finalizeSourceMapTree<T extends SourceMapFileSummary>(
  directories: MutableSourceMapTreeDirectoryNode<T>[]
): SourceMapTreeDirectoryNode<T>[] {
  return [...directories]
    .sort((left, right) => left.name.localeCompare(right.name))
    .map(directory => ({
      id: directory.id,
      name: directory.name,
      path: directory.path,
      directories: finalizeSourceMapTree(Array.from(directory.directoriesByName.values())),
      files: [...directory.files].sort((left, right) => {
        const nameComparison = left.name.localeCompare(right.name);
        if (nameComparison !== 0) {
          return nameComparison;
        }
        return left.group.url.localeCompare(right.group.url);
      }),
    }));
}

export function buildSourceMapDirectoryTree<T extends SourceMapFileSummary>(
  groups: GroupedSourceMapFile<T>[],
  options: SourceMapTreeBuildOptions = {}
): SourceMapTreeDirectoryNode<T>[] {
  const idPrefix = options.idPrefix ?? '';
  const rootDirectories = new Map<string, MutableSourceMapTreeDirectoryNode<T>>();

  for (const group of groups) {
    const { directorySegments, fileName } = parseSourceMapPath(group.url);
    let currentPath = '';
    let currentDirectory: MutableSourceMapTreeDirectoryNode<T> | null = null;

    for (const segment of directorySegments) {
      currentPath = currentPath.length > 0 ? `${currentPath}/${segment}` : segment;
      const parentDirectoryMap = currentDirectory
        ? currentDirectory.directoriesByName
        : rootDirectories;

      let nextDirectory = parentDirectoryMap.get(segment);
      if (!nextDirectory) {
        nextDirectory = createMutableSourceMapDirectoryNode<T>(segment, currentPath, idPrefix);
        parentDirectoryMap.set(segment, nextDirectory);
      }
      currentDirectory = nextDirectory;
    }

    if (!currentDirectory) {
      continue;
    }

    const hasExistingFile = currentDirectory.files.some(fileNode => fileNode.group.url === group.url);
    if (!hasExistingFile) {
      currentDirectory.files.push({
        id: getSourceMapFileNodeId(group.url, idPrefix),
        name: fileName,
        group,
      });
    }
  }

  return finalizeSourceMapTree(Array.from(rootDirectories.values()));
}
