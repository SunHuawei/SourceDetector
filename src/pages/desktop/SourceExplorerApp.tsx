import { SourceDetectorDB } from '@/storage/database';
import { CrxFile, LeakFinding, SourceMapFile } from '@/types';
import { useAppTheme } from '@/theme';
import { formatBytes } from '@/utils/format';
import { SourceMapDownloader } from '@/utils/sourceMapDownloader';
import { trackEvent, trackProductEvent } from '@/utils/analytics';
import { parsedCrxFileFromCrxFile } from '@/utils/parseCrxFile';
import { GITHUB_FEEDBACK_URL } from '@/constants/links';
import { CodeViewer } from '@/components/CodeViewer';
import { getFileIcon } from '@/components/fileIcon';
import type { SourceExplorerTab } from '@/utils/sourceExplorerNavigation';
import {
  SourceMapTreeDirectoryNode,
  buildSourceMapDirectoryTree,
  getSourceMapDirectoryNodeId,
  getSourceMapDirectorySegments,
} from '@/utils/sourceMapUtils';
import {
  Alert,
  AppBar,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Collapse,
  Container,
  CssBaseline,
  Divider,
  List,
  ListItemButton,
  ListItemText,
  Paper,
  Snackbar,
  Stack,
  Tab,
  Tabs,
  ThemeProvider,
  Toolbar,
  Typography,
} from '@mui/material';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  SourceExplorerDomainEntry,
  buildSourceExplorerDomains,
  getDomainGroupedFiles,
  resolveSourceExplorerSelection,
} from './sourceExplorerData';
import {
  SourceExplorerCrxPackageGroup,
  buildCrxPackageGroups,
  findCrxPackageGroupByLookupUrl,
  findCrxPackageGroupByRecordId,
} from './sourceExplorerCrxData';
import {
  buildCrxCodeTree,
  buildSourceCodeTree,
  CodeTreeNode,
  isTextLikeFile,
} from './sourceCodeTree';
import type { JSX, SyntheticEvent } from 'react';
import {
  ChevronRight as ChevronRightIcon,
  CloudDownload as CloudDownloadIcon,
  ExpandMore as ExpandMoreIcon,
  Folder as FolderIcon,
  GitHub as GitHubIcon,
  Language as LanguageIcon,
  Link as LinkIcon,
} from '@mui/icons-material';

interface SourceExplorerNavigationState {
  tab: SourceExplorerTab;
  pageUrl?: string;
  sourceUrl?: string;
  sourceMapFileId?: number;
  view?: string;
}

interface FindingTypeSummary {
  ruleName: string;
  count: number;
}

type ToastSeverity = 'success' | 'error' | 'info' | 'warning';

interface ToastState {
  open: boolean;
  message: string;
  severity: ToastSeverity;
}

interface SourceCodeEntry {
  path: string;
  content: string;
}

interface SourceMapPageTreeEntry {
  pageId: number;
  pageTitle: string;
  pageUrl: string;
  groupedFileCount: number;
  directories: SourceMapTreeDirectoryNode[];
}

interface SourceMapDomainTreeEntry {
  hostname: string;
  leakCount: number;
  pages: SourceMapPageTreeEntry[];
}


function getFileName(url: string): string {
  return url.split('/').pop() || url;
}

