import React, { useEffect, useState } from 'react';
import {
    Box,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    IconButton,
    Typography,
    Paper,
    CircularProgress,
    Tooltip,
    Chip,
    Menu,
    MenuItem,
    ListItemIcon,
    ListItemText,
    Button
} from '@mui/material';
import {
    Javascript as JavascriptIcon,
    Css as CssIcon,
    Download as DownloadIcon,
    OpenInNew as OpenInNewIcon,
    Settings as SettingsIcon,
    CloudDownload as CloudDownloadIcon,
    ListAlt as ListAltIcon,
    MoreVert as MoreVertIcon,
    History as HistoryIcon
} from '@mui/icons-material';
import { SourceMapFile, StorageStats, PageData } from '@/types';
import { MESSAGE_TYPES } from '@/background/constants';
import { formatFileSize } from '@/background/utils';
import JSZip from 'jszip';
import { SourceMapConsumer } from 'source-map-js';
import { SourceMapDownloader } from '@/utils/sourceMapDownloader';
import { Toast } from '@/components/Toast';

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
    const [anchorEl, setAnchorEl] = useState<{ [key: string]: HTMLElement | null }>({});
    const [selectedGroup, setSelectedGroup] = useState<string | null>(null);
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
            console.log('Loading data...');
            // 获取当前页面数据
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            console.log('Current tab:', tab);
            if (!tab.url) return;

            const response = await chrome.runtime.sendMessage({
                type: MESSAGE_TYPES.GET_PAGE_DATA,
                data: { url: tab.url }
            });
            console.log('Page data response:', response);

            setPageData(response.data);

            // 获取存储统计
            const statsResponse = await chrome.runtime.sendMessage({
                type: MESSAGE_TYPES.GET_STORAGE_STATS
            });
            console.log('Stats response:', statsResponse);

            setStats(statsResponse.data);
        } catch (error) {
            console.error('Error loading data:', error);
        } finally {
            setLoading(false);
        }
    };

    const introduceDesktop = () => {
        chrome.tabs.create({
            url: chrome.runtime.getURL('pages/desktop/index.html')
        });
    };

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

    const handleVersionMenuOpen = (event: React.MouseEvent<HTMLElement>, groupUrl: string) => {
        setAnchorEl(prev => ({ ...prev, [groupUrl]: event.currentTarget }));
        setSelectedGroup(groupUrl);
    };

    const handleVersionMenuClose = (groupUrl: string) => {
        setAnchorEl(prev => ({ ...prev, [groupUrl]: null }));
        setSelectedGroup(null);
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

    // Calculate unique pages count
    const uniquePagesCount = React.useMemo(() => {
        if (!pageData?.files) return 0;

        const uniquePages = new Set(
            pageData.files.map(file => file.pageUrl)
        );
        return uniquePages.size;
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
        console.log('aaa----', a.url, a.url.split('/').pop())
        // Get the filename from the URL
        const aFilename = a.url.split('/').pop() || '';
        const bFilename = b.url.split('/').pop() || '';
        return aFilename.localeCompare(bFilename);
    });

    // Count unique sites
    const uniqueSites = new Set(
        sortedGroupedFiles.map(group => {
            try {
                return new URL(group.url).hostname;
            } catch {
                return group.url;
            }
        })
    );

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
                            <IconButton onClick={introduceDesktop}>
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
                                                                onClick={(e) => handleVersionMenuOpen(e, group.url)}
                                                            >
                                                                <HistoryIcon />
                                                            </IconButton>
                                                        </span>
                                                    </Tooltip>
                                                )}
                                                <Menu
                                                    anchorEl={anchorEl[group.url]}
                                                    open={Boolean(anchorEl[group.url])}
                                                    onClose={() => handleVersionMenuClose(group.url)}
                                                >
                                                    {group.versions.slice(1).map((version) => (
                                                        <MenuItem
                                                            key={version.id}
                                                            onClick={introduceDesktop}
                                                            sx={{ minWidth: 200 }}
                                                        >
                                                            <ListItemText
                                                                primary={
                                                                    <Box display="flex" alignItems="center" gap={1}>
                                                                        <Chip
                                                                            size="small"
                                                                            label={`v${version.version}`}
                                                                        />
                                                                        <Typography variant="caption">
                                                                            {new Date(version.timestamp).toLocaleDateString()}
                                                                        </Typography>
                                                                    </Box>
                                                                }
                                                            />
                                                            <Tooltip title={`Download v${version.version} (${formatFileSize(version.size)})`}>
                                                                <IconButton
                                                                    size="small"
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        handleDownload(version);
                                                                    }}
                                                                    disabled={downloading[version.id]}
                                                                >
                                                                    {downloading[version.id] ? (
                                                                        <CircularProgress size={16} />
                                                                    ) : (
                                                                        <DownloadIcon fontSize="small" />
                                                                    )}
                                                                </IconButton>
                                                            </Tooltip>
                                                        </MenuItem>
                                                    ))}
                                                </Menu>
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

            {/* Fixed Footer */}
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
                        {stats && `Storage Used: ${formatFileSize(stats.totalSize)}`}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                        {pageData?.files.length || 0} Source Maps Found on {uniqueSites.size} {uniqueSites.size === 1 ? 'Site' : 'Sites'}
                    </Typography>
                </Box>
            </Box>

            <Toast
                open={toast.open}
                message={toast.message}
                severity={toast.severity}
                onClose={handleCloseToast}
            />
        </Box>
    );
}