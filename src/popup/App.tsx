import { MESSAGE_TYPES } from '@/background/constants';
import { formatFileSize } from '@/background/utils';
import { Toast } from '@/components/Toast';
import { PageData, SourceMapFile, StorageStats } from '@/types';
import { SourceMapDownloader } from '@/utils/sourceMapDownloader';
import {
    CloudDownload as CloudDownloadIcon,
    Css as CssIcon,
    Download as DownloadIcon,
    History as HistoryIcon,
    Javascript as JavascriptIcon,
    ListAlt as ListAltIcon,
    Settings as SettingsIcon
} from '@mui/icons-material';
import {
    Box,
    Button,
    Chip,
    CircularProgress,
    IconButton,
    ListItemText,
    Menu,
    MenuItem,
    Paper,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Tooltip,
    Typography
} from '@mui/material';
import React, { useEffect, useState } from 'react';

interface GroupedSourceMap {
    url: string;
    fileType: 'js' | 'css';
    versions: SourceMapFile[];
}

// Helper function to format bundle size
function getBundleSize(files: SourceMapFile[]): string {
    const totalSize = files.reduce((sum, file) => sum + file.size, 0);
    return formatFileSize(totalSize);
}

export default function App() {
    const [loading, setLoading] = useState(true);
    const [pageData, setPageData] = useState<PageData | null>(null);
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
    }, []);

    const loadData = async () => {
        try {
            // 获取当前页面数据
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (!tab.url) return;

            const response = await chrome.runtime.sendMessage({
                type: MESSAGE_TYPES.GET_PAGE_DATA,
                data: { url: tab.url }
            });

            setPageData(response.data);

            // 获取存储统计
            const statsResponse = await chrome.runtime.sendMessage({
                type: MESSAGE_TYPES.GET_STORAGE_STATS
            });

            setStats(statsResponse.data);
        } catch (error) {
            console.error('Error loading data:', error);
        } finally {
            setLoading(false);
        }
    };

    const openInDesktop = (type: 'handleVersionMenuOpen' | 'handleViewAllPages', options?: any) => {
        chrome.tabs.create({
            url: chrome.runtime.getURL('pages/desktop/index.html?type=' + type + '&options=' + (options ? JSON.stringify(options) : ''))
        });
    };

    const handleViewAllPages = () => {
        openInDesktop('handleViewAllPages');
    }

    const handleDownload = async (file: SourceMapFile) => {
        try {
            setDownloading(prev => ({ ...prev, [file.id]: true }));
            await SourceMapDownloader.downloadSingle(file, {
                onError: (error) => {
                    showToast(error.message, 'error');
                }
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

    // Group files by URL and sort versions
    const groupedFiles: GroupedSourceMap[] = React.useMemo(() => {
        if (!pageData?.files) return [];

        const groups: { [key: string]: SourceMapFile[] } = {};
        pageData.files.forEach(file => {
            if (!groups[file.url]) {
                groups[file.url] = [];
            }
            groups[file.url].push(file);
        });

        return Object.entries(groups).map(([url, files]) => ({
            url,
            fileType: files[0].fileType,
            versions: files.sort((a, b) => b.version - a.version) // Sort by version descending
        }));
    }, [pageData?.files]);

    const handleDownloadAll = async () => {
        if (!pageData?.files.length) return;

        try {
            setDownloadingAll(true);
            const latestVersions = groupedFiles.map(group => group.versions[0]);
            await SourceMapDownloader.downloadAllLatest(latestVersions, pageData.url, {
                onError: (error) => {
                    showToast(error.message, 'error');
                }
            });
            showToast('All files downloaded successfully', 'success');
        } catch (error) {
            showToast('Failed to download files', 'error');
        } finally {
            setDownloadingAll(false);
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

    if (loading) {
        return (
            <Box p={2} width={600}>
                <Box display="flex" justifyContent="center" alignItems="center" minHeight={600}>
                    <CircularProgress />
                </Box>
            </Box>
        );
    }

    // Sort the grouped files by URL
    const sortedGroupedFiles = [...groupedFiles].sort((a, b) => {
        // Get the filename from the URL
        const aFilename = a.url.split('/').pop() || '';
        const bFilename = b.url.split('/').pop() || '';
        return aFilename.localeCompare(bFilename);
    });

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
                    <Typography variant="h6">Source Maps</Typography>
                    <Box>
                        {sortedGroupedFiles.length > 0 && (
                            <Tooltip title={`Download latest versions of all source maps (${getBundleSize(sortedGroupedFiles.map(g => g.versions[0]))})`}>
                                <span>
                                    <Button
                                        startIcon={downloadingAll ? <CircularProgress size={16} /> : <CloudDownloadIcon />}
                                        onClick={handleDownloadAll}
                                        disabled={downloadingAll}
                                        size="small"
                                        variant="outlined"
                                        sx={{ mr: 1 }}
                                    >
                                        Download Latest ({getBundleSize(sortedGroupedFiles.map(g => g.versions[0]))})
                                    </Button>
                                </span>
                            </Tooltip>
                        )}
                        <Tooltip title="View all pages">
                            <IconButton onClick={handleViewAllPages}>
                                <ListAltIcon />
                            </IconButton>
                        </Tooltip>
                        <IconButton onClick={() => chrome.runtime.openOptionsPage()}>
                            <SettingsIcon />
                        </IconButton>
                    </Box>
                </Box>
            </Box>

            {/* Scrollable Content */}
            <Box sx={{ flexGrow: 1, overflow: 'hidden', px: 2 }}>
                {sortedGroupedFiles.length > 0 ? (
                    <TableContainer
                        component={Paper}
                        sx={{
                            height: '100%',
                            display: 'flex',
                            flexDirection: 'column'
                        }}
                    >
                        <Table
                            size="small"
                            sx={{
                                tableLayout: 'fixed',
                                '& th, & td': {  // Apply to both header and body cells
                                    padding: '8px 16px',  // Consistent padding
                                    boxSizing: 'border-box',
                                    '&:first-of-type': {
                                        width: '60%',
                                    },
                                    '&:not(:first-of-type)': {
                                        width: '20%',
                                    }
                                }
                            }}
                        >
                            <TableHead
                                sx={{
                                    bgcolor: 'background.paper',
                                    position: 'sticky',
                                    top: 0,
                                    zIndex: 1,
                                }}
                            >
                                <TableRow>
                                    <TableCell>Source File</TableCell>
                                    <TableCell align="right">Latest Version</TableCell>
                                    <TableCell align="right">Previous Versions</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {sortedGroupedFiles.map((group) => (
                                    <TableRow key={group.url}>
                                        <TableCell sx={{
                                            overflow: 'hidden',
                                            whiteSpace: 'nowrap',
                                            textOverflow: 'ellipsis'
                                        }}>
                                            <Tooltip title={group.url} arrow>
                                                <Box display="flex" alignItems="center" gap={1} sx={{
                                                    minWidth: 0,
                                                }}>
                                                    {group.fileType === 'js' ? (
                                                        <JavascriptIcon fontSize="small" sx={{ flexShrink: 0 }} />
                                                    ) : (
                                                        <CssIcon fontSize="small" sx={{ flexShrink: 0 }} />
                                                    )}
                                                    <Typography
                                                        variant="body2"
                                                        component="div"
                                                        sx={{
                                                            overflow: 'hidden',
                                                            textOverflow: 'ellipsis',
                                                            whiteSpace: 'nowrap',
                                                            flexGrow: 1,
                                                        }}
                                                    >
                                                        {group.url.split('/').pop()}
                                                    </Typography>
                                                </Box>
                                            </Tooltip>
                                        </TableCell>
                                        <TableCell align="right">
                                            <Box display="flex" justifyContent="flex-end" gap={1}>
                                                <Tooltip title={`Download latest version (${formatFileSize(group.versions[0].size)})`} arrow>
                                                    <span>
                                                        <IconButton
                                                            size="small"
                                                            onClick={() => handleDownload(group.versions[0])}
                                                            disabled={downloading[group.versions[0].id]}
                                                        >
                                                            {downloading[group.versions[0].id] ? (
                                                                <CircularProgress size={20} />
                                                            ) : (
                                                                <CloudDownloadIcon />
                                                            )}
                                                        </IconButton>
                                                    </span>
                                                </Tooltip>
                                            </Box>
                                        </TableCell>
                                        <TableCell align="right">
                                            <Box display="flex" justifyContent="flex-end" gap={1}>
                                                {group.versions.length > 1 && (
                                                    <Tooltip title="View history versions" arrow>
                                                        <span>
                                                            <IconButton
                                                                size="small"
                                                                onClick={() => handleVersionMenuOpen(group.url)}
                                                            >
                                                                <HistoryIcon />
                                                            </IconButton>
                                                        </span>
                                                    </Tooltip>
                                                )}
                                            </Box>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </TableContainer>
                ) : (
                    <Box display="flex" justifyContent="center" alignItems="center" minHeight={400}>
                        <Typography variant="body1" color="text.secondary">
                            No source maps found on this page
                        </Typography>
                    </Box>
                )}
            </Box>

            {
                stats &&
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
                            {`Storage Used: ${formatFileSize(stats.usedSpace)}`}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                            {stats.fileCount} Source Maps Found on {stats.uniqueSiteCount} {stats.uniqueSiteCount === 1 ? 'Site' : 'Sites'}
                        </Typography>
                    </Box>
                </Box>
            }

            <Toast
                open={toast.open}
                message={toast.message}
                severity={toast.severity}
                onClose={handleCloseToast}
            />
        </Box>
    );
}