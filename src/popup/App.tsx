import { MESSAGE_TYPES } from '@/background/constants';
import { formatBytes } from '@/background/utils';
import { Toast } from '@/components/Toast';
import { CrxFile, PageData, ParsedCrxFile, SourceMapFile, StorageStats } from '@/types';
import { isExtensionPage } from '@/utils/isExtensionPage';
import { parseCrxFile } from '@/utils/parseCrxFile';
import { SourceMapDownloader } from '@/utils/sourceMapDownloader';
import { GITHUB_FEEDBACK_URL } from '@/constants/links';
import { groupSourceMapFiles } from '@/utils/sourceMapUtils';
import {
    CloudDownload as CloudDownloadIcon,
    GitHub as GitHubIcon,
    OpenInNew as OpenInNewIcon,
    Settings as SettingsIcon
} from '@mui/icons-material';
import {
    Box,
    Button,
    CircularProgress,
    IconButton,
    Tooltip,
    Typography
} from '@mui/material';
import JSZip from 'jszip';
import { useEffect, useMemo, useState } from 'react';
import { CrxFileTree } from './components/CrxFileTree';
import { SourceMapTable } from './components/SourceMapTable';
import { openInDesktop } from '@/utils/desktopApp';
import { browserAPI } from '@/utils/browser-polyfill';
import { trackEvent, trackEventOnce, trackProductEvent } from '@/utils/analytics';

