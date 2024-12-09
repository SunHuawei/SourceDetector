import React, { useEffect, useState } from 'react';
import {
    Box,
    List,
    ListItem,
    ListItemIcon,
    ListItemText,
    ListItemSecondaryAction,
    IconButton,
    Typography,
    Divider,
    Button,
    CircularProgress,
    Alert,
    Tooltip
} from '@mui/material';
import {
    Javascript as JavascriptIcon,
    Css as CssIcon,
    Delete as DeleteIcon,
    OpenInNew as OpenInNewIcon,
    History as HistoryIcon,
    Settings as SettingsIcon
} from '@mui/icons-material';
import { SourceMapFile, StorageStats, PageData } from '@/types';
import { MESSAGE_TYPES } from '@/background/constants';
import { formatFileSize } from '@/background/utils';

export default function App() {
    const [loading, setLoading] = useState(true);
    const [pageData, setPageData] = useState<PageData | null>(null);
    const [stats, setStats] = useState<StorageStats | null>(null);

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
            url: chrome.runtime.getURL(`viewer/index.html?file=${encodeURIComponent(file.url)}`)
        });
    };

    const handleOpenHistory = () => {
        chrome.tabs.create({
            url: chrome.runtime.getURL('history/index.html')
        });
    };

    if (loading) {
        return (
            <Box display="flex" justifyContent="center" alignItems="center" minHeight={400}>
                <CircularProgress />
            </Box>
        );
    }

    return (
        <Box p={2} width={400}>
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                <Typography variant="h6">Source Maps</Typography>
                <Box>
                    <IconButton onClick={handleOpenHistory}>
                        <HistoryIcon />
                    </IconButton>
                    <IconButton onClick={() => chrome.runtime.openOptionsPage()}>
                        <SettingsIcon />
                    </IconButton>
                </Box>
            </Box>

            {pageData?.files.length ? (
                <>
                    <List>
                        {pageData.files.map((file, index) => (
                            <React.Fragment key={file.url}>
                                {index > 0 && <Divider />}
                                <ListItem>
                                    <ListItemIcon>
                                        {file.fileType === 'js' ? (
                                            <JavascriptIcon />
                                        ) : (
                                            <CssIcon />
                                        )}
                                    </ListItemIcon>
                                    <ListItemText
                                        primary={file.url.split('/').pop()}
                                        secondary={formatFileSize(file.size)}
                                    />
                                    <ListItemSecondaryAction>
                                        <IconButton
                                            edge="end"
                                            onClick={() => handleViewFile(file)}
                                        >
                                            <OpenInNewIcon />
                                        </IconButton>
                                    </ListItemSecondaryAction>
                                </ListItem>
                            </React.Fragment>
                        ))}
                    </List>

                    {stats && (
                        <Box mt={2} pt={2} borderTop={1} borderColor="divider">
                            <Typography variant="body2" color="textSecondary">
                                Storage: {formatFileSize(stats.usedSpace)} used
                            </Typography>
                            <Typography variant="body2" color="textSecondary">
                                Files: {stats.fileCount} total
                            </Typography>
                        </Box>
                    )}
                </>
            ) : (
                <Box textAlign="center" py={4}>
                    <Typography variant="body1" color="textSecondary" gutterBottom>
                        No source maps found on this page.
                    </Typography>
                    <Button
                        variant="outlined"
                        startIcon={<HistoryIcon />}
                        onClick={handleOpenHistory}
                    >
                        View History
                    </Button>
                </Box>
            )}
        </Box>
    );
} 