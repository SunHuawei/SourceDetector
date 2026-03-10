import { SourceDetectorDB } from '@/storage/database';
import { LeakFinding, SourceMapFile } from '@/types';
import { formatBytes } from '@/utils/format';
import { SourceMapDownloader } from '@/utils/sourceMapDownloader';
import { trackEvent } from '@/utils/analytics';
import {
    Alert,
    AppBar,
    Box,
    Button,
    Card,
    CardContent,
    Chip,
    CircularProgress,
    Container,
    CssBaseline,
    Divider,
    Grid,
    IconButton,
    List,
    ListItemButton,
    ListItemText,
    Paper,
    Snackbar,
    Stack,
    ThemeProvider,
    Toolbar,
    Tooltip,
    Typography,
    createTheme
} from '@mui/material';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
    SourceExplorerDomainEntry,
    buildSourceExplorerDomains,
    getDomainGroupedFiles,
    resolveSourceExplorerSelection
} from './sourceExplorerData';
import { GITHUB_FEEDBACK_URL } from '@/constants/links';
import { GitHub as GitHubIcon } from '@mui/icons-material';

interface SourceExplorerNavigationState {
    actionType: string;
    resourceType: string;
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

const theme = createTheme({
    palette: {
        mode: 'light',
        primary: {
            main: '#3f51b5'
        }
    }
});

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

function readStringOption(options: Record<string, unknown>, key: string): string | undefined {
    const value = options[key];
    return typeof value === 'string' && value.trim().length > 0 ? value : undefined;
}

function readNumberOption(options: Record<string, unknown>, key: string): number | undefined {
    const value = options[key];
    if (typeof value === 'string') {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : undefined;
    }
    return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function readSearchParam(searchParams: URLSearchParams, key: string): string | undefined {
    const value = searchParams.get(key);
    return value && value.trim().length > 0 ? value : undefined;
}

function parseNavigationState(): SourceExplorerNavigationState {
    const searchParams = new URLSearchParams(window.location.search);
    const actionType = readSearchParam(searchParams, 'type') ?? '';
    const rawOptions = readSearchParam(searchParams, 'options');
    let options: Record<string, unknown> = {};

    if (rawOptions) {
        try {
            options = JSON.parse(rawOptions) as Record<string, unknown>;
        } catch {
            try {
                options = JSON.parse(decodeURIComponent(rawOptions)) as Record<string, unknown>;
            } catch (error) {
                console.warn('Failed to parse source explorer options query parameter:', error);
            }
        }
    }

    const resourceType = readSearchParam(searchParams, 'resourceType')
        ?? readStringOption(options, 'type')
        ?? 'source-files';
    const pageUrl = readSearchParam(searchParams, 'url') ?? readStringOption(options, 'url');
    const sourceUrl = readSearchParam(searchParams, 'sourceUrl')
        ?? readStringOption(options, 'sourceUrl')
        ?? readStringOption(options, 'groupUrl');
    const sourceMapFileId = parseNumericValue(readSearchParam(searchParams, 'sourceMapFileId') ?? null)
        ?? readNumberOption(options, 'sourceMapFileId');
    const view = readSearchParam(searchParams, 'view') ?? readStringOption(options, 'view');

    return {
        actionType,
        resourceType,
        pageUrl: pageUrl ?? undefined,
        sourceUrl: sourceUrl ?? undefined,
        sourceMapFileId,
        view: view ?? undefined
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

function getCodeViewerPreview(file: SourceMapFile | null, selectedFinding: LeakFinding | null): string {
    if (!file) {
        return 'No file selected.';
    }

    if (selectedFinding?.contextLines && selectedFinding.contextLines.length > 0) {
        return selectedFinding.contextLines
            .map((contextLine) => `${contextLine.line.toString().padStart(4, ' ')} | ${contextLine.content}`)
            .join('\n');
    }

    const sourceLines = file.originalContent.split('\n');
    const previewLineCount = 120;
    const previewLines = sourceLines.slice(0, previewLineCount);
    const suffix = sourceLines.length > previewLineCount
        ? `\n... (${sourceLines.length - previewLineCount} more lines hidden)`
        : '';

    return previewLines.join('\n') + suffix;
}

export default function SourceExplorerApp() {
    const db = useMemo(() => new SourceDetectorDB(), []);
    const navigationState = useMemo(() => parseNavigationState(), []);

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
    const [toast, setToast] = useState<ToastState>({
        open: false,
        message: '',
        severity: 'info'
    });
    const evidenceRef = useRef<HTMLDivElement | null>(null);

    const selectedDomain = useMemo(
        () => domains.find((domain) => domain.hostname === selectedDomainHostname) ?? null,
        [domains, selectedDomainHostname]
    );
    const selectedPage = useMemo(
        () => selectedDomain?.pages.find((page) => page.id === selectedPageId) ?? selectedDomain?.pages[0] ?? null,
        [selectedDomain, selectedPageId]
    );
    const domainGroupedFiles = useMemo(
        () => getDomainGroupedFiles(domains, selectedDomainHostname),
        [domains, selectedDomainHostname]
    );
    const selectedGroup = useMemo(
        () => domainGroupedFiles.find((group) => group.url === selectedGroupUrl) ?? null,
        [domainGroupedFiles, selectedGroupUrl]
    );

    const selectedFile = useMemo(() => {
        if (!selectedGroup) {
            return null;
        }
        if (selectedFileId !== null) {
            const matchedVersion = selectedGroup.versions.find((version) => version.id === selectedFileId);
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
        () => domainGroupedFiles
            .map((group) => group.versions[0])
            .filter((file): file is SourceMapFile => Boolean(file)),
        [domainGroupedFiles]
    );

    const showToast = (message: string, severity: ToastSeverity = 'info') => {
        setToast({
            open: true,
            message,
            severity
        });
    };

    useEffect(() => {
        let cancelled = false;

        const loadData = async () => {
            setLoading(true);
            setError(null);

            try {
                if (navigationState.resourceType !== 'source-files') {
                    setDomains([]);
                    setSelectedDomainHostname(null);
                    setSelectedPageId(null);
                    setSelectedGroupUrl(null);
                    setSelectedFileId(null);
                    return;
                }

                const [pages, pageSourceMaps, sourceMapFiles] = await Promise.all([
                    db.pages.toArray(),
                    db.pageSourceMaps.toArray(),
                    db.sourceMapFiles.toArray()
                ]);

                const nextDomains = buildSourceExplorerDomains(pages, pageSourceMaps, sourceMapFiles);
                const initialSelection = resolveSourceExplorerSelection(nextDomains, {
                    pageUrl: navigationState.pageUrl,
                    sourceUrl: navigationState.sourceUrl,
                    sourceMapFileId: navigationState.sourceMapFileId
                });

                const resolvedDomain = nextDomains.find(
                    (domain) => domain.hostname === initialSelection.selectedDomainHostname
                );
                const resolvedGroup = resolvedDomain?.groupedFiles.find(
                    (group) => group.url === initialSelection.selectedGroupUrl
                );
                const resolvedFile = initialSelection.selectedFileId !== null
                    ? resolvedGroup?.versions.find((version) => version.id === initialSelection.selectedFileId)
                    : resolvedGroup?.versions[0];

                if (cancelled) {
                    return;
                }

                setDomains(nextDomains);
                setSelectedDomainHostname(initialSelection.selectedDomainHostname);
                setSelectedPageId(initialSelection.selectedPageId);
                setSelectedGroupUrl(initialSelection.selectedGroupUrl);
                setSelectedFileId(initialSelection.selectedFileId);
                setSelectedFindingIndex(0);
                setShouldScrollToEvidence(Boolean(
                    resolvedFile
                    && (resolvedFile.findings?.length ?? 0) > 0
                    && (
                        navigationState.view === 'leak-findings'
                        || navigationState.sourceUrl
                        || typeof navigationState.sourceMapFileId === 'number'
                    )
                ));
            } catch (loadError) {
                if (!cancelled) {
                    console.error('Error loading source explorer data:', loadError);
                    setError(loadError instanceof Error ? loadError.message : 'Failed to load Source Explorer data.');
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
        if (selectedPageId === null || !selectedDomain.pages.some((page) => page.id === selectedPageId)) {
            setSelectedPageId(selectedDomain.pages[0]?.id ?? null);
        }
    }, [selectedDomain, selectedPageId]);

    useEffect(() => {
        if (domainGroupedFiles.length === 0) {
            setSelectedGroupUrl(null);
            setSelectedFileId(null);
            return;
        }
        if (!selectedGroup || !domainGroupedFiles.some((group) => group.url === selectedGroup.url)) {
            setSelectedGroupUrl(domainGroupedFiles[0].url);
            setSelectedFileId(domainGroupedFiles[0].versions[0]?.id ?? null);
        }
    }, [domainGroupedFiles, selectedGroup]);

    useEffect(() => {
        if (!selectedGroup || selectedGroup.versions.length === 0) {
            return;
        }
        if (selectedFileId === null || !selectedGroup.versions.some((version) => version.id === selectedFileId)) {
            setSelectedFileId(selectedGroup.versions[0].id);
        }
    }, [selectedFileId, selectedGroup]);

    useEffect(() => {
        setSelectedFindingIndex(0);
    }, [selectedFile?.id]);

    useEffect(() => {
        if (selectedFindingIndex >= selectedFindings.length && selectedFindings.length > 0) {
            setSelectedFindingIndex(0);
        }
    }, [selectedFindingIndex, selectedFindings.length]);

    useEffect(() => {
        if (!shouldScrollToEvidence || !selectedFinding || !evidenceRef.current) {
            return;
        }
        evidenceRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
        setShouldScrollToEvidence(false);
    }, [selectedFinding, shouldScrollToEvidence]);

    useEffect(() => {
        void trackEvent('source_explorer_viewed');
    }, []);

    const handleDownloadSingle = async () => {
        if (!selectedFile) {
            return;
        }
        try {
            setDownloadingFileId(selectedFile.id);
            await SourceMapDownloader.downloadSingle(selectedFile, {
                onError: (downloadError) => {
                    showToast(downloadError.message, 'error');
                }
            });
            void trackEvent('source_explorer_download_single', {
                source_map_file_id: selectedFile.id,
                file_url: selectedFile.url
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
                onError: (downloadError) => {
                    showToast(downloadError.message, 'error');
                }
            });
            void trackEvent('source_explorer_download_domain_zip', {
                domain: selectedDomain?.hostname,
                files_count: latestDomainFiles.length
            });
            showToast('Domain batch ZIP downloaded successfully.', 'success');
        } catch (downloadError) {
            console.error('Error downloading domain ZIP:', downloadError);
            showToast('Failed to download domain ZIP.', 'error');
        } finally {
            setDownloadingBatch(false);
        }
    };

    const handleOpenGithubFeedback = () => {
        void trackEvent('source_explorer_open_github_feedback');
        window.open(GITHUB_FEEDBACK_URL, '_blank', 'noopener,noreferrer');
    };

    return (
        <ThemeProvider theme={theme}>
            <CssBaseline />
            <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
                <AppBar position="sticky">
                    <Toolbar>
                        <Box sx={{ flexGrow: 1 }}>
                            <Typography variant="h6" component="div">
                                Source Explorer
                            </Typography>
                            <Typography variant="body2" sx={{ opacity: 0.9 }}>
                                v1.3.2 - Three-pane source intelligence workspace
                            </Typography>
                        </Box>
                        <Tooltip title="Feedback on GitHub">
                            <IconButton
                                color="inherit"
                                onClick={handleOpenGithubFeedback}
                            >
                                <GitHubIcon />
                            </IconButton>
                        </Tooltip>
                    </Toolbar>
                </AppBar>

                <Container maxWidth={false} sx={{ py: 2.5 }}>
                    {navigationState.resourceType !== 'source-files' && (
                        <Alert severity="info">
                            Source Explorer currently supports source files only.
                        </Alert>
                    )}

                    {loading ? (
                        <Box display="flex" justifyContent="center" alignItems="center" minHeight="60vh">
                            <CircularProgress />
                        </Box>
                    ) : error ? (
                        <Alert severity="error">{error}</Alert>
                    ) : domains.length === 0 ? (
                        <Alert severity="info">
                            No source files are currently available in indexedDB.
                        </Alert>
                    ) : (
                        <Grid container spacing={2}>
                            <Grid item xs={12} md={3}>
                                <Card variant="outlined" sx={{ height: 'calc(100vh - 152px)' }}>
                                    <CardContent sx={{ p: 0, height: '100%', display: 'flex', flexDirection: 'column' }}>
                                        <Box sx={{ px: 2, py: 1.5 }}>
                                            <Typography variant="h6">Domains / Pages</Typography>
                                            <Typography variant="body2" color="text.secondary">
                                                {domains.length} domain{domains.length === 1 ? '' : 's'}
                                            </Typography>
                                        </Box>
                                        <Divider />
                                        <List disablePadding sx={{ overflowY: 'auto', flexGrow: 1 }}>
                                            {domains.map((domain) => (
                                                <Box key={domain.hostname}>
                                                    <Box
                                                        sx={{
                                                            px: 2,
                                                            py: 1,
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'space-between',
                                                            bgcolor: 'action.hover'
                                                        }}
                                                    >
                                                        <Typography variant="subtitle2">{domain.hostname}</Typography>
                                                        {domain.leakCount > 0 && (
                                                            <Chip
                                                                size="small"
                                                                color="error"
                                                                label={`${domain.leakCount}`}
                                                            />
                                                        )}
                                                    </Box>
                                                    {domain.pages.map((page) => (
                                                        <ListItemButton
                                                            key={page.id}
                                                            selected={selectedPageId === page.id && selectedDomainHostname === domain.hostname}
                                                            onClick={() => {
                                                                setSelectedDomainHostname(domain.hostname);
                                                                setSelectedPageId(page.id);
                                                            }}
                                                            sx={{ py: 1.25, pl: 2.5 }}
                                                        >
                                                            <ListItemText
                                                                primary={page.title || domain.hostname}
                                                                secondary={(
                                                                    <Stack spacing={0.25}>
                                                                        <Typography
                                                                            variant="caption"
                                                                            color="text.secondary"
                                                                            sx={{ wordBreak: 'break-all' }}
                                                                        >
                                                                            {page.url}
                                                                        </Typography>
                                                                        <Typography variant="caption" color="text.secondary">
                                                                            {page.groupedFiles.length} file{page.groupedFiles.length === 1 ? '' : 's'}
                                                                        </Typography>
                                                                    </Stack>
                                                                )}
                                                            />
                                                            {page.leakCount > 0 && (
                                                                <Chip
                                                                    size="small"
                                                                    color="error"
                                                                    label={`${page.leakCount}`}
                                                                    sx={{ ml: 1 }}
                                                                />
                                                            )}
                                                        </ListItemButton>
                                                    ))}
                                                </Box>
                                            ))}
                                        </List>
                                    </CardContent>
                                </Card>
                            </Grid>

                            <Grid item xs={12} md={3}>
                                <Card variant="outlined" sx={{ height: 'calc(100vh - 152px)' }}>
                                    <CardContent sx={{ p: 0, height: '100%', display: 'flex', flexDirection: 'column' }}>
                                        <Box sx={{ px: 2, py: 1.5 }}>
                                            <Typography variant="h6">File List</Typography>
                                            <Typography variant="body2" color="text.secondary">
                                                {domainGroupedFiles.length} file{domainGroupedFiles.length === 1 ? '' : 's'}
                                                {selectedDomain ? ` in ${selectedDomain.hostname}` : ''}
                                            </Typography>
                                        </Box>
                                        <Divider />
                                        <List disablePadding sx={{ overflowY: 'auto', flexGrow: 1 }}>
                                            {domainGroupedFiles.map((group) => {
                                                const latestVersion = group.versions[0];
                                                const findingsCount = latestVersion?.findings?.length ?? 0;
                                                return (
                                                    <ListItemButton
                                                        key={group.url}
                                                        selected={group.url === selectedGroupUrl}
                                                        onClick={() => {
                                                            setSelectedGroupUrl(group.url);
                                                            setSelectedFileId(latestVersion?.id ?? null);
                                                        }}
                                                        alignItems="flex-start"
                                                        sx={{ py: 1.25 }}
                                                    >
                                                        <ListItemText
                                                            primary={getFileName(group.url)}
                                                            secondary={(
                                                                <Stack spacing={0.25}>
                                                                    <Typography variant="caption" color="text.secondary">
                                                                        {group.versions.length} version{group.versions.length === 1 ? '' : 's'}
                                                                    </Typography>
                                                                    <Typography
                                                                        variant="caption"
                                                                        color="text.secondary"
                                                                        sx={{ wordBreak: 'break-all' }}
                                                                    >
                                                                        {group.url}
                                                                    </Typography>
                                                                </Stack>
                                                            )}
                                                        />
                                                        {findingsCount > 0 && (
                                                            <Chip
                                                                size="small"
                                                                color="error"
                                                                label={`${findingsCount}`}
                                                                sx={{ ml: 1 }}
                                                            />
                                                        )}
                                                    </ListItemButton>
                                                );
                                            })}
                                        </List>
                                    </CardContent>
                                </Card>
                            </Grid>

                            <Grid item xs={12} md={6}>
                                {!selectedFile ? (
                                    <Alert severity="info">Select a file to inspect code and findings.</Alert>
                                ) : (
                                    <Stack spacing={2}>
                                        <Card variant="outlined">
                                            <CardContent>
                                                <Typography variant="h6">{getFileName(selectedFile.url)}</Typography>
                                                <Typography variant="body2" color="text.secondary" sx={{ wordBreak: 'break-all' }}>
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
                                                        label={`${selectedFindings.length} finding${selectedFindings.length === 1 ? '' : 's'}`}
                                                    />
                                                </Stack>

                                                {selectedGroup && selectedGroup.versions.length > 1 && (
                                                    <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ mt: 1.5 }}>
                                                        {selectedGroup.versions.map((version) => (
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

                                                <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ mt: 2 }}>
                                                    <Button
                                                        size="small"
                                                        variant="outlined"
                                                        onClick={() => {
                                                            void handleDownloadSingle();
                                                        }}
                                                        disabled={downloadingFileId === selectedFile.id || downloadingBatch}
                                                    >
                                                        {downloadingFileId === selectedFile.id ? 'Downloading...' : 'Download Selected ZIP'}
                                                    </Button>
                                                    <Button
                                                        size="small"
                                                        variant="contained"
                                                        onClick={() => {
                                                            void handleDownloadDomainZip();
                                                        }}
                                                        disabled={downloadingBatch || latestDomainFiles.length === 0}
                                                    >
                                                        {downloadingBatch ? 'Bundling...' : 'Download Domain ZIP'}
                                                    </Button>
                                                </Stack>
                                            </CardContent>
                                        </Card>

                                        <Card variant="outlined">
                                            <CardContent>
                                                <Typography variant="h6" gutterBottom>
                                                    Security Findings
                                                </Typography>
                                                {selectedFindings.length === 0 ? (
                                                    <Alert severity="success">No leak findings detected for this file.</Alert>
                                                ) : (
                                                    <Stack spacing={1.5}>
                                                        <Stack direction="row" spacing={1} flexWrap="wrap">
                                                            {findingTypeSummary.map((summary) => (
                                                                <Chip
                                                                    key={summary.ruleName}
                                                                    size="small"
                                                                    color="error"
                                                                    variant="outlined"
                                                                    label={`${summary.ruleName} (${summary.count})`}
                                                                />
                                                            ))}
                                                        </Stack>

                                                        <Paper variant="outlined" sx={{ maxHeight: 220, overflowY: 'auto' }}>
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
                                                    </Stack>
                                                )}
                                            </CardContent>
                                        </Card>

                                        {selectedFinding && (
                                            <Paper
                                                ref={evidenceRef}
                                                variant="outlined"
                                                sx={{
                                                    p: 2,
                                                    borderColor: 'error.main',
                                                    bgcolor: 'rgba(244, 67, 54, 0.08)'
                                                }}
                                            >
                                                <Typography variant="subtitle1" color="error.main">
                                                    Leak Evidence
                                                </Typography>
                                                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                                                    {selectedFinding.ruleName} at Line {selectedFinding.line}, Col {selectedFinding.column}
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
                                                        wordBreak: 'break-all'
                                                    }}
                                                >
                                                    {selectedFinding.matchedText}
                                                </Box>
                                            </Paper>
                                        )}

                                        <Paper variant="outlined">
                                            <Box sx={{ px: 2, py: 1.25, borderBottom: 1, borderColor: 'divider' }}>
                                                <Typography variant="subtitle1">Code Viewer</Typography>
                                                <Typography variant="body2" color="text.secondary">
                                                    {selectedFinding
                                                        ? 'Showing focused finding context'
                                                        : 'Showing first section of compiled file'}
                                                </Typography>
                                            </Box>
                                            <Box
                                                component="pre"
                                                sx={{
                                                    m: 0,
                                                    p: 2,
                                                    maxHeight: 420,
                                                    overflow: 'auto',
                                                    fontFamily: 'monospace',
                                                    fontSize: 12,
                                                    whiteSpace: 'pre-wrap',
                                                    wordBreak: 'break-word'
                                                }}
                                            >
                                                {getCodeViewerPreview(selectedFile, selectedFinding)}
                                            </Box>
                                        </Paper>
                                    </Stack>
                                )}
                            </Grid>
                        </Grid>
                    )}
                </Container>
            </Box>

            <Snackbar
                open={toast.open}
                autoHideDuration={2400}
                onClose={() => setToast((previousState) => ({ ...previousState, open: false }))}
            >
                <Alert
                    severity={toast.severity}
                    variant="filled"
                    onClose={() => setToast((previousState) => ({ ...previousState, open: false }))}
                    sx={{ width: '100%' }}
                >
                    {toast.message}
                </Alert>
            </Snackbar>
        </ThemeProvider>
    );
}

