import React, { useEffect, useState } from 'react';
import {
    Box,
    List,
    ListItem,
    ListItemText,
    Typography,
    IconButton,
    Chip,
    Link,
    AppBar,
    Toolbar,
    Tooltip,
    Button
} from '@mui/material';
import { OpenInNew, Download, Delete, ClearAll } from '@mui/icons-material';
import { FILE_TYPES } from '@/background/constants';

interface SourceMap {
    sourceUrl: string;
    mapUrl: string;
    fileType: typeof FILE_TYPES[keyof typeof FILE_TYPES];
    timestamp: number;
}

export default function App() {
    const [sourceMaps, setSourceMaps] = useState<SourceMap[]>([]);

    useEffect(() => {
        loadSourceMaps();
        chrome.storage.onChanged.addListener(handleStorageChange);
        return () => chrome.storage.onChanged.removeListener(handleStorageChange);
    }, []);

    const loadSourceMaps = async () => {
        const { sourceMaps = [] } = await chrome.storage.local.get('sourceMaps');
        setSourceMaps(sourceMaps.sort((a, b) => b.timestamp - a.timestamp));
    };

    const handleStorageChange = (changes: { [key: string]: chrome.storage.StorageChange }) => {
        if (changes.sourceMaps) {
            setSourceMaps(changes.sourceMaps.newValue?.sort((a, b) => b.timestamp - a.timestamp) || []);
        }
    };

    const handleOpenSourceMap = (url: string) => {
        window.open(url, '_blank');
    };

    const handleDownload = async (sourceMap: SourceMap) => {
        try {
            await chrome.runtime.sendMessage({
                type: 'DOWNLOAD_SOURCE_MAP',
                data: sourceMap
            });
        } catch (error) {
            console.error('Failed to download source map:', error);
        }
    };

    const handleDelete = async (sourceMap: SourceMap) => {
        try {
            const newSourceMaps = sourceMaps.filter(sm => sm.sourceUrl !== sourceMap.sourceUrl);
            await chrome.storage.local.set({ sourceMaps: newSourceMaps });
        } catch (error) {
            console.error('Failed to delete source map:', error);
        }
    };

    const handleClearAll = async () => {
        try {
            await chrome.storage.local.set({ sourceMaps: [] });
        } catch (error) {
            console.error('Failed to clear source maps:', error);
        }
    };

    const formatUrl = (url: string) => {
        try {
            const { hostname, pathname } = new URL(url);
            return `${hostname}${pathname}`;
        } catch {
            return url;
        }
    };

    return (
        <Box sx={{ width: '500px', height: '600px', display: 'flex', flexDirection: 'column' }}>
            <AppBar position="static" color="default" elevation={1}>
                <Toolbar>
                    <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
                        Source Maps ({sourceMaps.length})
                    </Typography>
                    {sourceMaps.length > 0 && (
                        <Tooltip title="Clear all">
                            <IconButton onClick={handleClearAll} size="small">
                                <ClearAll />
                            </IconButton>
                        </Tooltip>
                    )}
                </Toolbar>
            </AppBar>

            {sourceMaps.length === 0 ? (
                <Box sx={{ p: 3, textAlign: 'center' }}>
                    <Typography color="text.secondary">
                        No source maps found yet. Browse some websites to collect source maps.
                    </Typography>
                </Box>
            ) : (
                <List sx={{ overflow: 'auto', flex: 1, py: 0 }}>
                    {sourceMaps.map((sourceMap, index) => (
                        <ListItem
                            key={`${sourceMap.sourceUrl}-${sourceMap.timestamp}`}
                            divider={index !== sourceMaps.length - 1}
                            secondaryAction={
                                <Box sx={{ display: 'flex', gap: 1 }}>
                                    <Tooltip title="Open source map">
                                        <IconButton
                                            edge="end"
                                            onClick={() => handleOpenSourceMap(sourceMap.mapUrl)}
                                            size="small"
                                        >
                                            <OpenInNew />
                                        </IconButton>
                                    </Tooltip>
                                    <Tooltip title="Download">
                                        <IconButton
                                            edge="end"
                                            onClick={() => handleDownload(sourceMap)}
                                            size="small"
                                        >
                                            <Download />
                                        </IconButton>
                                    </Tooltip>
                                    <Tooltip title="Delete">
                                        <IconButton
                                            edge="end"
                                            onClick={() => handleDelete(sourceMap)}
                                            size="small"
                                        >
                                            <Delete />
                                        </IconButton>
                                    </Tooltip>
                                </Box>
                            }
                        >
                            <ListItemText
                                primary={
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                        <Chip
                                            label={sourceMap.fileType}
                                            size="small"
                                            color={sourceMap.fileType === FILE_TYPES.JS ? 'primary' : 'secondary'}
                                        />
                                        <Link
                                            href={sourceMap.sourceUrl}
                                            target="_blank"
                                            rel="noopener"
                                            underline="hover"
                                            sx={{
                                                maxWidth: '300px',
                                                overflow: 'hidden',
                                                textOverflow: 'ellipsis',
                                                whiteSpace: 'nowrap',
                                                color: 'text.primary'
                                            }}
                                        >
                                            {formatUrl(sourceMap.sourceUrl)}
                                        </Link>
                                    </Box>
                                }
                                secondary={
                                    <Typography
                                        variant="body2"
                                        color="text.secondary"
                                        sx={{
                                            maxWidth: '350px',
                                            overflow: 'hidden',
                                            textOverflow: 'ellipsis',
                                            whiteSpace: 'nowrap'
                                        }}
                                    >
                                        {formatUrl(sourceMap.mapUrl)}
                                    </Typography>
                                }
                            />
                        </ListItem>
                    ))}
                </List>
            )}
        </Box>
    );
} 