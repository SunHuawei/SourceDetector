import { DEFAULT_SETTINGS, MESSAGE_TYPES, STORAGE_LIMITS } from '@/background/constants';
import { formatBytes } from '@/background/utils';
import { Toast } from '@/components/Toast';
import { AppSettings, StorageStats } from '@/types';
import { Delete as DeleteIcon } from '@mui/icons-material';
import {
    Alert,
    AppBar,
    Box,
    Button,
    CircularProgress,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    List,
    ListItem,
    ListItemSecondaryAction,
    ListItemText,
    Slider,
    Toolbar,
    Typography
} from '@mui/material';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import React, { useEffect, useState } from 'react';

export default function App() {
    const [loading, setLoading] = useState(true);
    const [settings, setSettings] = useState<AppSettings | null>(null);
    const [stats, setStats] = useState<StorageStats | null>(null);
    const [clearDialogOpen, setClearDialogOpen] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info' | 'warning'; text: string } | null>(null);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            const response = await chrome.runtime.sendMessage({
                type: MESSAGE_TYPES.GET_SETTINGS
            });

            if (response.success) {
                setSettings(response.data);
            }

            const statsResponse = await chrome.runtime.sendMessage({
                type: MESSAGE_TYPES.GET_STORAGE_STATS
            });

            if (statsResponse.success) {
                setStats(statsResponse.data);
            }
        } catch (error) {
            console.error('Error loading settings:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSettingChange = async (key: keyof AppSettings, value: any) => {
        if (!settings) return;

        try {
            const newSettings = { ...settings, [key]: value };
            const response = await chrome.runtime.sendMessage({
                type: MESSAGE_TYPES.UPDATE_SETTINGS,
                data: newSettings
            });

            if (response.success) {
                setSettings(newSettings);
                setMessage({ type: 'success', text: 'Settings saved successfully' });
            }
        } catch (error) {
            console.error('Error updating settings:', error);
            setMessage({ type: 'error', text: 'Failed to save settings' });
        }
    };

    const handleClearData = async () => {
        try {
            setLoading(true);
            const response = await chrome.runtime.sendMessage({
                type: MESSAGE_TYPES.CLEAR_DATA
            });

            if (response.success) {
                setStats({
                    usedSpace: 0,
                    fileCount: 0,
                    totalSize: 0,
                    pagesCount: 0,
                    oldestTimestamp: Date.now(),
                    uniqueSiteCount: 0
                });
                setSettings(DEFAULT_SETTINGS);
                setMessage({ type: 'success', text: 'Data cleared successfully' });
            } else {
                throw new Error(response.error || 'Failed to clear data');
            }
        } catch (error) {
            console.error('Error clearing data:', error);
            setMessage({ type: 'error', text: 'Failed to clear data' });
        } finally {
            setClearDialogOpen(false);
            setLoading(false);
        }
    };

    // Create theme based on dark mode setting
    const theme = React.useMemo(
        () =>
            createTheme({
                palette: {
                    mode: 'light',
                },
            }),
        []
    );

    if (loading) {
        return (
            <Box display="flex" justifyContent="center" alignItems="center" height="100vh">
                <CircularProgress />
            </Box>
        );
    }

    return (
        <ThemeProvider theme={theme}>
            <Box
                height="100vh"
                display="flex"
                flexDirection="column"
                sx={{
                    bgcolor: 'background.default',
                    color: 'text.primary'
                }}
            >
                <AppBar position="static">
                    <Toolbar>
                        <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
                            Source Detector - Settings
                        </Typography>
                    </Toolbar>
                </AppBar>

                <Box p={2} sx={{ overflowY: 'auto', width: '960px', margin: '0 auto' }}>
                    <Toast
                        open={!!message}
                        message={message?.text || ''}
                        severity={message?.type || 'info'}
                        onClose={() => setMessage(null)}
                    />

                    {stats && (
                        <Alert severity="info" sx={{ mb: 2 }}>
                            Storage used: {formatBytes(stats.usedSpace)} • {stats.fileCount} Source Maps Found on {stats.uniqueSiteCount} {stats.uniqueSiteCount === 1 ? 'Site' : 'Sites'}
                        </Alert>
                    )}

                    <List>
                        <ListItem>
                            <ListItemText
                                primary="Cleanup Threshold (MB)"
                                secondary={`Clean up when storage exceeds ${formatBytes(
                                    (settings?.cleanupThreshold ?? 500) * 1024 * 1024
                                )}`}
                            />
                            <ListItemSecondaryAction sx={{ width: '50%' }}>
                                <Slider
                                    value={settings?.cleanupThreshold ?? 500}
                                    min={STORAGE_LIMITS.CLEANUP_THRESHOLD.min}
                                    max={STORAGE_LIMITS.CLEANUP_THRESHOLD.max}
                                    step={100}
                                    onChange={(_, value) => handleSettingChange('cleanupThreshold', value)}
                                />
                            </ListItemSecondaryAction>
                        </ListItem>
                    </List>

                    <Box mt={4} display="flex" justifyContent="space-between" flexDirection="row-reverse">
                        <Button
                            variant="outlined"
                            color="error"
                            startIcon={<DeleteIcon />}
                            onClick={() => setClearDialogOpen(true)}
                        >
                            Clear Data
                        </Button>
                    </Box>
                </Box>

                <Dialog
                    open={clearDialogOpen}
                    onClose={() => setClearDialogOpen(false)}
                >
                    <DialogTitle>Clear Data</DialogTitle>
                    <DialogContent>
                        <Typography>
                            Are you sure you want to delete all data?
                            This action cannot be undone.
                        </Typography>
                    </DialogContent>
                    <DialogActions>
                        <Button onClick={() => setClearDialogOpen(false)}>Cancel</Button>
                        <Button onClick={handleClearData} color="error">Clear</Button>
                    </DialogActions>
                </Dialog>

            </Box>
        </ThemeProvider>
    );
} 