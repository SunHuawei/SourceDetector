import React, { useEffect, useState } from 'react';
import {
    Box,
    Container,
    Typography,
    Paper,
    List,
    ListItem,
    ListItemText,
    ListItemIcon,
    ListItemButton,
    Collapse,
    IconButton,
    Chip,
    Tooltip,
    CircularProgress,
    Divider,
    TextField,
    InputAdornment
} from '@mui/material';
import {
    ExpandMore as ExpandMoreIcon,
    ExpandLess as ExpandLessIcon,
    Language as LanguageIcon,
    Javascript as JavascriptIcon,
    Css as CssIcon,
    Download as DownloadIcon,
    OpenInNew as OpenInNewIcon,
    Search as SearchIcon,
    CloudDownload as CloudDownloadIcon
} from '@mui/icons-material';
import { SourceMapFile } from '@/types';
import { MESSAGE_TYPES } from '@/background/constants';
import { formatFileSize } from '@/background/utils';
import { SourceMapDownloader } from '@/utils/sourceMapDownloader';
import { Toast } from '@/components/Toast';

interface GroupedSourceMaps {
    [pageUrl: string]: {
        pageTitle: string;
        timestamp: number;
        files: {
            [sourceUrl: string]: SourceMapFile[];
        };
    };
}

interface DomainGroupedData {
    [domain: string]: {
        pages: {
            [pageUrl: string]: GroupedSourceMaps[string]
        };
        timestamp: number; // Latest timestamp in the domain
    };
}

