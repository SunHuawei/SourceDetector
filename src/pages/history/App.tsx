import React, { useEffect, useState } from 'react';
import {
    AppBar,
    Box,
    IconButton,
    List,
    ListItem,
    ListItemText,
    ListItemSecondaryAction,
    Toolbar,
    Typography,
    TextField,
    CircularProgress,
    Alert,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button
} from '@mui/material';
import {
    ArrowBack as ArrowBackIcon,
    Settings as SettingsIcon,
    Delete as DeleteIcon,
    OpenInNew as OpenInNewIcon
} from '@mui/icons-material';
import { PageData, StorageStats } from '@/types';
import { MESSAGE_TYPES } from '@/background/constants';
import { formatFileSize } from '@/background/utils';

export default function App() {
    const [loading, setLoading] = useState(true);
    const [pages, setPages] = useState<PageData[]>([]);
    const [stats, setStats] = useState<StorageStats | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedPage, setSelectedPage] = useState<PageData | null>(null);
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            const response = await chrome.runtime.sendMessage({
                type: MESSAGE_TYPES.GET_ALL_PAGES
            });

            if (response.success) {
                setPages(response.data.pages);
            }

            const statsResponse = await chrome.runtime.sendMessage({
                type: MESSAGE_TYPES.GET_STORAGE_STATS
            });

            if (statsResponse.success) {
                setStats(statsResponse.data);
            }
        } catch (error) {
            console.error('Error loading data:', error);
        } finally {
            setLoading(false);
        }
    };

    const filteredPages = pages.filter(page =>
        page.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        page.url.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const handleViewPage = (page: PageData) => {
        const firstFile = page.files[0];
        if (firstFile) {
            chrome.tabs.create({
                url: chrome.runtime.getURL(`viewer/index.html?file=${encodeURIComponent(firstFile.url)}`)
            });
        }
    };

    const handleDeletePage = (page: PageData) => {
        setSelectedPage(page);
        setDeleteDialogOpen(true);
    };

    const handleConfirmDelete = async () => {
        if (!selectedPage) return;

        try {
            await chrome.runtime.sendMessage({
                type: MESSAGE_TYPES.DELETE_PAGE,
                data: { url: selectedPage.url }
            });

            setPages(pages.filter(p => p.url !== selectedPage.url));
            setDeleteDialogOpen(false);
            setSelectedPage(null);
        } catch (error) {
            console.error('Error deleting page:', error);
        }
    };

    const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        setSearchTerm(event.target.value);
    };

    if (loading) {
        return (
            <Box display="flex" justifyContent="center" alignItems="center" height="100vh">
                <CircularProgress />
            </Box>
        );
    }

    return (
        <Box height="100vh" display="flex" flexDirection="column">
            <AppBar position="static">
                <Toolbar>
                    <IconButton
                        edge="start"
                        color="inherit"
                        onClick={() => window.close()}
                        sx={{ mr: 2 }}
                    >
                        <ArrowBackIcon />
                    </IconButton>
                    <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
                        History
                    </Typography>
                    <IconButton color="inherit" onClick={() => chrome.runtime.openOptionsPage()}>
                        <SettingsIcon />
                    </IconButton>
                </Toolbar>
            </AppBar>

            <Box p={2}>
                <TextField
                    fullWidth
                    variant="outlined"
                    placeholder="Search pages..."
                    value={searchTerm}
                    onChange={handleSearchChange}
                    sx={{ mb: 2 }}
                />

                {stats && (
                    <Alert severity="info" sx={{ mb: 2 }}>
                        Storage used: {formatFileSize(stats.usedSpace)} • Files: {stats.fileCount}
                    </Alert>
                )}

                <List>
                    {filteredPages.map((page) => (
                        <ListItem key={page.url} divider>
                            <ListItemText
                                primary={page.title}
                                secondary={
                                    <>
                                        {page.url}
                                        <br />
                                        {`${page.files.length} files • ${formatFileSize(
                                            page.files.reduce((sum, file) => sum + file.size, 0)
                                        )}`}
                                    </>
                                }
                            />
                            <ListItemSecondaryAction>
                                <IconButton
                                    edge="end"
                                    onClick={() => handleViewPage(page)}
                                    sx={{ mr: 1 }}
                                >
                                    <OpenInNewIcon />
                                </IconButton>
                                <IconButton
                                    edge="end"
                                    onClick={() => handleDeletePage(page)}
                                    color="error"
                                >
                                    <DeleteIcon />
                                </IconButton>
                            </ListItemSecondaryAction>
                        </ListItem>
                    ))}
                </List>

                {filteredPages.length === 0 && (
                    <Box textAlign="center" py={4}>
                        <Typography variant="body1" color="textSecondary">
                            No pages found.
                        </Typography>
                    </Box>
                )}
            </Box>

            <Dialog
                open={deleteDialogOpen}
                onClose={() => setDeleteDialogOpen(false)}
            >
                <DialogTitle>Delete Page</DialogTitle>
                <DialogContent>
                    <Typography>
                        Are you sure you want to delete all source maps from{' '}
                        <strong>{selectedPage?.title}</strong>?
                    </Typography>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
                    <Button onClick={handleConfirmDelete} color="error">Delete</Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
} 