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
    MoreVert as MoreVertIcon
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

    const handleViewFile = (file: SourceMapFile) => {
        chrome.tabs.create({
            url: chrome.runtime.getURL(
                `pages/viewer/index.html?level=file&file=${encodeURIComponent(file.url)}`
            )
        });
    };

    const handleViewDomain = (domain: string) => {
        chrome.tabs.create({
            url: chrome.runtime.getURL(
                `pages/viewer/index.html?level=domain&domain=${encodeURIComponent(domain)}`
            )
        });
    };

    const handleOpenPages = () => {
        chrome.tabs.create({
            url: chrome.runtime.getURL('pages/sourcemaps/index.html')
        });
    };


    const handleViewPage = (pageUrl: string) => {
        chrome.tabs.create({
            url: chrome.runtime.getURL(
                `pages/viewer/index.html?level=page&page=${encodeURIComponent(pageUrl)}`
            )
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
            <Box display="flex" justifyContent="center" alignItems="center" minHeight={400}>
                <CircularProgress />
            </Box>
        );
    }

    return (
        <Box p={2} width={600}>
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                <Typography variant="h6">Source Maps</Typography>
                <Box>
                    {groupedFiles.length > 0 && (
                        <Tooltip title="Download latest versions of all source maps">
                            <span>
                                <Button
                                    startIcon={downloadingAll ? <CircularProgress size={16} /> : <CloudDownloadIcon />}
                                    onClick={handleDownloadAll}
                                    disabled={downloadingAll}
                                    size="small"
                                    variant="outlined"
                                    sx={{ mr: 1 }}
                                >
                                    Download Latest
                                </Button>
                            </span>
                        </Tooltip>
                    )}
                    <Tooltip title="View all pages">
                        <IconButton onClick={handleOpenPages}>
                            <ListAltIcon />
                        </IconButton>
                    </Tooltip>
                    <IconButton onClick={() => chrome.runtime.openOptionsPage()}>
                        <SettingsIcon />
                    </IconButton>
                </Box>
            </Box>

            {groupedFiles.length > 0 ? (
                <TableContainer component={Paper}>
                    <Table size="small">
                        <TableHead>
                            <TableRow>
                                <TableCell>Source File</TableCell>
                                <TableCell align="right">Latest Version</TableCell>
                                <TableCell align="right">Previous Versions</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {groupedFiles.map((group) => (
                                <TableRow key={group.url}>
                                    <TableCell>
                                        <Box display="flex" alignItems="center" gap={1}>
                                            {group.fileType === 'js' ? (
                                                <JavascriptIcon fontSize="small" />
                                            ) : (
                                                <CssIcon fontSize="small" />
                                            )}
                                            <Typography variant="body2" noWrap>
                                                {group.url.split('/').pop()}
                                            </Typography>
                                        </Box>
                                    </TableCell>
                                    <TableCell align="right">
                                        {group.versions[0] && (
                                            <Box display="flex" alignItems="center" justifyContent="flex-end" gap={1}>
                                                <Chip
                                                    size="small"
                                                    color="primary"
                                                    label={`v${group.versions[0].version}`}
                                                />
                                                <Tooltip title="View source map">
                                                    <IconButton
                                                        size="small"
                                                        onClick={() => handleViewFile(group.versions[0])}
                                                    >
                                                        <OpenInNewIcon fontSize="small" />
                                                    </IconButton>
                                                </Tooltip>
                                                <Tooltip title="Download latest version">
                                                    <IconButton
                                                        size="small"
                                                        onClick={() => handleDownload(group.versions[0])}
                                                        disabled={downloading[group.versions[0].id]}
                                                    >
                                                        {downloading[group.versions[0].id] ? (
                                                            <CircularProgress size={16} />
                                                        ) : (
                                                            <DownloadIcon fontSize="small" />
                                                        )}
                                                    </IconButton>
                                                </Tooltip>
                                            </Box>
                                        )}
                                    </TableCell>
                                    <TableCell align="right">
                                        {group.versions.length > 1 && (
                                            <>
                                                <Tooltip title="Show previous versions">
                                                    <IconButton
                                                        size="small"
                                                        onClick={(e) => handleVersionMenuOpen(e, group.url)}
                                                    >
                                                        <MoreVertIcon fontSize="small" />
                                                        <Typography variant="caption" sx={{ ml: 0.5 }}>
                                                            {group.versions.length - 1}
                                                        </Typography>
                                                    </IconButton>
                                                </Tooltip>
                                                <Menu
                                                    anchorEl={anchorEl[group.url]}
                                                    open={Boolean(anchorEl[group.url])}
                                                    onClose={() => handleVersionMenuClose(group.url)}
                                                >
                                                    {group.versions.slice(1).map((version) => (
                                                        <MenuItem
                                                            key={version.id}
                                                            onClick={() => handleViewFile(version)}
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
                                                            <Tooltip title={`Download v${version.version}`}>
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
                                            </>
                                        )}
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </TableContainer>
            ) : (
                <Box textAlign="center" py={4}>
                    <Typography variant="body1" color="textSecondary" gutterBottom>
                        No source maps found on this page.
                    </Typography>
                </Box>
            )}

            {stats && (
                <Box mt={2} pt={2} borderTop={1} borderColor="divider">
                    <Typography variant="body2" color="textSecondary">
                        Storage: {formatFileSize(stats.usedSpace)} used
                    </Typography>
                    <Typography variant="body2" color="textSecondary">
                        Source maps from {stats.pagesCount} {stats.pagesCount === 1 ? 'domain' : 'domains'}
                    </Typography>
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