function parseNumericValue(value: string | null): number | undefined {
  if (!value) {
    return undefined;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function readSearchParam(searchParams: URLSearchParams, key: string): string | undefined {
  const value = searchParams.get(key);
  return value && value.trim().length > 0 ? value : undefined;
}

function getErrorType(error: unknown): string {
  if (error instanceof Error && error.name.trim().length > 0) {
    return error.name;
  }
  if (typeof error === 'string' && error.trim().length > 0) {
    return error;
  }
  return 'unknown_error';
}

function normalizeTab(value: string | undefined): SourceExplorerTab | undefined {
  if (value === 'overview' || value === 'source-maps' || value === 'crx-packages') {
    return value;
  }
  if (value === 'source-files') {
    return 'source-maps';
  }
  if (value === 'crx-files') {
    return 'crx-packages';
  }
  return undefined;
}

function parseNavigationState(): SourceExplorerNavigationState {
  const searchParams = new URLSearchParams(window.location.search);
  const tab = normalizeTab(readSearchParam(searchParams, 'tab')) ?? 'overview';
  const pageUrl = readSearchParam(searchParams, 'pageUrl');
  const sourceUrl = readSearchParam(searchParams, 'sourceUrl');
  const sourceMapFileId = parseNumericValue(
    readSearchParam(searchParams, 'sourceMapFileId') ?? null
  );
  const view = readSearchParam(searchParams, 'view');

  return {
    tab,
    pageUrl: pageUrl ?? undefined,
    sourceUrl: sourceUrl ?? undefined,
    sourceMapFileId,
    view: view ?? undefined,
  };
}

function getFindingTypeSummary(findings: SourceMapFile['findings']): FindingTypeSummary[] {
  const countByRuleName = new Map<string, number>();
  for (const finding of findings ?? []) {
    const ruleName = finding.ruleName.trim().length > 0 ? finding.ruleName : 'Unknown Rule';
    countByRuleName.set(ruleName, (countByRuleName.get(ruleName) ?? 0) + 1);
  }

  return Array.from(countByRuleName.entries())
    .map(([ruleName, count]) => ({ ruleName, count }))
    .sort((left, right) => right.count - left.count);
}

function extractSourceEntries(file: SourceMapFile | null): SourceCodeEntry[] {
  if (!file) {
    return [];
  }

  try {
    const parsed = JSON.parse(file.content) as {
      sources?: string[];
      sourcesContent?: Array<string | null>;
    };
    const sources = parsed.sources ?? [];
    const sourceContents = parsed.sourcesContent ?? [];
    return sources
      .map((path, index) => ({ path, content: sourceContents[index] ?? '' }))
      .filter(entry => entry.path.trim().length > 0 && entry.content.length > 0);
  } catch {
    return [];
  }
}

function getFindingPreview(
  file: SourceMapFile | null,
  selectedFinding: LeakFinding | null
): string {
  if (!file) {
    return 'No file selected.';
  }

  if (selectedFinding?.contextLines && selectedFinding.contextLines.length > 0) {
    return selectedFinding.contextLines
      .map(
        contextLine => `${contextLine.line.toString().padStart(4, ' ')} | ${contextLine.content}`
      )
      .join('\n');
  }

  return file.originalContent;
}

function flattenTree(node: CodeTreeNode): CodeTreeNode[] {
  const output: CodeTreeNode[] = [];
  for (const child of node.children) {
    output.push(child);
    if (child.type === 'directory') {
      output.push(...flattenTree(child));
    }
  }
  return output;
}

function renderTreeList(
  nodes: CodeTreeNode[],
  selectedPath: string | null,
  onSelect: (path: string) => void,
  depth = 0
): JSX.Element[] {
  return nodes.flatMap(node => {
    const row = (
      <ListItemButton
        key={node.path || node.name}
        selected={node.type === 'file' && selectedPath === node.path}
        onClick={() => {
          if (node.type === 'file') {
            onSelect(node.path);
          }
        }}
        sx={{ pl: 2 + depth * 1.5, py: 0.75 }}
      >
        <Box sx={{ mr: 1, display: 'flex', alignItems: 'center' }}>
          {node.type === 'directory' ? getFileIcon(`${node.name}.dir`) : getFileIcon(node.name)}
        </Box>
        <ListItemText
          primary={node.name}
          secondary={node.type === 'directory' ? undefined : node.path}
          secondaryTypographyProps={{ sx: { wordBreak: 'break-all' } }}
        />
      </ListItemButton>
    );

    return node.type === 'directory'
      ? [row, ...renderTreeList(node.children, selectedPath, onSelect, depth + 1)]
      : [row];
  });
}

function formatTimestamp(timestamp: number): string {
  try {
    return new Date(timestamp).toLocaleString();
  } catch {
    return String(timestamp);
  }
}

function sanitizeFileName(input: string): string {
  const normalized = input
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '')
    .toLowerCase();
  return normalized.length > 0 ? normalized : 'source-detector-export';
}

function countSourceMapTreeFiles(nodes: SourceMapTreeDirectoryNode[]): number {
  return nodes.reduce(
    (total, node) => total + node.files.length + countSourceMapTreeFiles(node.directories),
    0
  );
}

function getSourceMapPageTreeIdPrefix(pageId: number): string {
  return `page:${pageId}:`;
}

export default function SourceExplorerApp() {
  const theme = useAppTheme();
  const db = useMemo(() => new SourceDetectorDB(), []);
  const navigationState = useMemo(() => parseNavigationState(), []);

  const [activeTab, setActiveTab] = useState<SourceExplorerTab>(navigationState.tab);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [domains, setDomains] = useState<SourceExplorerDomainEntry[]>([]);
  const [selectedDomainHostname, setSelectedDomainHostname] = useState<string | null>(null);
  const [selectedPageId, setSelectedPageId] = useState<number | null>(null);
  const [selectedGroupUrl, setSelectedGroupUrl] = useState<string | null>(null);
  const [selectedFileId, setSelectedFileId] = useState<number | null>(null);
  const [selectedFindingIndex, setSelectedFindingIndex] = useState(0);
  const [shouldScrollToEvidence, setShouldScrollToEvidence] = useState(false);
  const [downloadingFileId, setDownloadingFileId] = useState<number | null>(null);
  const [downloadingBatch, setDownloadingBatch] = useState(false);
  const [selectedSourcePath, setSelectedSourcePath] = useState<string | null>(null);
  const [expandedSourceMapNodes, setExpandedSourceMapNodes] = useState<Record<string, boolean>>(
    {}
  );

  const [crxPackages, setCrxPackages] = useState<CrxFile[]>([]);
  const [selectedCrxGroupKey, setSelectedCrxGroupKey] = useState<string | null>(null);
  const [selectedCrxId, setSelectedCrxId] = useState<number | null>(null);
  const [loadingCrxSource, setLoadingCrxSource] = useState(false);
  const [selectedCrxPath, setSelectedCrxPath] = useState<string | null>(null);
  const [crxTree, setCrxTree] = useState<CodeTreeNode | null>(null);
  const [crxFiles, setCrxFiles] = useState<Record<string, string>>({});

  const [toast, setToast] = useState<ToastState>({ open: false, message: '', severity: 'info' });
  const evidenceRef = useRef<HTMLDivElement | null>(null);

  const selectedDomain = useMemo(
    () => domains.find(domain => domain.hostname === selectedDomainHostname) ?? null,
    [domains, selectedDomainHostname]
  );

  const selectedPage = useMemo(
    () =>
      selectedDomain?.pages.find(page => page.id === selectedPageId) ??
      selectedDomain?.pages[0] ??
      null,
    [selectedDomain, selectedPageId]
  );

  const domainGroupedFiles = useMemo(
    () => getDomainGroupedFiles(domains, selectedDomainHostname),
    [domains, selectedDomainHostname]
  );

  const selectedPageGroupedFiles = useMemo(() => selectedPage?.groupedFiles ?? [], [selectedPage]);

  const sourceMapNavigationTree = useMemo<SourceMapDomainTreeEntry[]>(
    () =>
      domains.map(domain => ({
        hostname: domain.hostname,
        leakCount: domain.leakCount,
        pages: domain.pages.map(page => ({
          pageId: page.id,
          pageTitle: page.title,
          pageUrl: page.url,
          groupedFileCount: page.groupedFiles.length,
          directories: buildSourceMapDirectoryTree(page.groupedFiles, {
            idPrefix: getSourceMapPageTreeIdPrefix(page.id),
          }),
        })),
      })),
    [domains]
  );

  const selectedSourceMapDirectoryNodeIds = useMemo(() => {
    const nodeIds = new Set<string>();
    if (selectedPageId === null || !selectedGroupUrl) {
      return nodeIds;
    }

    const idPrefix = getSourceMapPageTreeIdPrefix(selectedPageId);
    const directorySegments = getSourceMapDirectorySegments(selectedGroupUrl);
    let currentPath = '';
    for (const segment of directorySegments) {
      currentPath = currentPath.length > 0 ? `${currentPath}/${segment}` : segment;
      nodeIds.add(getSourceMapDirectoryNodeId(currentPath, idPrefix));
    }
    return nodeIds;
  }, [selectedGroupUrl, selectedPageId]);

  const selectedGroup = useMemo(
    () => domainGroupedFiles.find(group => group.url === selectedGroupUrl) ?? null,
    [domainGroupedFiles, selectedGroupUrl]
  );

  const selectedFile = useMemo(() => {
    if (!selectedGroup) {
      return null;
    }
    if (selectedFileId !== null) {
      const matchedVersion = selectedGroup.versions.find(version => version.id === selectedFileId);
      if (matchedVersion) {
        return matchedVersion;
      }
    }
    return selectedGroup.versions[0] ?? null;
  }, [selectedGroup, selectedFileId]);

  const selectedFindings = selectedFile?.findings ?? [];
  const selectedFinding = selectedFindings[selectedFindingIndex] ?? null;
  const findingTypeSummary = useMemo(
    () => getFindingTypeSummary(selectedFindings),
    [selectedFindings]
  );

  const latestDomainFiles = useMemo(
    () =>
      domainGroupedFiles
        .map(group => group.versions[0])
        .filter((file): file is SourceMapFile => Boolean(file)),
    [domainGroupedFiles]
  );

  const sourceEntries = useMemo(() => extractSourceEntries(selectedFile), [selectedFile]);
  const sourceTree = useMemo(() => buildSourceCodeTree(sourceEntries), [sourceEntries]);
  const sourceFileMap = useMemo(
    () =>
      Object.fromEntries(
        sourceEntries.map(entry => [
          entry.path.replace(/^\.\//, '').replace(/^\.\.\//, ''),
          entry.content,
        ])
      ),
    [sourceEntries]
  );

  const selectedSourceContent = useMemo(() => {
    if (!selectedSourcePath) {
      return null;
    }
    return sourceFileMap[selectedSourcePath] ?? null;
  }, [selectedSourcePath, sourceFileMap]);

  const crxPackageGroups = useMemo(() => buildCrxPackageGroups(crxPackages), [crxPackages]);
  const selectedCrxGroup = useMemo<SourceExplorerCrxPackageGroup | null>(
    () =>
      (selectedCrxGroupKey
        ? crxPackageGroups.find(group => group.key === selectedCrxGroupKey)
        : undefined) ??
      findCrxPackageGroupByRecordId(crxPackageGroups, selectedCrxId) ??
      crxPackageGroups[0] ??
      null,
    [crxPackageGroups, selectedCrxGroupKey, selectedCrxId]
  );
  const selectedCrx = useMemo(() => {
    if (!selectedCrxGroup) {
      return null;
    }
    if (selectedCrxId !== null) {
      const matchedRecord = selectedCrxGroup.records.find(crxItem => crxItem.id === selectedCrxId);
      if (matchedRecord) {
        return matchedRecord;
      }
    }
    return selectedCrxGroup.latestRecord;
  }, [selectedCrxGroup, selectedCrxId]);

  const recentCrxPackages = useMemo(
    () => crxPackageGroups.slice(0, 5).map(group => group.latestRecord),
    [crxPackageGroups]
  );

  const selectedCrxContent = useMemo(() => {
    if (!selectedCrxPath) {
      return null;
    }
    return crxFiles[selectedCrxPath] ?? null;
  }, [crxFiles, selectedCrxPath]);

  const totalPages = useMemo(
    () => domains.reduce((sum, domain) => sum + domain.pages.length, 0),
    [domains]
  );
  const totalBundleGroups = useMemo(
    () => domains.reduce((sum, domain) => sum + domain.groupedFiles.length, 0),
    [domains]
  );
  const totalFindings = useMemo(
    () => domains.reduce((sum, domain) => sum + domain.leakCount, 0),
    [domains]
  );
  const totalSourceMapVersions = useMemo(
    () =>
      domains.reduce(
        (sum, domain) =>
          sum +
          domain.groupedFiles.reduce((groupSum, group) => groupSum + group.versions.length, 0),
        0
      ),
    [domains]
  );
  const topDomainsWithFindings = useMemo(
    () => domains.filter(domain => domain.leakCount > 0).slice(0, 5),
    [domains]
  );
  const recentPages = useMemo(
    () =>
      domains
        .flatMap(domain => domain.pages)
        .sort((left, right) => right.timestamp - left.timestamp)
        .slice(0, 5),
    [domains]
  );

  function showToast(message: string, severity: ToastSeverity = 'info') {
    setToast({ open: true, message, severity });
  }

  useEffect(() => {
    setActiveTab(navigationState.tab);
  }, [navigationState.tab]);

  useEffect(() => {
    let cancelled = false;

    const loadData = async () => {
      setLoading(true);
      setError(null);

      try {
        const [pages, pageSourceMaps, sourceMapFiles, storedCrxFiles] = await Promise.all([
          db.pages.toArray(),
          db.pageSourceMaps.toArray(),
          db.sourceMapFiles.toArray(),
          db.crxFiles.orderBy('timestamp').reverse().toArray(),
        ]);

        const nextDomains = buildSourceExplorerDomains(pages, pageSourceMaps, sourceMapFiles);
        const initialSelection = resolveSourceExplorerSelection(nextDomains, {
          pageUrl: navigationState.pageUrl,
          sourceUrl: navigationState.sourceUrl,
          sourceMapFileId: navigationState.sourceMapFileId,
        });

        const resolvedDomain = nextDomains.find(
          domain => domain.hostname === initialSelection.selectedDomainHostname
        );
        const resolvedGroup = resolvedDomain?.groupedFiles.find(
          group => group.url === initialSelection.selectedGroupUrl
        );
        const resolvedFile =
          initialSelection.selectedFileId !== null
            ? resolvedGroup?.versions.find(
                version => version.id === initialSelection.selectedFileId
              )
            : resolvedGroup?.versions[0];

        const nextCrxPackageGroups = buildCrxPackageGroups(storedCrxFiles);
        const nextSelectedCrxGroup = navigationState.pageUrl
          ? findCrxPackageGroupByLookupUrl(nextCrxPackageGroups, navigationState.pageUrl)
          : nextCrxPackageGroups[0];
        const nextSelectedCrx = nextSelectedCrxGroup?.latestRecord ?? storedCrxFiles[0];

        if (cancelled) {
          return;
        }

        setDomains(nextDomains);
        setSelectedDomainHostname(initialSelection.selectedDomainHostname);
        setSelectedPageId(initialSelection.selectedPageId);
        setSelectedGroupUrl(initialSelection.selectedGroupUrl);
        setSelectedFileId(initialSelection.selectedFileId);
        setSelectedFindingIndex(0);

        setCrxPackages(storedCrxFiles);
        setSelectedCrxGroupKey(nextSelectedCrxGroup?.key ?? null);
        setSelectedCrxId(nextSelectedCrx?.id ?? null);

        setShouldScrollToEvidence(
          Boolean(
            resolvedFile &&
              (resolvedFile.findings?.length ?? 0) > 0 &&
              (navigationState.view === 'leak-findings' ||
                navigationState.sourceUrl ||
                typeof navigationState.sourceMapFileId === 'number')
          )
        );
      } catch (loadError) {
        if (!cancelled) {
          console.error('Error loading source explorer data:', loadError);
          setError(
            loadError instanceof Error ? loadError.message : 'Failed to load Source Explorer data.'
          );
          void trackProductEvent('scan_failed', {
            surface: 'source_explorer',
            scan_stage: 'load_source_explorer_data',
            error_type: getErrorType(loadError),
          });
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void loadData();
    return () => {
      cancelled = true;
    };
  }, [db, navigationState]);

  useEffect(() => {
    if (!selectedDomain && domains.length > 0) {
      setSelectedDomainHostname(domains[0].hostname);
      setSelectedPageId(domains[0].pages[0]?.id ?? null);
    }
  }, [domains, selectedDomain]);

  useEffect(() => {
    if (!selectedDomain) {
      return;
    }
    if (selectedPageId === null || !selectedDomain.pages.some(page => page.id === selectedPageId)) {
      setSelectedPageId(selectedDomain.pages[0]?.id ?? null);
    }
  }, [selectedDomain, selectedPageId]);

  useEffect(() => {
    const preferredGroupedFiles =
      selectedPageGroupedFiles.length > 0 ? selectedPageGroupedFiles : domainGroupedFiles;

    if (preferredGroupedFiles.length === 0) {
      setSelectedGroupUrl(null);
      setSelectedFileId(null);
      return;
    }

    if (
      !selectedGroupUrl ||
      !preferredGroupedFiles.some(group => group.url === selectedGroupUrl)
    ) {
      setSelectedGroupUrl(preferredGroupedFiles[0].url);
      setSelectedFileId(preferredGroupedFiles[0].versions[0]?.id ?? null);
    }
  }, [domainGroupedFiles, selectedGroupUrl, selectedPageGroupedFiles]);

  useEffect(() => {
    if (!selectedGroup || selectedGroup.versions.length === 0) {
      return;
    }
    if (
      selectedFileId === null ||
      !selectedGroup.versions.some(version => version.id === selectedFileId)
    ) {
      setSelectedFileId(selectedGroup.versions[0].id);
    }
  }, [selectedFileId, selectedGroup]);

  useEffect(() => {
    setSelectedFindingIndex(0);
    const firstSourceFile = flattenTree(sourceTree).find(node => node.type === 'file');
    setSelectedSourcePath(firstSourceFile?.path ?? null);
  }, [selectedFile?.id, sourceTree]);

  useEffect(() => {
    if (crxPackageGroups.length === 0) {
      if (selectedCrxGroupKey !== null) {
        setSelectedCrxGroupKey(null);
      }
      if (selectedCrxId !== null) {
        setSelectedCrxId(null);
      }
      return;
    }

    const groupByRecordId = findCrxPackageGroupByRecordId(crxPackageGroups, selectedCrxId);
    if (groupByRecordId) {
      if (selectedCrxGroupKey !== groupByRecordId.key) {
        setSelectedCrxGroupKey(groupByRecordId.key);
      }
      return;
    }

    if (!selectedCrxGroupKey) {
      const defaultGroup = crxPackageGroups[0];
      setSelectedCrxGroupKey(defaultGroup.key);
      setSelectedCrxId(defaultGroup.latestRecord.id);
      return;
    }

    const currentGroup = crxPackageGroups.find(group => group.key === selectedCrxGroupKey);
    if (!currentGroup) {
      const defaultGroup = crxPackageGroups[0];
      setSelectedCrxGroupKey(defaultGroup.key);
      setSelectedCrxId(defaultGroup.latestRecord.id);
      return;
    }

    if (!currentGroup.records.some(record => record.id === selectedCrxId)) {
      setSelectedCrxId(currentGroup.latestRecord.id);
    }
  }, [crxPackageGroups, selectedCrxGroupKey, selectedCrxId]);

  useEffect(() => {
    if (!shouldScrollToEvidence || !selectedFinding || !evidenceRef.current) {
      return;
    }
    evidenceRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setShouldScrollToEvidence(false);
  }, [selectedFinding, shouldScrollToEvidence]);

  useEffect(() => {
    let cancelled = false;

    const loadCrxSourceData = async () => {
      if (!selectedCrx) {
        setCrxTree(null);
        setCrxFiles({});
        setSelectedCrxPath(null);
        return;
      }

      setLoadingCrxSource(true);
      try {
        const parsed = await parsedCrxFileFromCrxFile(selectedCrx);
        if (!parsed) {
          throw new Error('Failed to parse extension package.');
        }

        const extractedEntries = await Promise.all(
          Object.entries(parsed.zip.files)
            .filter(([, zipEntry]) => !zipEntry.dir)
            .map(async ([path, zipEntry]) => {
              if (!isTextLikeFile(path)) {
                return { path, content: '' };
              }
              try {
                const content = await zipEntry.async('string');
                return { path, content };
              } catch {
                return { path, content: '' };
              }
            })
        );

        if (cancelled) {
          return;
        }

        const validEntries = extractedEntries.filter(entry => entry.path.trim().length > 0);
        const nextFileMap = Object.fromEntries(
          validEntries.map(entry => [entry.path, entry.content])
        );
        const nextTree = buildCrxCodeTree(validEntries);
        const firstTextFile = flattenTree(nextTree).find(
          node => node.type === 'file' && isTextLikeFile(node.path)
        );

        setCrxTree(nextTree);
        setCrxFiles(nextFileMap);
        setSelectedCrxPath(previousPath => {
          if (previousPath && nextFileMap[previousPath] !== undefined) {
            return previousPath;
          }
          return firstTextFile?.path ?? null;
        });
      } catch (parseError) {
        if (!cancelled) {
          console.error('Failed to load CRX source data:', parseError);
          setCrxTree(null);
          setCrxFiles({});
          setSelectedCrxPath(null);
          showToast('Failed to parse extension package.', 'error');
        }
      } finally {
        if (!cancelled) {
          setLoadingCrxSource(false);
        }
      }
    };

    void loadCrxSourceData();
    return () => {
      cancelled = true;
    };
  }, [selectedCrx]);

  useEffect(() => {
    void trackEvent('source_explorer_viewed', {
      initial_tab: navigationState.tab,
    });
  }, [navigationState.tab]);

  const handleDownloadSingle = async () => {
    if (!selectedFile) {
      return;
    }
    try {
      setDownloadingFileId(selectedFile.id);
      await SourceMapDownloader.downloadSingle(selectedFile, {
        onError: downloadError => {
          showToast(downloadError.message, 'error');
        },
      });
      showToast('Selected file downloaded successfully.', 'success');
    } catch (downloadError) {
      console.error('Error downloading selected file:', downloadError);
      showToast('Failed to download selected file.', 'error');
    } finally {
      setDownloadingFileId(null);
    }
  };

  const handleDownloadDomainZip = async () => {
    if (latestDomainFiles.length === 0) {
      showToast('No files available for domain batch download.', 'info');
      return;
    }
    const targetPageUrl = selectedPage?.url ?? selectedDomain?.pages[0]?.url ?? selectedFile?.url;
    if (!targetPageUrl) {
      showToast('Unable to resolve domain URL for batch download.', 'error');
      return;
    }

    try {
      setDownloadingBatch(true);
      await SourceMapDownloader.downloadAllLatest(latestDomainFiles, targetPageUrl, {
        onError: downloadError => {
          showToast(downloadError.message, 'error');
        },
      });
      showToast('Domain batch ZIP downloaded successfully.', 'success');
    } catch (downloadError) {
      console.error('Error downloading domain ZIP:', downloadError);
      showToast('Failed to download domain ZIP.', 'error');
    } finally {
      setDownloadingBatch(false);
    }
  };

  const handleDownloadCrx = () => {
    if (!selectedCrx) {
      return;
    }
    try {
      const blobUrl = URL.createObjectURL(selectedCrx.blob);
      const anchor = document.createElement('a');
      anchor.href = blobUrl;
      anchor.download = `${sanitizeFileName(selectedCrx.pageTitle || selectedCrx.pageUrl || 'extension')}.crx`;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(blobUrl);
      showToast('CRX package downloaded successfully.', 'success');
    } catch (downloadError) {
      console.error('Error downloading CRX package:', downloadError);
      showToast('Failed to download CRX package.', 'error');
    }
  };

  const handleOpenGithubFeedback = () => {
    void trackProductEvent('feedback_submitted', {
      surface: 'source_explorer',
      placement: 'header_feedback_button',
      feedback_channel: 'github_issues',
      submission_state: 'intent',
    });
    window.open(GITHUB_FEEDBACK_URL, '_blank', 'noopener,noreferrer');
  };

  const switchToTab = (
    nextTab: SourceExplorerTab,
    trigger: 'tabs' | 'section_shortcuts' | 'overview_cards' = 'tabs'
  ) => {
    if (activeTab === nextTab) {
      return;
    }
    setActiveTab(nextTab);
    void trackEvent('source_explorer_tab_changed', {
      tab: nextTab,
      trigger,
    });
  };

  const handleTabChange = (_event: SyntheticEvent, nextTab: SourceExplorerTab) => {
    switchToTab(nextTab, 'tabs');
  };

  const handleSelectDomain = (hostname: string) => {
    const domain = domains.find(domainItem => domainItem.hostname === hostname);
    const defaultPage = domain?.pages[0];
    const defaultGroup = defaultPage?.groupedFiles[0] ?? domain?.groupedFiles[0];
    setSelectedDomainHostname(hostname);
    setSelectedPageId(defaultPage?.id ?? null);
    setSelectedGroupUrl(defaultGroup?.url ?? null);
    setSelectedFileId(defaultGroup?.versions[0]?.id ?? null);
  };

  const handleSelectPage = (pageId: number) => {
    if (!selectedDomain) {
      return;
    }
    const page = selectedDomain.pages.find(item => item.id === pageId);
    setSelectedPageId(pageId);
    if (page && page.groupedFiles.length > 0) {
      setSelectedGroupUrl(page.groupedFiles[0].url);
      setSelectedFileId(page.groupedFiles[0].versions[0]?.id ?? null);
    }
  };

  const isSourceMapNodeExpanded = (nodeId: string, fallbackExpanded = false): boolean =>
    expandedSourceMapNodes[nodeId] ?? fallbackExpanded;

  const toggleSourceMapNode = (nodeId: string, fallbackExpanded = false) => {
    setExpandedSourceMapNodes(previousState => ({
      ...previousState,
      [nodeId]: !(previousState[nodeId] ?? fallbackExpanded),
    }));
  };

  const expandSourceMapNodes = (nodeIds: string[]) => {
    if (nodeIds.length === 0) {
      return;
    }

    setExpandedSourceMapNodes(previousState => {
      const nextState = { ...previousState };
      for (const nodeId of nodeIds) {
        nextState[nodeId] = true;
      }
      return nextState;
    });
  };

  const handleSelectSourceMapGroup = (
    hostname: string,
    pageId: number,
    groupUrl: string,
    defaultFileId: number | null
  ) => {
    setSelectedDomainHostname(hostname);
    setSelectedPageId(pageId);
    setSelectedGroupUrl(groupUrl);
    setSelectedFileId(defaultFileId);

    const idPrefix = getSourceMapPageTreeIdPrefix(pageId);
    const nodeIdsToExpand = [`domain:${hostname}`, `page:${pageId}`];
    const directorySegments = getSourceMapDirectorySegments(groupUrl);
    let currentPath = '';
    for (const segment of directorySegments) {
      currentPath = currentPath.length > 0 ? `${currentPath}/${segment}` : segment;
      nodeIdsToExpand.push(getSourceMapDirectoryNodeId(currentPath, idPrefix));
    }
    expandSourceMapNodes(nodeIdsToExpand);
  };

  const isCrxNodeExpanded = (nodeId: string, fallbackExpanded = false): boolean =>
    expandedSourceMapNodes[nodeId] ?? fallbackExpanded;

  const toggleCrxNode = (nodeId: string, fallbackExpanded = false) => {
    setExpandedSourceMapNodes(previousState => ({
      ...previousState,
      [nodeId]: !(previousState[nodeId] ?? fallbackExpanded),
    }));
  };

  const handleSelectCrxGroup = (groupKey: string) => {
    const group = crxPackageGroups.find(item => item.key === groupKey);
    if (!group) {
      return;
    }
    setSelectedCrxGroupKey(group.key);
    setSelectedCrxId(group.latestRecord.id);

    const hostNodeId = `crx-host:${group.hostname}`;
    const groupNodeId = `crx-group:${group.key}`;
    setExpandedSourceMapNodes(previousState => ({
      ...previousState,
      [hostNodeId]: true,
      [groupNodeId]: true,
    }));
  };

  const sourceViewerPath =
    selectedSourcePath && selectedSourceContent !== null
      ? selectedSourcePath
      : (selectedFile?.url ?? 'source-map');
  const sourceViewerContent =
    selectedSourcePath && selectedSourceContent !== null
      ? selectedSourceContent
      : getFindingPreview(selectedFile, selectedFinding);

  const tabDescription =
    activeTab === 'overview'
      ? 'Top-level index of all websites and CRX packages'
      : activeTab === 'source-maps'
        ? 'Explore source maps, original sources, findings, and downloads'
        : 'Inspect stored CRX packages and browse extension code';

  const renderOverviewPanel = () => (
    <Stack spacing={2}>
      <Paper
        variant="outlined"
        sx={{
          p: 2,
          display: 'flex',
          flexDirection: { xs: 'column', md: 'row' },
          justifyContent: 'space-between',
          alignItems: { md: 'center' },
          gap: 1.5,
        }}
      >
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="h6">Global Entry</Typography>
          <Typography variant="body2" color="text.secondary">
            Start here for the fastest path into stored websites, findings, bundles, and CRX
            captures.
          </Typography>
          <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ mt: 1.5 }}>
            <Chip size="small" label={`${domains.length} websites`} variant="outlined" />
            <Chip size="small" label={`${totalBundleGroups} bundle groups`} variant="outlined" />
            <Chip
              size="small"
              color={totalFindings > 0 ? 'error' : 'default'}
              label={`${totalFindings} findings`}
            />
            <Chip
              size="small"
              label={`${crxPackageGroups.length} CRX package groups`}
              variant="outlined"
            />
          </Stack>
        </Box>
        <Stack direction="row" spacing={1} flexWrap="wrap">
          <Button
            size="small"
            variant="contained"
            onClick={() => switchToTab('source-maps', 'overview_cards')}
          >
            Open Source Maps
          </Button>
          <Button
            size="small"
            variant="outlined"
            onClick={() => switchToTab('crx-packages', 'overview_cards')}
          >
            Open CRX Packages
          </Button>
        </Stack>
      </Paper>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: {
            xs: '1fr',
            xl: '1.1fr 0.9fr',
          },
          gap: 2,
        }}
      >
        <Card variant="outlined">
          <CardContent sx={{ p: 0 }}>
            <Box sx={{ px: 2, py: 1.5 }}>
              <Typography variant="h6">Priority Review Queue</Typography>
              <Typography variant="body2" color="text.secondary">
                Highest-signal websites and freshest captures to inspect next.
              </Typography>
            </Box>
            <Divider />
            {topDomainsWithFindings.length === 0 ? (
              <Box sx={{ px: 2, py: 2 }}>
                <Typography variant="body2" color="text.secondary">
                  No findings yet. Review recent source maps or inspect stored CRX packages.
                </Typography>
              </Box>
            ) : (
              <List disablePadding>
                {topDomainsWithFindings.map(domain => (
                  <ListItemButton
                    key={domain.hostname}
                    onClick={() => {
                      handleSelectDomain(domain.hostname);
                      switchToTab('source-maps', 'overview_cards');
                    }}
                    sx={{ px: 2, py: 1.25 }}
                  >
                    <ListItemText
                      primary={domain.hostname}
                      secondary={`${domain.leakCount} findings across ${domain.groupedFiles.length} bundles`}
                    />
                    <Chip size="small" color="error" label={`${domain.leakCount}`} />
                  </ListItemButton>
                ))}
              </List>
            )}
          </CardContent>
        </Card>

        <Card variant="outlined">
          <CardContent sx={{ p: 0 }}>
            <Box sx={{ px: 2, py: 1.5 }}>
              <Typography variant="h6">Recent Captures</Typography>
              <Typography variant="body2" color="text.secondary">
                Re-open the latest website pages and CRX packages directly from the index.
              </Typography>
            </Box>
            <Divider />
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' },
              }}
            >
              <Box sx={{ minWidth: 0 }}>
                <Box sx={{ px: 2, py: 1, bgcolor: 'action.hover' }}>
                  <Typography variant="subtitle2">Web Pages</Typography>
                </Box>
                {recentPages.length === 0 ? (
                  <Box sx={{ px: 2, py: 2 }}>
                    <Typography variant="body2" color="text.secondary">
                      No page captures yet.
                    </Typography>
                  </Box>
                ) : (
                  <List disablePadding>
                    {recentPages.map(page => (
                      <ListItemButton
                        key={page.id}
                        onClick={() => {
                          handleSelectDomain(page.hostname);
                          setSelectedPageId(page.id);
                          setSelectedGroupUrl(page.groupedFiles[0]?.url ?? null);
                          setSelectedFileId(page.groupedFiles[0]?.versions[0]?.id ?? null);
                          switchToTab('source-maps', 'overview_cards');
                        }}
                        sx={{ px: 2, py: 1.25 }}
                      >
                        <ListItemText
                          primary={page.title || page.hostname}
                          secondary={`${page.hostname} - ${formatTimestamp(page.timestamp)}`}
                        />
                      </ListItemButton>
                    ))}
                  </List>
                )}
              </Box>
              <Box sx={{ minWidth: 0, borderLeft: { md: 1 }, borderColor: 'divider' }}>
                <Box sx={{ px: 2, py: 1, bgcolor: 'action.hover' }}>
                  <Typography variant="subtitle2">CRX Packages</Typography>
                </Box>
                {recentCrxPackages.length === 0 ? (
                  <Box sx={{ px: 2, py: 2 }}>
                    <Typography variant="body2" color="text.secondary">
                      No CRX captures yet.
                    </Typography>
                  </Box>
                ) : (
                  <List disablePadding>
                    {recentCrxPackages.map(crxItem => (
                      <ListItemButton
                        key={crxItem.id}
                        onClick={() => {
                          const targetGroup = findCrxPackageGroupByRecordId(
                            crxPackageGroups,
                            crxItem.id
                          );
                          setSelectedCrxGroupKey(targetGroup?.key ?? null);
                          setSelectedCrxId(crxItem.id);
                          switchToTab('crx-packages', 'overview_cards');
                        }}
                        sx={{ px: 2, py: 1.25 }}
                      >
                        <ListItemText
                          primary={crxItem.pageTitle || getFileName(crxItem.pageUrl)}
                          secondary={`${formatBytes(crxItem.size)} - ${formatTimestamp(crxItem.timestamp)}`}
                        />
                      </ListItemButton>
                    ))}
                  </List>
                )}
              </Box>
            </Box>
          </CardContent>
        </Card>
      </Box>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: {
            xs: '1fr',
            sm: 'repeat(2, minmax(0, 1fr))',
            lg: 'repeat(4, minmax(0, 1fr))',
          },
          gap: 2,
        }}
      >
        <Card variant="outlined">
          <CardContent>
            <Typography variant="overline" color="text.secondary">
              Websites
            </Typography>
            <Typography variant="h5">{domains.length}</Typography>
            <Typography variant="body2" color="text.secondary">
              {totalPages} pages indexed
            </Typography>
          </CardContent>
        </Card>
        <Card variant="outlined">
          <CardContent>
            <Typography variant="overline" color="text.secondary">
              Source Bundles
            </Typography>
            <Typography variant="h5">{totalBundleGroups}</Typography>
            <Typography variant="body2" color="text.secondary">
              {totalSourceMapVersions} stored versions grouped by URL
            </Typography>
          </CardContent>
        </Card>
        <Card variant="outlined">
          <CardContent>
            <Typography variant="overline" color="text.secondary">
              Security Findings
            </Typography>
            <Typography variant="h5" color={totalFindings > 0 ? 'error.main' : 'success.main'}>
              {totalFindings}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              From latest source maps
            </Typography>
          </CardContent>
        </Card>
        <Card variant="outlined">
          <CardContent>
            <Typography variant="overline" color="text.secondary">
              CRX Packages
            </Typography>
            <Typography variant="h5">{crxPackageGroups.length}</Typography>
            <Typography variant="body2" color="text.secondary">
              {crxPackages.length} captured package snapshots
            </Typography>
          </CardContent>
        </Card>
      </Box>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: {
            xs: '1fr',
            xl: 'repeat(2, minmax(0, 1fr))',
          },
          gap: 2,
        }}
      >
        <Card variant="outlined">
          <CardContent sx={{ p: 0, display: 'flex', flexDirection: 'column', height: '100%' }}>
            <Box sx={{ px: 2, py: 1.5 }}>
              <Typography variant="h6">All Indexed Websites</Typography>
              <Typography variant="body2" color="text.secondary">
                Highest-risk websites stay near the top for faster review.
              </Typography>
            </Box>
            <Divider />
            {domains.length === 0 ? (
              <Box sx={{ p: 2 }}>
                <Typography variant="body2" color="text.secondary">
                  No websites indexed yet. Visit a website and let Source Detector capture source
                  maps.
                </Typography>
              </Box>
            ) : (
              <List disablePadding sx={{ maxHeight: 420, overflowY: 'auto' }}>
                {domains.map(domain => (
                  <ListItemButton
                    key={domain.hostname}
                    onClick={() => {
                      handleSelectDomain(domain.hostname);
                      switchToTab('source-maps', 'overview_cards');
                    }}
                    sx={{ px: 2, py: 1 }}
                  >
                    <ListItemText
                      primary={domain.hostname}
                      secondary={`${domain.pages.length} pages · ${domain.groupedFiles.length} bundles · ${domain.leakCount} findings`}
                    />
                    <Chip
                      size="small"
                      color={domain.leakCount > 0 ? 'error' : 'default'}
                      label={domain.leakCount > 0 ? `${domain.leakCount} findings` : 'Clean'}
                    />
                  </ListItemButton>
                ))}
              </List>
            )}
          </CardContent>
        </Card>

        <Card variant="outlined">
          <CardContent sx={{ p: 0, display: 'flex', flexDirection: 'column', height: '100%' }}>
            <Box sx={{ px: 2, py: 1.5 }}>
              <Typography variant="h6">All Stored CRX Package Groups</Typography>
              <Typography variant="body2" color="text.secondary">
                Grouped by package identity to avoid duplicate parameter variants.
              </Typography>
            </Box>
            <Divider />
            {crxPackageGroups.length === 0 ? (
              <Box sx={{ p: 2 }}>
                <Typography variant="body2" color="text.secondary">
                  No CRX package stored yet. Open a Chrome Web Store page first.
                </Typography>
              </Box>
            ) : (
              <List disablePadding sx={{ maxHeight: 420, overflowY: 'auto' }}>
                {crxPackageGroups.map(crxGroup => (
                  <ListItemButton
                    key={crxGroup.key}
                    onClick={() => {
                      handleSelectCrxGroup(crxGroup.key);
                      switchToTab('crx-packages', 'overview_cards');
                    }}
                    sx={{ px: 2, py: 1 }}
                  >
                    <ListItemText
                      primary={
                        crxGroup.latestRecord.pageTitle || getFileName(crxGroup.latestRecord.pageUrl)
                      }
                      secondary={
                        <Stack spacing={0.25}>
                          <Typography
                            variant="caption"
                            color="text.secondary"
                            sx={{ wordBreak: 'break-all' }}
                          >
                            {crxGroup.canonicalPageUrl}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {crxGroup.records.length} captures · {formatBytes(crxGroup.totalSize)} total
                            · {formatTimestamp(crxGroup.latestRecord.timestamp)}
                          </Typography>
                        </Stack>
                      }
                    />
                    <Chip size="small" variant="outlined" label={crxGroup.records.length} />
                  </ListItemButton>
                ))}
              </List>
            )}
          </CardContent>
        </Card>
      </Box>
    </Stack>
  );

  const renderSourceMapsPanel = () => {
    if (domains.length === 0) {
      return <Alert severity="info">No source maps are currently available in IndexedDB.</Alert>;
    }

    const renderDirectoryTreeNodes = (
      directories: SourceMapTreeDirectoryNode[],
      hostname: string,
      pageId: number,
      depth: number
    ): JSX.Element[] =>
      directories.flatMap(directory => {
        const isExpanded = isSourceMapNodeExpanded(
          directory.id,
          selectedSourceMapDirectoryNodeIds.has(directory.id)
        );
        const fileCount = countSourceMapTreeFiles([directory]);

        const directoryRow = (
          <ListItemButton
            key={directory.id}
            onClick={() =>
              toggleSourceMapNode(directory.id, selectedSourceMapDirectoryNodeIds.has(directory.id))
            }
            sx={{ pl: 2 + depth * 1.5, py: 0.75 }}
          >
            <Box sx={{ mr: 0.75, display: 'flex', alignItems: 'center' }}>
              {isExpanded ? (
                <ExpandMoreIcon fontSize="small" />
              ) : (
                <ChevronRightIcon fontSize="small" />
              )}
            </Box>
            <Box sx={{ mr: 1, display: 'flex', alignItems: 'center' }}>
              <FolderIcon fontSize="small" />
            </Box>
            <ListItemText primary={directory.name} secondary={`${fileCount} files`} />
          </ListItemButton>
        );

        const fileRows = directory.files.map(fileNode => {
          const latestVersion = fileNode.group.versions[0];
          const findingsCount = latestVersion?.findings?.length ?? 0;
          return (
            <ListItemButton
              key={fileNode.id}
              selected={selectedPageId === pageId && selectedGroupUrl === fileNode.group.url}
              onClick={() =>
                handleSelectSourceMapGroup(
                  hostname,
                  pageId,
                  fileNode.group.url,
                  latestVersion?.id ?? null
                )
              }
              sx={{ pl: 2 + (depth + 1) * 1.5, py: 0.65 }}
            >
              <Box sx={{ width: 20, mr: 0.5 }} />
              <Box sx={{ mr: 1, display: 'flex', alignItems: 'center' }}>
                {getFileIcon(fileNode.name)}
              </Box>
              <ListItemText
                primary={fileNode.name}
                secondary={`${fileNode.group.versions.length} versions`}
              />
              {findingsCount > 0 && <Chip size="small" color="error" label={findingsCount} />}
            </ListItemButton>
          );
        });

        const childDirectoryRows = renderDirectoryTreeNodes(
          directory.directories,
          hostname,
          pageId,
          depth + 1
        );

        return [
          directoryRow,
          <Collapse key={`${directory.id}:children`} in={isExpanded} timeout={160} unmountOnExit={false}>
            <Box sx={{ minHeight: 0 }}>
              {fileRows}
              {childDirectoryRows}
            </Box>
          </Collapse>,
        ];
      });

    return (
      <Box
        sx={{
          display: 'flex',
          gap: 2,
          flexDirection: { xs: 'column', lg: 'row' },
        }}
      >
        <Card
          variant="outlined"
          sx={{
            width: { lg: 340 },
            flexShrink: 0,
            maxHeight: { lg: 'calc(100vh - 180px)' },
          }}
        >
          <CardContent sx={{ p: 0, height: '100%', display: 'flex', flexDirection: 'column' }}>
            <Box sx={{ px: 2, py: 1.5 }}>
              <Typography variant="h6">Navigation</Typography>
              <Typography variant="body2" color="text.secondary">
                Website - Page - Directory - File
              </Typography>
            </Box>
            <Divider />
            <List disablePadding sx={{ overflowY: 'auto', flexGrow: 1 }}>
              {sourceMapNavigationTree.map(domainEntry => {
                const domainNodeId = `domain:${domainEntry.hostname}`;
                const domainExpanded = isSourceMapNodeExpanded(
                  domainNodeId,
                  domainEntry.hostname === selectedDomainHostname
                );
                return (
                  <Box key={domainNodeId} sx={{ minHeight: 0 }}>
                    <ListItemButton
                      selected={selectedDomainHostname === domainEntry.hostname}
                      onClick={() => {
                        handleSelectDomain(domainEntry.hostname);
                        toggleSourceMapNode(
                          domainNodeId,
                          domainEntry.hostname === selectedDomainHostname
                        );
                      }}
                      sx={{ pl: 2, py: 0.85 }}
                    >
                      <Box sx={{ mr: 0.75, display: 'flex', alignItems: 'center' }}>
                        {domainExpanded ? (
                          <ExpandMoreIcon fontSize="small" />
                        ) : (
                          <ChevronRightIcon fontSize="small" />
                        )}
                      </Box>
                      <Box sx={{ mr: 1, display: 'flex', alignItems: 'center' }}>
                        <LanguageIcon fontSize="small" />
                      </Box>
                      <ListItemText
                        primary={domainEntry.hostname}
                        secondary={`${domainEntry.pages.length} pages · ${domainEntry.leakCount} findings`}
                      />
                      {domainEntry.leakCount > 0 && (
                        <Chip size="small" color="error" label={domainEntry.leakCount} />
                      )}
                    </ListItemButton>

                    <Collapse in={domainExpanded} timeout={160} unmountOnExit={false}>
                      <Box sx={{ minHeight: 0 }}>
                        {domainEntry.pages.map(pageEntry => {
                          const pageNodeId = `page:${pageEntry.pageId}`;
                          const pageExpanded = isSourceMapNodeExpanded(
                            pageNodeId,
                            selectedPageId === pageEntry.pageId
                          );

                          return (
                            <Box key={pageNodeId} sx={{ minHeight: 0 }}>
                              <ListItemButton
                                selected={selectedPageId === pageEntry.pageId}
                                onClick={() => {
                                  handleSelectPage(pageEntry.pageId);
                                  toggleSourceMapNode(pageNodeId, selectedPageId === pageEntry.pageId);
                                }}
                                sx={{ pl: 3.5, py: 0.75 }}
                              >
                                <Box sx={{ mr: 0.75, display: 'flex', alignItems: 'center' }}>
                                  {pageExpanded ? (
                                    <ExpandMoreIcon fontSize="small" />
                                  ) : (
                                    <ChevronRightIcon fontSize="small" />
                                  )}
                                </Box>
                                <Box sx={{ mr: 1, display: 'flex', alignItems: 'center' }}>
                                  <LinkIcon fontSize="small" />
                                </Box>
                                <ListItemText
                                  primary={pageEntry.pageTitle || domainEntry.hostname}
                                  secondary={
                                    <Typography
                                      variant="caption"
                                      color="text.secondary"
                                      sx={{ wordBreak: 'break-all' }}
                                    >
                                      {pageEntry.pageUrl}
                                    </Typography>
                                  }
                                />
                              </ListItemButton>

                              <Collapse in={pageExpanded} timeout={160} unmountOnExit={false}>
                                <Box sx={{ minHeight: 0 }}>
                                  {pageEntry.directories.length === 0 ? (
                                    <ListItemText
                                      primary="No source maps captured for this page."
                                      secondary={`${pageEntry.groupedFileCount} files`}
                                      sx={{ px: 7, py: 1.25 }}
                                    />
                                  ) : (
                                    renderDirectoryTreeNodes(
                                      pageEntry.directories,
                                      domainEntry.hostname,
                                      pageEntry.pageId,
                                      2
                                    )
                                  )}
                                </Box>
                              </Collapse>
                            </Box>
                          );
                        })}
                      </Box>
                    </Collapse>
                  </Box>
                );
              })}
            </List>
          </CardContent>
        </Card>

        <Box sx={{ flexGrow: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
          {!selectedFile ? (
            <Alert severity="info">Select a bundle to inspect source code and findings.</Alert>
          ) : (
            <>
              <Card variant="outlined">
                <CardContent>
                  <Box
                    sx={{
                      display: 'flex',
                      flexDirection: { xs: 'column', md: 'row' },
                      justifyContent: 'space-between',
                      gap: 2,
                    }}
                  >
                    <Box sx={{ minWidth: 0 }}>
                      <Typography variant="h6">{getFileName(selectedFile.url)}</Typography>
                      <Typography
                        variant="body2"
                        color="text.secondary"
                        sx={{ wordBreak: 'break-all' }}
                      >
                        {selectedFile.url}
                      </Typography>
                      <Stack direction="row" spacing={1} sx={{ mt: 1.5 }} flexWrap="wrap">
                        <Chip
                          size="small"
                          label={`Version ${selectedFile.version}`}
                          variant="outlined"
                        />
                        <Chip
                          size="small"
                          label={`Size ${formatBytes(selectedFile.size)}`}
                          variant="outlined"
                        />
                        <Chip
                          size="small"
                          color={selectedFindings.length > 0 ? 'error' : 'success'}
                          label={`${selectedFindings.length} findings`}
                        />
                        <Chip
                          size="small"
                          color={sourceEntries.length > 0 ? 'primary' : 'default'}
                          label={`${sourceEntries.length} source files`}
                        />
                      </Stack>
                    </Box>
                    <Stack direction="row" spacing={1} flexWrap="wrap">
                      <Button
                        size="small"
                        variant="outlined"
                        startIcon={<CloudDownloadIcon />}
                        onClick={() => {
                          void handleDownloadSingle();
                        }}
                        disabled={downloadingFileId === selectedFile.id || downloadingBatch}
                      >
                        {downloadingFileId === selectedFile.id
                          ? 'Downloading...'
                          : 'Download Selected ZIP'}
                      </Button>
                      <Button
                        size="small"
                        variant="contained"
                        startIcon={<CloudDownloadIcon />}
                        onClick={() => {
                          void handleDownloadDomainZip();
                        }}
                        disabled={downloadingBatch || latestDomainFiles.length === 0}
                      >
                        {downloadingBatch ? 'Bundling...' : 'Download Domain ZIP'}
                      </Button>
                    </Stack>
                  </Box>

                  {selectedGroup && selectedGroup.versions.length > 1 && (
                    <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ mt: 2 }}>
                      {selectedGroup.versions.map(version => (
                        <Chip
                          key={version.id}
                          size="small"
                          label={`v${version.version}`}
                          color={version.id === selectedFile.id ? 'primary' : 'default'}
                          variant={version.id === selectedFile.id ? 'filled' : 'outlined'}
                          onClick={() => setSelectedFileId(version.id)}
                          clickable
                        />
                      ))}
                    </Stack>
                  )}
                </CardContent>
              </Card>

              {selectedFindings.length > 0 && (
                <Card variant="outlined">
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      Security Findings
                    </Typography>
                    <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ mb: 1.5 }}>
                      {findingTypeSummary.map(summary => (
                        <Chip
                          key={summary.ruleName}
                          size="small"
                          color="error"
                          variant="outlined"
                          label={`${summary.ruleName} (${summary.count})`}
                        />
                      ))}
                    </Stack>
                    <Paper variant="outlined" sx={{ maxHeight: 180, overflowY: 'auto' }}>
                      <List disablePadding>
                        {selectedFindings.map((finding, index) => (
                          <ListItemButton
                            key={`${finding.ruleId}-${finding.startIndex}-${index}`}
                            selected={index === selectedFindingIndex}
                            onClick={() => setSelectedFindingIndex(index)}
                          >
                            <ListItemText
                              primary={finding.ruleName}
                              secondary={`Line ${finding.line}, Col ${finding.column}`}
                            />
                          </ListItemButton>
                        ))}
                      </List>
                    </Paper>
                    {selectedFinding && (
                      <Paper
                        ref={evidenceRef}
                        variant="outlined"
                        sx={{
                          mt: 1.5,
                          p: 2,
                          borderColor: 'error.main',
                          bgcolor: 'rgba(244, 67, 54, 0.08)',
                        }}
                      >
                        <Typography variant="subtitle1" color="error.main">
                          Leak Evidence
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                          {selectedFinding.ruleName} at Line {selectedFinding.line}, Col{' '}
                          {selectedFinding.column}
                        </Typography>
                        <Box
                          component="code"
                          sx={{
                            mt: 1,
                            display: 'block',
                            p: 1,
                            borderRadius: 1,
                            border: 1,
                            borderColor: 'divider',
                            bgcolor: 'background.paper',
                            fontFamily: 'monospace',
                            fontSize: 12,
                            wordBreak: 'break-all',
                          }}
                        >
                          {selectedFinding.matchedText}
                        </Box>
                      </Paper>
                    )}
                  </CardContent>
                </Card>
              )}

              <Box
                sx={{
                  display: 'flex',
                  gap: 2,
                  flexDirection: { xs: 'column', xl: 'row' },
                  alignItems: 'stretch',
                }}
              >
                <Card
                  variant="outlined"
                  sx={{
                    width: { xl: 240 },
                    flexShrink: 0,
                  }}
                >
                  <CardContent
                    sx={{ p: 0, height: '100%', display: 'flex', flexDirection: 'column' }}
                  >
                    <Box sx={{ px: 2, py: 1.5 }}>
                      <Typography variant="h6">Original Sources</Typography>
                      <Typography variant="body2" color="text.secondary">
                        Browse embedded sources from source map
                      </Typography>
                    </Box>
                    <Divider />
                    <List
                      disablePadding
                      sx={{
                        overflowY: 'auto',
                        flexGrow: 1,
                        maxHeight: { xs: 260, xl: 'calc(100vh - 360px)' },
                      }}
                    >
                      {sourceTree.children.length > 0 ? (
                        renderTreeList(
                          sourceTree.children,
                          selectedSourcePath,
                          setSelectedSourcePath
                        )
                      ) : (
                        <ListItemText
                          primary="No original sources embedded in this source map."
                          sx={{ px: 2, py: 2 }}
                        />
                      )}
                    </List>
                  </CardContent>
                </Card>

                <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                  <CodeViewer filePath={sourceViewerPath} content={sourceViewerContent} />
                </Box>
              </Box>
            </>
          )}
        </Box>
      </Box>
    );
  };

  const renderCrxPackagesPanel = () => {
    if (crxPackageGroups.length === 0) {
      return <Alert severity="info">No CRX packages are currently available in IndexedDB.</Alert>;
    }

    return (
      <Box
        sx={{
          display: 'flex',
          gap: 2,
          flexDirection: { xs: 'column', lg: 'row' },
        }}
      >
        <Card
          variant="outlined"
          sx={{
            width: { lg: 320 },
            flexShrink: 0,
            height: { lg: 'calc(100vh - 160px)' },
            minHeight: 0,
          }}
        >
          <CardContent sx={{ p: 0, height: '100%', display: 'flex', flexDirection: 'column' }}>
            <Box sx={{ px: 2, py: 1.5 }}>
              <Typography variant="h6">CRX Package Groups</Typography>
              <Typography variant="body2" color="text.secondary">
                Website → package group → capture
              </Typography>
            </Box>
            <Divider />
            <List disablePadding sx={{ overflowY: 'auto', flexGrow: 1 }}>
              {Array.from(new Map(crxPackageGroups.map(group => [group.hostname, crxPackageGroups.filter(item => item.hostname === group.hostname)])).entries()).map(([hostname, groups]) => {
                const hostNodeId = `crx-host:${hostname}`;
                const hostExpanded = isCrxNodeExpanded(hostNodeId, true);
                return (
                  <Box key={hostNodeId} sx={{ minHeight: 0 }}>
                    <ListItemButton onClick={() => toggleCrxNode(hostNodeId, true)} sx={{ pl: 2, py: 0.85 }}>
                      <Box sx={{ mr: 0.75, display: 'flex', alignItems: 'center' }}>
                        {hostExpanded ? <ExpandMoreIcon fontSize="small" /> : <ChevronRightIcon fontSize="small" />}
                      </Box>
                      <Box sx={{ mr: 1, display: 'flex', alignItems: 'center' }}>
                        <LanguageIcon fontSize="small" />
                      </Box>
                      <ListItemText primary={hostname} secondary={`${groups.length} package groups`} />
                    </ListItemButton>
                    <Collapse in={hostExpanded} timeout={160} unmountOnExit={false}>
                      <Box sx={{ minHeight: 0 }}>
                        {groups.map(crxGroup => {
                          const groupNodeId = `crx-group:${crxGroup.key}`;
                          const groupExpanded = isCrxNodeExpanded(groupNodeId, selectedCrxGroup?.key === crxGroup.key);
                          return (
                            <Box key={groupNodeId} sx={{ minHeight: 0 }}>
                              <ListItemButton
                                selected={selectedCrxGroup?.key === crxGroup.key}
                                onClick={() => {
                                  handleSelectCrxGroup(crxGroup.key);
                                  toggleCrxNode(groupNodeId, selectedCrxGroup?.key === crxGroup.key);
                                }}
                                sx={{ pl: 3.5, py: 0.75 }}
                              >
                                <Box sx={{ mr: 0.75, display: 'flex', alignItems: 'center' }}>
                                  {groupExpanded ? <ExpandMoreIcon fontSize="small" /> : <ChevronRightIcon fontSize="small" />}
                                </Box>
                                <Box sx={{ mr: 1, display: 'flex', alignItems: 'center' }}>
                                  <FolderIcon fontSize="small" />
                                </Box>
                                <ListItemText
                                  primary={crxGroup.latestRecord.pageTitle || getFileName(crxGroup.latestRecord.pageUrl)}
                                  secondary={`${crxGroup.records.length} captures · ${formatBytes(crxGroup.totalSize)} total`}
                                />
                              </ListItemButton>
                              <Collapse in={groupExpanded} timeout={160} unmountOnExit={false}>
                                <Box sx={{ minHeight: 0 }}>
                                  {crxGroup.records.map(record => (
                                    <ListItemButton
                                      key={record.id}
                                      selected={selectedCrxId === record.id}
                                      onClick={() => {
                                        setSelectedCrxGroupKey(crxGroup.key);
                                        setSelectedCrxId(record.id);
                                      }}
                                      sx={{ pl: 5, py: 0.7 }}
                                    >
                                      <Box sx={{ mr: 1, display: 'flex', alignItems: 'center' }}>
                                        <LinkIcon fontSize="small" />
                                      </Box>
                                      <ListItemText
                                        primary={formatTimestamp(record.timestamp)}
                                        secondary={
                                          <Typography variant="caption" color="text.secondary" sx={{ wordBreak: 'break-all' }}>
                                            {record.pageUrl}
                                          </Typography>
                                        }
                                      />
                                    </ListItemButton>
                                  ))}
                                </Box>
                              </Collapse>
                            </Box>
                          );
                        })}
                      </Box>
                    </Collapse>
                  </Box>
                );
              })}
            </List>
          </CardContent>
        </Card>

        <Box sx={{ flexGrow: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
          {!selectedCrx || !selectedCrxGroup ? (
            <Alert severity="info">Select a CRX package to inspect files.</Alert>
          ) : (
            <>
              <Card variant="outlined">
                <CardContent>
                  <Box
                    sx={{
                      display: 'flex',
                      flexDirection: { xs: 'column', md: 'row' },
                      justifyContent: 'space-between',
                      gap: 2,
                    }}
                  >
                    <Box sx={{ minWidth: 0 }}>
                      <Typography variant="h6">
                        {selectedCrx.pageTitle || 'Extension package'}
                      </Typography>
                      <Typography
                        variant="body2"
                        color="text.secondary"
                        sx={{ wordBreak: 'break-all' }}
                      >
                        {selectedCrxGroup.canonicalPageUrl}
                      </Typography>
                      <Stack direction="row" spacing={1} sx={{ mt: 1.5 }} flexWrap="wrap">
                        <Chip
                          size="small"
                          label={`Size ${formatBytes(selectedCrx.size)}`}
                          variant="outlined"
                        />
                        <Chip
                          size="small"
                          label={`${selectedCrx.count} files`}
                          variant="outlined"
                        />
                        <Chip
                          size="small"
                          label={`Updated ${formatTimestamp(selectedCrx.timestamp)}`}
                          variant="outlined"
                        />
                        <Chip
                          size="small"
                          label={`${selectedCrxGroup.records.length} captures`}
                          variant="outlined"
                        />
                        <Chip
                          size="small"
                          label={`Group total ${formatBytes(selectedCrxGroup.totalSize)}`}
                          variant="outlined"
                        />
                      </Stack>
                    </Box>
                    <Button
                      size="small"
                      variant="contained"
                      startIcon={<CloudDownloadIcon />}
                      onClick={handleDownloadCrx}
                    >
                      Download CRX
                    </Button>
                  </Box>
                  {selectedCrxGroup.records.length > 1 && (
                    <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ mt: 2 }}>
                      {selectedCrxGroup.records.map(record => (
                        <Chip
                          key={record.id}
                          size="small"
                          label={formatTimestamp(record.timestamp)}
                          color={record.id === selectedCrx.id ? 'primary' : 'default'}
                          variant={record.id === selectedCrx.id ? 'filled' : 'outlined'}
                          onClick={() => setSelectedCrxId(record.id)}
                          clickable
                        />
                      ))}
                    </Stack>
                  )}
                </CardContent>
              </Card>

              {loadingCrxSource ? (
                <Paper variant="outlined" sx={{ p: 4, display: 'flex', justifyContent: 'center' }}>
                  <CircularProgress />
                </Paper>
              ) : !crxTree ? (
                <Alert severity="info">Failed to load extension files for this package.</Alert>
              ) : (
                <Box
                  sx={{
                    display: 'flex',
                    gap: 2,
                    flexDirection: { xs: 'column', xl: 'row' },
                    alignItems: 'stretch',
                  }}
                >
                  <Card
                    variant="outlined"
                    sx={{
                      width: { xl: 240 },
                      flexShrink: 0,
                    }}
                  >
                    <CardContent sx={{ p: 0, display: 'flex', flexDirection: 'column' }}>
                      <Box sx={{ px: 2, py: 1.5 }}>
                        <Typography variant="h6">Package Files</Typography>
                        <Typography variant="body2" color="text.secondary">
                          File tree for selected CRX package
                        </Typography>
                      </Box>
                      <Divider />
                      <List
                        disablePadding
                        sx={{
                          overflowY: 'auto',
                          maxHeight: { xs: 260, xl: 'calc(100vh - 320px)' },
                        }}
                      >
                        {renderTreeList(crxTree.children, selectedCrxPath, setSelectedCrxPath)}
                      </List>
                    </CardContent>
                  </Card>
                  <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                    {selectedCrxPath && selectedCrxContent !== null ? (
                      isTextLikeFile(selectedCrxPath) ? (
                        <CodeViewer filePath={selectedCrxPath} content={selectedCrxContent} />
                      ) : (
                        <Alert severity="info">
                          This file appears to be binary and is not previewed inline.
                        </Alert>
                      )
                    ) : (
                      <Alert severity="info">Select a file to inspect extension source.</Alert>
                    )}
                  </Box>
                </Box>
              )}
            </>
          )}
        </Box>
      </Box>
    );
  };

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
        <AppBar position="sticky">
          <Toolbar sx={{ display: 'flex', alignItems: 'flex-start', gap: 2, py: 1.25 }}>
            <Box sx={{ flexGrow: 1, minWidth: 0 }}>
              <Typography variant="h6" component="div">
                Source Explorer
              </Typography>
              <Typography variant="body2" sx={{ opacity: 0.9 }}>
                {tabDescription}
              </Typography>
              <Tabs
                value={activeTab}
                onChange={handleTabChange}
                textColor="inherit"
                indicatorColor="secondary"
                sx={{ mt: 1 }}
                variant="scrollable"
                allowScrollButtonsMobile
              >
                <Tab value="overview" label="Overview" />
                <Tab value="source-maps" label="Source Maps" />
                <Tab value="crx-packages" label="CRX Packages" />
              </Tabs>
            </Box>
            <Stack direction="row" spacing={1} sx={{ pt: 0.5 }}>
              <Button color="inherit" startIcon={<GitHubIcon />} onClick={handleOpenGithubFeedback}>
                Feedback
              </Button>
            </Stack>
          </Toolbar>
        </AppBar>

        <Container maxWidth={false} sx={{ py: 2.5 }}>
          {loading ? (
            <Box display="flex" justifyContent="center" alignItems="center" minHeight="60vh">
              <CircularProgress />
            </Box>
          ) : error ? (
            <Alert severity="error">{error}</Alert>
          ) : activeTab === 'overview' ? (
            renderOverviewPanel()
          ) : activeTab === 'source-maps' ? (
            renderSourceMapsPanel()
          ) : (
            renderCrxPackagesPanel()
          )}
        </Container>
      </Box>

      <Snackbar
        open={toast.open}
        autoHideDuration={2400}
        onClose={() => setToast(previousState => ({ ...previousState, open: false }))}
      >
        <Alert
          severity={toast.severity}
          variant="filled"
          onClose={() => setToast(previousState => ({ ...previousState, open: false }))}
          sx={{ width: '100%' }}
        >
          {toast.message}
        </Alert>
      </Snackbar>
    </ThemeProvider>
  );
}
