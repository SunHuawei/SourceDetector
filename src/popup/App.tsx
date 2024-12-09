import { MESSAGE_TYPES } from '@/background/constants';
import { formatBytes } from '@/background/utils';
import { Toast } from '@/components/Toast';
import { CrxFile, PageData, ParsedCrxFile, SourceMapFile, StorageStats } from '@/types';
import { isExtensionPage } from '@/utils/isExtensionPage';
import { parseCrxFile } from '@/utils/parseCrxFile';
import { SourceMapDownloader } from '@/utils/sourceMapDownloader';
import { groupSourceMapFiles } from '@/utils/sourceMapUtils';
import {
    CloudDownload as CloudDownloadIcon,
    ListAlt as ListAltIcon,
    Settings as SettingsIcon,
    CircleOutlined,
    CheckCircle
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

// Helper function to format bundle size
function getBundleSize(files: SourceMapFile[]): string {
    const totalSize = files.reduce((sum, file) => sum + file.size, 0);
    return formatBytes(totalSize);
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
    const [serverStatus, setServerStatus] = useState(false);

    useEffect(() => {
        loadData();
    }, []);

    useEffect(() => {
        // Check initial server status
        browserAPI.runtime.sendMessage({
            type: MESSAGE_TYPES.GET_SERVER_STATUS
        }).then(response => {
            if (response.success) {
                setServerStatus(response.data.isOnline);
            }
        });

        // Listen for server status changes
        const listener = (message: any) => {
            if (message.type === MESSAGE_TYPES.SERVER_STATUS_CHANGED) {
                setServerStatus(message.data.isOnline);
            }
        };
        browserAPI.runtime.onMessage.addListener(listener);
        return () => browserAPI.runtime.onMessage.removeListener(listener);
    }, []);

    const loadData = async () => {
        try {
            console.log('loadData')
            const [tab] = await browserAPI.tabs.query({ active: true, currentWindow: true });
            console.log('tab.url', tab.url)
            if (!tab.url) return;
            if (isExtensionPage(tab.url)) {
                console.log('isExtensionPage', tab.url)
                const response = await browserAPI.runtime.sendMessage({
                    type: MESSAGE_TYPES.GET_CRX_FILE,
                    data: { url: tab.url }
                });
                console.log('response', response);
                if (response.success && response.data) {
                    setCrxFile(response.data);
                    const result = await parseCrxFile(response.data.crxUrl);
                    setParsed(result);
                }
            } else {
                console.log('is not extension page', tab.url)
                const response = await browserAPI.runtime.sendMessage({
                    type: MESSAGE_TYPES.GET_PAGE_DATA,
                    data: { url: tab.url }
                });
                console.log('response', response)
                setPageData(response.data);
            }
            const statsResponse = await browserAPI.runtime.sendMessage({
                type: MESSAGE_TYPES.GET_STORAGE_STATS
            });
            console.log('statsResponse', statsResponse)
            setStats(statsResponse.data);
        } catch (error) {
            console.error('Error loading data:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleViewAllPages = () => {
        openInDesktop('handleViewAllPages', serverStatus, {});
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

    const handleVersionMenuOpen = (groupUrl: string) => {
        openInDesktop('handleVersionMenuOpen', serverStatus, { groupUrl });
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

    const handleOpenDesktopApp = () => {
        // Use the existing openInDesktop function which handles fallback
        openInDesktop('handleOpenDesktopApp', serverStatus, {
            type: crxFile ? 'crx-files' : 'source-files',
            url: crxFile ? crxFile.crxUrl : pageData?.url
        });
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
                        {crxFile ? 'Extension Files' : 'Source Maps'}
                    </Typography>
                    <Box>
                        <Tooltip title={`${serverStatus ? 'Desktop App Online - Click to open' : 'Desktop App Offline - Click to open'}`}>
                            <IconButton
                                size="small"
                                sx={{ mr: 1 }}
                                onClick={handleOpenDesktopApp}
                            >
                                {serverStatus ? (
                                    <CheckCircle color="success" />
                                ) : (
                                    <CircleOutlined color="error" />
                                )}
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
                        <Tooltip title="View all pages">
                            <IconButton onClick={handleViewAllPages}>
                                <ListAltIcon />
                            </IconButton>
                        </Tooltip>
                        <IconButton onClick={() => browserAPI.runtime.openOptionsPage()}>
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