// Helper function to format bundle size
function getBundleSize(files: SourceMapFile[]): string {
    const totalSize = files.reduce((sum, file) => sum + file.size, 0);
    return formatBytes(totalSize);
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

export default function App() {
    const [loading, setLoading] = useState(true);
    const [pageData, setPageData] = useState<PageData | null>(null);
    const [crxFile, setCrxFile] = useState<CrxFile | null>(null);
    const [parsed, setParsed] = useState<ParsedCrxFile | null>(null);
    const [stats, setStats] = useState<StorageStats | null>(null);
    const [downloading, setDownloading] = useState<{ [key: string]: boolean }>({});
    const [downloadingAll, setDownloadingAll] = useState(false);
    const [toast, setToast] = useState<{
        open: boolean;
        message: string;
        severity: 'success' | 'error' | 'info' | 'warning';
    }>({
        open: false,
        message: '',
        severity: 'info'
    });

    useEffect(() => {
        loadData();
        void trackEvent('popup_viewed');
        void trackEventOnce('onboarding_started', 'popup_first_open', {
            surface: 'popup',
            entry_point: 'popup_icon'
        });
    }, []);

    const loadData = async () => {
        try {
            const [tab] = await browserAPI.tabs.query({ active: true, currentWindow: true });
            if (!tab?.url) {
                void trackProductEvent('scan_failed', {
                    surface: 'popup',
                    scan_stage: 'resolve_active_tab',
                    error_type: 'active_tab_url_missing'
                });
                return;
            }
            if (isExtensionPage(tab.url)) {
                const response = await browserAPI.runtime.sendMessage({
                    type: MESSAGE_TYPES.GET_CRX_FILE,
                    data: { url: tab.url }
                });

                const responseReason = typeof response?.reason === 'string' ? response.reason : undefined;
                if (response.success && response.data) {
                    setCrxFile(response.data);
                    try {
                        const result = await parseCrxFile(response.data.crxUrl);
                        setParsed(result);

                        void trackProductEvent('result_viewed', {
                            surface: 'popup',
                            result_tab: 'crx_files',
                            result_count: result.count,
                            has_results: result.count > 0
                        });

                        if (result.count > 0) {
                            void trackEventOnce('onboarding_completed', 'popup_first_result_viewed', {
                                surface: 'popup',
                                completion_step: 'result_viewed',
                                result_tab: 'crx_files'
                            });
                        }
                    } catch (parseError) {
                        void trackProductEvent('scan_failed', {
                            surface: 'popup',
                            scan_stage: 'parse_crx_file',
                            error_type: getErrorType(parseError)
                        });
                    }
                } else {
                    void trackProductEvent('scan_failed', {
                        surface: 'popup',
                        scan_stage: 'fetch_crx_file',
                        error_type: 'crx_lookup_failed',
                        error_reason: responseReason
                    });
                }
            } else {
                const response = await browserAPI.runtime.sendMessage({
                    type: MESSAGE_TYPES.GET_PAGE_DATA,
                    data: { url: tab.url }
                });

                const responseReason = typeof response?.reason === 'string' ? response.reason : undefined;
                if (response.success && response.data) {
                    setPageData(response.data);
                    const files = Array.isArray(response.data.files) ? response.data.files : [];
                    const findingsCount = files.reduce(
                        (total, file) => total + (file.findings?.length ?? 0),
                        0
                    );

                    void trackProductEvent('result_viewed', {
                        surface: 'popup',
                        result_tab: 'source_maps',
                        result_count: files.length,
                        findings_count: findingsCount,
                        has_findings: findingsCount > 0
                    });

                    if (files.length > 0) {
                        void trackEventOnce('onboarding_completed', 'popup_first_result_viewed', {
                            surface: 'popup',
                            completion_step: 'result_viewed',
                            result_tab: 'source_maps'
                        });
                    }
                } else {
                    void trackProductEvent('scan_failed', {
                        surface: 'popup',
                        scan_stage: 'fetch_page_data',
                        error_type: 'page_data_lookup_failed',
                        error_reason: responseReason
                    });
                }
            }
            const statsResponse = await browserAPI.runtime.sendMessage({
                type: MESSAGE_TYPES.GET_STORAGE_STATS
            });
            if (statsResponse.success) {
                setStats(statsResponse.data);
            }
        } catch (error) {
            console.error('Error loading data:', error);
            void trackProductEvent('scan_failed', {
                surface: 'popup',
                scan_stage: 'load_data',
                error_type: getErrorType(error)
            });
        } finally {
            setLoading(false);
        }
    };

    const handleDownload = async (file: SourceMapFile) => {
        try {
            setDownloading(prev => ({ ...prev, [file.id]: true }));
            await SourceMapDownloader.downloadSingle(file, {
                onError: (error) => {
                    showToast(error.message, 'error');
                }
            });
            void trackEvent('popup_download_single', {
                source_map_file_id: file.id,
                file_url: file.url
            });
            showToast('Download completed successfully', 'success');
        } catch (error) {
            showToast('Failed to download file', 'error');
        } finally {
            setDownloading(prev => ({ ...prev, [file.id]: false }));
        }
    };

    const handleVersionMenuOpen = (groupUrl: string) => {
        openInDesktop('handleVersionMenuOpen', { groupUrl });
    };

    const handleOpenLeakReport = (file: SourceMapFile) => {
        const firstFindingType = file.findings?.[0]?.ruleName?.trim();
        void trackEvent('popup_open_leak_report', {
            source_map_file_id: file.id,
            file_url: file.url,
            findings_count: file.findings?.length ?? 0
        });
        void trackProductEvent('finding_detail_opened', {
            surface: 'popup',
            placement: 'source_map_table',
            source_map_file_id: file.id,
            finding_type: firstFindingType && firstFindingType.length > 0 ? firstFindingType : 'unknown_rule',
            findings_count: file.findings?.length ?? 0
        });
        openInDesktop('handleOpenDesktopApp', {
            type: 'source-files',
            url: pageData?.url ?? file.url,
            sourceUrl: file.url,
            sourceMapFileId: file.id,
            sourceMapUrl: file.sourceMapUrl,
            view: 'leak-findings'
        });
    };

    const handleDownloadAll = async () => {
        if (crxFile && parsed) {
            try {
                setDownloadingAll(true);
                // Create a new zip file
                const newZip = new JSZip();

                // Add the original CRX file directly
                newZip.file('extension.crx', parsed.blob);

                // Create a folder for parsed files
                const parsedFolder = newZip.folder('parsed');
                if (!parsedFolder) {
                    throw new Error('Failed to create parsed folder');
                }

                // Get all files from the parsed CRX file
                const zip = parsed.zip;
                await Promise.all(
                    Object.keys(zip.files).map(async (path) => {
                        const zipObject = zip.files[path];
                        if (!zipObject.dir) {
                            const content = await zipObject.async('uint8array');
                            parsedFolder.file(path, content);
                        }
                    })
                );

                // Generate and download the zip
                const blob = await newZip.generateAsync({ type: 'blob' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                // Use page title for the zip file name, fallback to 'extension-files' if no title
                const safeTitle = crxFile.pageTitle.replace(/[^a-z0-9]/gi, '-').toLowerCase() || 'extension-files';
                a.download = `${safeTitle}.zip`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);

                void trackEvent('popup_download_all_crx');
                showToast('All files downloaded successfully', 'success');
            } catch (error) {
                console.error('Error downloading files:', error);
                showToast('Failed to download files', 'error');
            } finally {
                setDownloadingAll(false);
            }
        } else if (pageData?.files.length) {
            try {
                setDownloadingAll(true);
                const latestVersions = groupedFiles.map(group => group.versions[0]);
                await SourceMapDownloader.downloadAllLatest(latestVersions, pageData.url, {
                    onError: (error) => {
                        showToast(error.message, 'error');
                    }
                });
                void trackEvent('popup_download_all_latest', {
                    files_count: latestVersions.length,
                    page_url: pageData.url
                });
                showToast('All files downloaded successfully', 'success');
            } catch (error) {
                console.error('Error downloading files:', error);
                showToast('Failed to download files', 'error');
            } finally {
                setDownloadingAll(false);
            }
        }
    };

    const showToast = (message: string, severity: 'success' | 'error' | 'info' | 'warning' = 'info') => {
        setToast({
            open: true,
            message,
            severity
        });
    };

    const handleCloseToast = () => {
        setToast(prev => ({ ...prev, open: false }));
    };

    const handleCrxFileDownload = async (path: string) => {
        if (!parsed) return;
        try {
            setDownloading(prev => ({ ...prev, [path]: true }));
            const file = parsed.zip.files[path];
            if (!file) {
                throw new Error('File not found');
            }
            const content = await file.async('blob');
            const url = URL.createObjectURL(content);
            const a = document.createElement('a');
            a.href = url;
            a.download = path.split('/').pop() || path;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            showToast('File downloaded successfully', 'success');
        } catch (error) {
            console.error('Error downloading file:', error);
            showToast('Failed to download file', 'error');
        } finally {
            setDownloading(prev => ({ ...prev, [path]: false }));
        }
    };

    const groupedFiles = useMemo(() => {
        if (!pageData?.files) return [];
        return groupSourceMapFiles(pageData.files).sort((a, b) => {
            const aFilename = a.url.split('/').pop() || '';
            const bFilename = b.url.split('/').pop() || '';
            return aFilename.localeCompare(bFilename);
        });
    }, [pageData?.files]);

    const handleOpenSourceExplorer = () => {
        void trackEvent('popup_open_source_explorer', {
            resource_type: crxFile ? 'crx-files' : 'source-files',
            page_url: crxFile ? crxFile.crxUrl : pageData?.url
        });
        openInDesktop('handleOpenDesktopApp', {
            type: crxFile ? 'crx-files' : 'source-files',
            url: crxFile ? crxFile.crxUrl : pageData?.url
        });
    };

    const handleOpenGithubFeedback = async () => {
        void trackEvent('popup_open_github_feedback');
        void trackProductEvent('feedback_submitted', {
            surface: 'popup',
            placement: 'header_feedback_icon',
            feedback_channel: 'github_issues',
            submission_state: 'intent'
        });
        void trackProductEvent('share_clicked', {
            surface: 'popup',
            placement: 'header_feedback_icon',
            share_target: 'github_issues',
            share_channel: 'github'
        });
        await browserAPI.tabs.create({ url: GITHUB_FEEDBACK_URL });
    };

    const handleOpenSettings = async () => {
        void trackEvent('popup_open_settings');
        await browserAPI.runtime.openOptionsPage();
    };

    if (loading) {
        return (
            <Box p={2} width={600}>
                <Box display="flex" justifyContent="center" alignItems="center" minHeight={600}>
                    <CircularProgress />
                </Box>
            </Box>
        );
    }

    return (
        <Box
            sx={{
                width: 600,
                height: '600px',
                display: 'flex',
                flexDirection: 'column'
            }}
        >
            {/* Fixed Header */}
            <Box
                sx={{
                    p: 2,
                    borderBottom: 1,
                    borderColor: 'divider',
                    bgcolor: 'background.paper',
                    position: 'sticky',
                    top: 0,
                    zIndex: 1
                }}
            >
                <Box display="flex" justifyContent="space-between" alignItems="center">
                    <Typography variant="h6">
                        {crxFile ? 'Extension Files' : 'Source Maps'} (v1.3.2)
                    </Typography>
                    <Box>
                        <Tooltip title="Open Source Explorer">
                            <IconButton
                                size="small"
                                sx={{ mr: 1 }}
                                onClick={handleOpenSourceExplorer}
                            >
                                <OpenInNewIcon />
                            </IconButton>
                        </Tooltip>
                        {((groupedFiles.length > 0 && groupedFiles.map(g => g.versions[0]).reduce((sum, file) => sum + file.size, 0) > 0) || (crxFile && (parsed?.size || 0 + crxFile.size) > 0)) && (
                            <Tooltip title={crxFile ?
                                `Download all files (${formatBytes(parsed?.size || 0 + crxFile.size)})` :
                                `Download latest versions of all source maps (${getBundleSize(groupedFiles.map(g => g.versions[0]))})`
                            }>
                                <span>
                                    <Button
                                        startIcon={downloadingAll ? <CircularProgress size={16} /> : <CloudDownloadIcon />}
                                        onClick={handleDownloadAll}
                                        disabled={downloadingAll}
                                        size="small"
                                        variant="outlined"
                                        sx={{ mr: 1 }}
                                    >
                                        {downloadingAll ? 'Downloading...' : crxFile ?
                                            `Download All (${formatBytes(parsed?.size || 0 + crxFile.size)})` :
                                            `Download Latest (${getBundleSize(groupedFiles.map(g => g.versions[0]))})`
                                        }
                                    </Button>
                                </span>
                            </Tooltip>
                        )}
                        <Tooltip title="Feedback on GitHub">
                            <IconButton
                                size="small"
                                sx={{ mr: 1 }}
                                onClick={handleOpenGithubFeedback}
                            >
                                <GitHubIcon />
                            </IconButton>
                        </Tooltip>
                        <IconButton onClick={handleOpenSettings}>
                            <SettingsIcon />
                        </IconButton>
                    </Box>
                </Box>
            </Box>

            {/* Scrollable Content */}
            <Box sx={{ flexGrow: 1, overflow: 'hidden', px: 2 }}>
                {crxFile ? (
                    <CrxFileTree
                        crxUrl={crxFile.crxUrl}
                        parsed={parsed}
                        onDownload={handleCrxFileDownload}
                    />
                ) : groupedFiles.length > 0 ? (
                    <SourceMapTable
                        groupedFiles={groupedFiles}
                        onDownload={handleDownload}
                        onOpenLeakReport={handleOpenLeakReport}
                        onVersionMenuOpen={handleVersionMenuOpen}
                        downloading={downloading}
                    />
                ) : (
                    <Box display="flex" justifyContent="center" alignItems="center" minHeight={400}>
                        <Typography variant="body1" color="text.secondary">
                            No {crxFile ? 'files' : 'source maps'} found on this page
                        </Typography>
                    </Box>
                )}
            </Box>

            {/* Fixed Footer */}
            {stats && (
                <Box
                    sx={{
                        p: 2,
                        borderTop: 1,
                        borderColor: 'divider',
                        bgcolor: 'background.paper',
                        position: 'sticky',
                        bottom: 0
                    }}
                >
                    <Box display="flex" justifyContent="space-between" alignItems="center">
                        <Typography variant="body2" color="text.secondary">
                            {`Storage Used: ${formatBytes(stats.usedSpace)}`}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                            {stats.fileCount} Source Maps Found on {stats.uniqueSiteCount} {stats.uniqueSiteCount === 1 ? 'Site' : 'Sites'}
                        </Typography>
                    </Box>
                </Box>
            )}

            <Toast
                open={toast.open}
                message={toast.message}
                severity={toast.severity}
                onClose={handleCloseToast}
            />
        </Box>
    );
}