export default function App() {
    const [loading, setLoading] = useState(true);
    const [groupedData, setGroupedData] = useState<GroupedSourceMaps>({});
    const [expandedPages, setExpandedPages] = useState<{ [key: string]: boolean }>({});
    const [expandedFiles, setExpandedFiles] = useState<{ [key: string]: boolean }>({});
    const [downloading, setDownloading] = useState<{ [key: string]: boolean }>({});
    const [searchQuery, setSearchQuery] = useState('');
    const [expandedDomains, setExpandedDomains] = useState<{ [key: string]: boolean }>({});
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
            const response = await chrome.runtime.sendMessage({
                type: MESSAGE_TYPES.GET_ALL_SOURCE_MAPS
            });

            // Group data by page URL and then by source URL
            const grouped: GroupedSourceMaps = {};
            response.data.forEach((file: SourceMapFile) => {
                if (!grouped[file.pageUrl]) {
                    grouped[file.pageUrl] = {
                        pageTitle: file.pageTitle,
                        timestamp: file.timestamp,
                        files: {}
                    };
                }
                if (!grouped[file.pageUrl].files[file.url]) {
                    grouped[file.pageUrl].files[file.url] = [];
                }
                grouped[file.pageUrl].files[file.url].push(file);
            });

            // Sort versions within each file
            Object.values(grouped).forEach(page => {
                Object.values(page.files).forEach(versions => {
                    versions.sort((a, b) => b.version - a.version);
                });
            });

            setGroupedData(grouped);
        } catch (error) {
            console.error('Error loading data:', error);
        } finally {
            setLoading(false);
        }
    };

    const handlePageToggle = (pageUrl: string) => {
        setExpandedPages(prev => ({
            ...prev,
            [pageUrl]: !prev[pageUrl]
        }));
    };

    const handleFileToggle = (fileUrl: string) => {
        setExpandedFiles(prev => ({
            ...prev,
            [fileUrl]: !prev[fileUrl]
        }));
    };

    const handleViewFile = (file: SourceMapFile) => {
        chrome.tabs.create({
            url: chrome.runtime.getURL(`pages/viewer/index.html?file=${encodeURIComponent(file.url)}`)
        });
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

    const handleDownloadAllLatest = async (pageUrl: string, pageData: GroupedSourceMaps[string]) => {
        const latestVersions = Object.values(pageData.files).map(versions => versions[0]);
        await SourceMapDownloader.downloadAllLatest(latestVersions, pageUrl, {
            onError: (error) => {
                console.error('Download failed:', error);
            }
        });
    };

    // Filter data based on search query
    const filteredData = React.useMemo(() => {
        if (!searchQuery) return groupedData;

        const searchLower = searchQuery.toLowerCase();
        const filtered: GroupedSourceMaps = {};

        Object.entries(groupedData).forEach(([pageUrl, pageData]) => {
            // Check if page title or URL matches
            if (
                pageData.pageTitle.toLowerCase().includes(searchLower) ||
                pageUrl.toLowerCase().includes(searchLower)
            ) {
                filtered[pageUrl] = pageData;
                return;
            }

            // Check if any file URL matches
            const matchingFiles: typeof pageData.files = {};
            Object.entries(pageData.files).forEach(([fileUrl, versions]) => {
                if (fileUrl.toLowerCase().includes(searchLower)) {
                    matchingFiles[fileUrl] = versions;
                }
            });

            if (Object.keys(matchingFiles).length > 0) {
                filtered[pageUrl] = {
                    ...pageData,
                    files: matchingFiles
                };
            }
        });

        return filtered;
    }, [groupedData, searchQuery]);

    // Group data by domain
    const domainGroupedData = React.useMemo(() => {
        if (!searchQuery) {
            const grouped: DomainGroupedData = {};
            Object.entries(groupedData).forEach(([pageUrl, pageData]) => {
                try {
                    const domain = new URL(pageUrl).hostname;
                    if (!grouped[domain]) {
                        grouped[domain] = {
                            pages: {},
                            timestamp: pageData.timestamp
                        };
                    }
                    grouped[domain].pages[pageUrl] = pageData;
                    grouped[domain].timestamp = Math.max(grouped[domain].timestamp, pageData.timestamp);
                } catch (error) {
                    console.error('Error parsing URL:', error);
                }
            });
            return grouped;
        } else {
            // When searching, group the filtered results
            const grouped: DomainGroupedData = {};
            Object.entries(filteredData).forEach(([pageUrl, pageData]) => {
                try {
                    const domain = new URL(pageUrl).hostname;
                    if (!grouped[domain]) {
                        grouped[domain] = {
                            pages: {},
                            timestamp: pageData.timestamp
                        };
                    }
                    grouped[domain].pages[pageUrl] = pageData;
                    grouped[domain].timestamp = Math.max(grouped[domain].timestamp, pageData.timestamp);
                } catch (error) {
                    console.error('Error parsing URL:', error);
                }
            });
            return grouped;
        }
    }, [groupedData, filteredData, searchQuery]);

    const handleDomainToggle = (domain: string) => {
        setExpandedDomains(prev => ({
            ...prev,
            [domain]: !prev[domain]
        }));
    };

    const handleDownloadDomain = async (domain: string, domainData: DomainGroupedData[string]) => {
        try {
            const latestVersions: SourceMapFile[] = [];
            Object.entries(domainData.pages).forEach(([pageUrl, pageData]) => {
                Object.values(pageData.files).forEach(versions => {
                    latestVersions.push(versions[0]);
                });
            });

            await SourceMapDownloader.downloadAllLatest(latestVersions, domain, {
                onError: (error) => {
                    showToast(error.message, 'error');
                }
            });
            showToast(`Downloaded all files from ${domain}`, 'success');
        } catch (error) {
            showToast(`Failed to download files from ${domain}`, 'error');
        }
    };

    const handleViewDomain = (domain: string) => {
        chrome.tabs.create({
            url: chrome.runtime.getURL(
                `pages/viewer/index.html?level=domain&domain=${encodeURIComponent(domain)}`
            )
        });
    };

    const handleViewPage = (pageUrl: string) => {
        chrome.tabs.create({
            url: chrome.runtime.getURL(
                `pages/viewer/index.html?level=page&page=${encodeURIComponent(pageUrl)}`
            )
        });
    };

    if (loading) {
        return (
            <Box display="flex" justifyContent="center" alignItems="center" minHeight="100vh">
                <CircularProgress />
            </Box>
        );
    }

    return (
        <Container maxWidth="lg">
            <Box py={4}>
                <Typography variant="h4" gutterBottom>
                    Source Maps by Website
                </Typography>

                <Box mb={3}>
                    <TextField
                        fullWidth
                        variant="outlined"
                        placeholder="Search by website name, URL, or file name..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        InputProps={{
                            startAdornment: (
                                <InputAdornment position="start">
                                    <SearchIcon />
                                </InputAdornment>
                            )
                        }}
                    />
                </Box>

                <Paper>
                    <List>
                        {Object.entries(domainGroupedData)
                            .sort(([, a], [, b]) => b.timestamp - a.timestamp)
                            .map(([domain, domainData]) => (
                                <React.Fragment key={domain}>
                                    <ListItemButton onClick={() => handleDomainToggle(domain)}>
                                        <ListItemIcon>
                                            <LanguageIcon />
                                        </ListItemIcon>
                                        <ListItemText
                                            primary={
                                                <Box display="flex" alignItems="center" gap={1}>
                                                    <Box>
                                                        <Typography variant="subtitle1">
                                                            {domain}
                                                        </Typography>
                                                        <Typography variant="caption" color="textSecondary">
                                                            {Object.keys(domainData.pages).length} pages
                                                        </Typography>
                                                    </Box>
                                                    <Tooltip title="View in VSCode">
                                                        <IconButton
                                                            size="small"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleViewDomain(domain);
                                                            }}
                                                        >
                                                            <OpenInNewIcon fontSize="small" />
                                                        </IconButton>
                                                    </Tooltip>
                                                    <Tooltip title="Download all latest versions from this domain">
                                                        <IconButton
                                                            size="small"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleDownloadDomain(domain, domainData);
                                                            }}
                                                        >
                                                            <CloudDownloadIcon fontSize="small" />
                                                        </IconButton>
                                                    </Tooltip>
                                                </Box>
                                            }
                                            secondary={new Date(domainData.timestamp).toLocaleString()}
                                        />
                                        {expandedDomains[domain] ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                                    </ListItemButton>
                                    <Collapse in={expandedDomains[domain]} timeout="auto">
                                        <List component="div" disablePadding>
                                            {Object.entries(domainData.pages)
                                                .sort(([, a], [, b]) => b.timestamp - a.timestamp)
                                                .map(([pageUrl, pageData]) => (
                                                    <React.Fragment key={pageUrl}>
                                                        <ListItemButton
                                                            onClick={() => handlePageToggle(pageUrl)}
                                                            sx={{ pl: 4 }}
                                                        >
                                                            <ListItemIcon>
                                                                <LanguageIcon />
                                                            </ListItemIcon>
                                                            <ListItemText
                                                                primary={
                                                                    <Box display="flex" alignItems="center" gap={1}>
                                                                        <Box>
                                                                            <Typography variant="subtitle2">
                                                                                {pageData.pageTitle || 'Untitled'}
                                                                            </Typography>
                                                                            <Typography
                                                                                variant="caption"
                                                                                color="textSecondary"
                                                                                sx={{ wordBreak: 'break-all', display: 'block' }}
                                                                            >
                                                                                {pageUrl}
                                                                            </Typography>
                                                                        </Box>
                                                                        <Tooltip title="View in VSCode">
                                                                            <IconButton
                                                                                size="small"
                                                                                onClick={(e) => {
                                                                                    e.stopPropagation();
                                                                                    handleViewPage(pageUrl);
                                                                                }}
                                                                            >
                                                                                <OpenInNewIcon fontSize="small" />
                                                                            </IconButton>
                                                                        </Tooltip>
                                                                        <Tooltip title="Download all latest versions">
                                                                            <IconButton
                                                                                size="small"
                                                                                onClick={(e) => {
                                                                                    e.stopPropagation();
                                                                                    handleDownloadAllLatest(pageUrl, pageData);
                                                                                }}
                                                                            >
                                                                                <CloudDownloadIcon fontSize="small" />
                                                                            </IconButton>
                                                                        </Tooltip>
                                                                    </Box>
                                                                }
                                                                secondary={
                                                                    <Box display="flex" alignItems="center" gap={1}>
                                                                        <Typography variant="caption">
                                                                            {new Date(pageData.timestamp).toLocaleString()}
                                                                        </Typography>
                                                                        <Typography variant="caption" color="textSecondary">
                                                                            ({Object.keys(pageData.files).length} files)
                                                                        </Typography>
                                                                    </Box>
                                                                }
                                                            />
                                                            {expandedPages[pageUrl] ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                                                        </ListItemButton>
                                                        <Collapse in={expandedPages[pageUrl]} timeout="auto">
                                                            <List component="div" disablePadding>
                                                                {Object.entries(pageData.files).map(([sourceUrl, versions]) => (
                                                                    <React.Fragment key={sourceUrl}>
                                                                        <ListItemButton
                                                                            onClick={() => handleFileToggle(sourceUrl)}
                                                                            sx={{ pl: 8 }}
                                                                        >
                                                                            <ListItemIcon>
                                                                                {versions[0].fileType === 'js' ? (
                                                                                    <JavascriptIcon />
                                                                                ) : (
                                                                                    <CssIcon />
                                                                                )}
                                                                            </ListItemIcon>
                                                                            <ListItemText
                                                                                primary={
                                                                                    <Box>
                                                                                        <Typography variant="body2">
                                                                                            {sourceUrl.split('/').pop()}
                                                                                        </Typography>
                                                                                        <Typography
                                                                                            variant="caption"
                                                                                            color="textSecondary"
                                                                                            sx={{
                                                                                                wordBreak: 'break-all',
                                                                                                display: 'block'
                                                                                            }}
                                                                                        >
                                                                                            {sourceUrl}
                                                                                        </Typography>
                                                                                    </Box>
                                                                                }
                                                                                secondary={`${versions.length} version${versions.length > 1 ? 's' : ''}`}
                                                                            />
                                                                            {expandedFiles[sourceUrl] ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                                                                        </ListItemButton>
                                                                        <Collapse in={expandedFiles[sourceUrl]} timeout="auto">
                                                                            <List component="div" disablePadding>
                                                                                {versions.map((file) => (
                                                                                    <ListItem key={file.id} sx={{ pl: 8 }}>
                                                                                        <ListItemText
                                                                                            primary={
                                                                                                <Box display="flex" alignItems="center" gap={1}>
                                                                                                    <Chip
                                                                                                        size="small"
                                                                                                        label={`v${file.version}`}
                                                                                                        color={file.isLatest ? "primary" : "default"}
                                                                                                    />
                                                                                                    <Typography variant="body2">
                                                                                                        {formatFileSize(file.size)}
                                                                                                    </Typography>
                                                                                                    <Typography variant="caption" color="textSecondary">
                                                                                                        {new Date(file.timestamp).toLocaleString()}
                                                                                                    </Typography>
                                                                                                </Box>
                                                                                            }
                                                                                        />
                                                                                        <Tooltip title="View source map">
                                                                                            <IconButton
                                                                                                size="small"
                                                                                                onClick={() => handleViewFile(file)}
                                                                                            >
                                                                                                <OpenInNewIcon fontSize="small" />
                                                                                            </IconButton>
                                                                                        </Tooltip>
                                                                                        <Tooltip title="Download">
                                                                                            <IconButton
                                                                                                size="small"
                                                                                                onClick={() => handleDownload(file)}
                                                                                                disabled={downloading[file.id]}
                                                                                            >
                                                                                                {downloading[file.id] ? (
                                                                                                    <CircularProgress size={16} />
                                                                                                ) : (
                                                                                                    <DownloadIcon fontSize="small" />
                                                                                                )}
                                                                                            </IconButton>
                                                                                        </Tooltip>
                                                                                    </ListItem>
                                                                                ))}
                                                                            </List>
                                                                        </Collapse>
                                                                    </React.Fragment>
                                                                ))}
                                                            </List>
                                                        </Collapse>
                                                        <Divider />
                                                    </React.Fragment>
                                                ))}
                                        </List>
                                    </Collapse>
                                    <Divider />
                                </React.Fragment>
                            ))}
                    </List>
                </Paper>
            </Box>
            <Toast
                open={toast.open}
                message={toast.message}
                severity={toast.severity}
                onClose={handleCloseToast}
            />
        </Container>
    );
} 