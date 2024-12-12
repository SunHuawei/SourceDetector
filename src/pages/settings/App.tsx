import React, { useEffect, useState } from 'react';
import {
    Box,
    AppBar,
    Toolbar,
    IconButton,
    Typography,
    List,
    ListItem,
    ListItemText,
    ListItemSecondaryAction,
    Switch,
    Slider,
    Button,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Alert,
    CircularProgress,
} from '@mui/material';
import {
    ArrowBack as ArrowBackIcon,
    Delete as DeleteIcon,
    Download as DownloadIcon,
    Upload as UploadIcon,
} from '@mui/icons-material';
import { AppSettings, StorageStats } from '@/types';
import { DEFAULT_SETTINGS, MESSAGE_TYPES, STORAGE_LIMITS } from '@/background/constants';
import { formatFileSize } from '@/background/utils';
import { createTheme, ThemeProvider } from '@mui/material/styles';

export default function App() {
    const [loading, setLoading] = useState(true);
    const [settings, setSettings] = useState<AppSettings | null>(null);
    const [stats, setStats] = useState<StorageStats | null>(null);
    const [clearDialogOpen, setClearDialogOpen] = useState(false);
    const [exportDialogOpen, setExportDialogOpen] = useState(false);
    const [importDialogOpen, setImportDialogOpen] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

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

    const handleExportData = async () => {
        try {
            const response = await chrome.runtime.sendMessage({
                type: MESSAGE_TYPES.EXPORT_DATA
            });

            if (response.success) {
                const blob = new Blob([JSON.stringify(response.data, null, 2)], {
                    type: 'application/json'
                });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `source-collector-export-${new Date().toISOString()}.json`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
                setMessage({ type: 'success', text: 'Data exported successfully' });
            }
        } catch (error) {
            console.error('Error exporting data:', error);
            setMessage({ type: 'error', text: 'Failed to export data' });
        } finally {
            setExportDialogOpen(false);
        }
    };

    const handleImportData = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        try {
            const text = await file.text();
            const data = JSON.parse(text);

            const response = await chrome.runtime.sendMessage({
                type: MESSAGE_TYPES.IMPORT_DATA,
                data
            });

            if (response.success) {
                await loadData();
                setMessage({ type: 'success', text: 'Data imported successfully' });
            }
        } catch (error) {
            console.error('Error importing data:', error);
            setMessage({ type: 'error', text: 'Failed to import data' });
        } finally {
            setImportDialogOpen(false);
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
                    oldestTimestamp: Date.now()
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
                    mode: settings?.darkMode ? 'dark' : 'light',
                },
            }),
        [settings?.darkMode]
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
                        <IconButton
                            edge="start"
                            color="inherit"
                            onClick={() => window.close()}
                            sx={{ mr: 2 }}
                        >
                            <ArrowBackIcon />
                        </IconButton>
                        <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
                            Settings
                        </Typography>
                    </Toolbar>
                </AppBar>

                <Box p={2} sx={{ overflowY: 'auto' }}>
                    {message && (
                        <Alert
                            severity={message.type}
                            onClose={() => setMessage(null)}
                            sx={{ mb: 2 }}
                        >
                            {message.text}
                        </Alert>
                    )}

                    {stats && (
                        <Alert severity="info" sx={{ mb: 2 }}>
                            Storage used: {formatFileSize(stats.usedSpace)} • Files: {stats.fileCount}
                        </Alert>
                    )}

                    <List>
                        <ListItem>
                            <ListItemText primary="Dark Mode" />
                            <ListItemSecondaryAction>
                                <Switch
                                    checked={settings?.darkMode ?? false}
                                    onChange={(e) => handleSettingChange('darkMode', e.target.checked)}
                                />
                            </ListItemSecondaryAction>
                        </ListItem>

                        <ListItem>
                            <ListItemText primary="Collect JavaScript source maps" />
                            <ListItemSecondaryAction>
                                <Switch
                                    checked={settings?.collectJs ?? true}
                                    onChange={(e) => handleSettingChange('collectJs', e.target.checked)}
                                />
                            </ListItemSecondaryAction>
                        </ListItem>

                        <ListItem>
                            <ListItemText primary="Collect CSS source maps" />
                            <ListItemSecondaryAction>
                                <Switch
                                    checked={settings?.collectCss ?? true}
                                    onChange={(e) => handleSettingChange('collectCss', e.target.checked)}
                                />
                            </ListItemSecondaryAction>
                        </ListItem>

                        <ListItem>
                            <ListItemText
                                primary="Auto Cleanup"
                                secondary="Automatically clean up old source maps"
                            />
                            <ListItemSecondaryAction>
                                <Switch
                                    checked={settings?.autoCleanup ?? true}
                                    onChange={(e) => handleSettingChange('autoCleanup', e.target.checked)}
                                />
                            </ListItemSecondaryAction>
                        </ListItem>

                        <ListItem>
                            <ListItemText
                                primary="Cleanup Threshold (MB)"
                                secondary={`Clean up when storage exceeds ${formatFileSize(
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

                        <ListItem>
                            <ListItemText
                                primary="Retention Days"
                                secondary={`Keep source maps for ${settings?.retentionDays ?? 30} days`}
                            />
                            <ListItemSecondaryAction sx={{ width: '50%' }}>
                                <Slider
                                    value={settings?.retentionDays ?? DEFAULT_SETTINGS.retentionDays}
                                    min={STORAGE_LIMITS.RETENTION_DAYS.min}
                                    max={STORAGE_LIMITS.RETENTION_DAYS.max}
                                    step={1}
                                    onChange={(_, value) => handleSettingChange('retentionDays', value)}
                                />
                            </ListItemSecondaryAction>
                        </ListItem>

                        <ListItem>
                            <ListItemText
                                primary="Max File Size (MB)"
                                secondary={`Skip files larger than ${settings?.maxFileSize ?? 100} MB`}
                            />
                            <ListItemSecondaryAction sx={{ width: '50%' }}>
                                <Slider
                                    value={settings?.maxFileSize ?? DEFAULT_SETTINGS.maxFileSize}
                                    min={STORAGE_LIMITS.FILE_SIZE.min}
                                    max={STORAGE_LIMITS.FILE_SIZE.max}
                                    step={1}
                                    onChange={(_, value) => handleSettingChange('maxFileSize', value)}
                                />
                            </ListItemSecondaryAction>
                        </ListItem>
                    </List>

                    <Box mt={4} display="flex" justifyContent="space-between">
                        <Box>
                            <Button
                                variant="outlined"
                                startIcon={<DownloadIcon />}
                                onClick={() => setExportDialogOpen(true)}
                                sx={{ mr: 1 }}
                            >
                                Export
                            </Button>
                            <Button
                                variant="outlined"
                                startIcon={<UploadIcon />}
                                onClick={() => setImportDialogOpen(true)}
                            >
                                Import
                            </Button>
                        </Box>
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
                            Are you sure you want to delete all collected source maps?
                            This action cannot be undone.
                        </Typography>
                    </DialogContent>
                    <DialogActions>
                        <Button onClick={() => setClearDialogOpen(false)}>Cancel</Button>
                        <Button onClick={handleClearData} color="error">Clear</Button>
                    </DialogActions>
                </Dialog>

                <Dialog
                    open={exportDialogOpen}
                    onClose={() => setExportDialogOpen(false)}
                >
                    <DialogTitle>Export Data</DialogTitle>
                    <DialogContent>
                        <Typography>
                            Export all collected source maps and settings to a JSON file?
                        </Typography>
                    </DialogContent>
                    <DialogActions>
                        <Button onClick={() => setExportDialogOpen(false)}>Cancel</Button>
                        <Button onClick={handleExportData} color="primary">Export</Button>
                    </DialogActions>
                </Dialog>

                <Dialog
                    open={importDialogOpen}
                    onClose={() => setImportDialogOpen(false)}
                >
                    <DialogTitle>Import Data</DialogTitle>
                    <DialogContent>
                        <Typography gutterBottom>
                            Import source maps and settings from a JSON file.
                            This will merge with your existing data.
                        </Typography>
                        <Button
                            variant="contained"
                            component="label"
                        >
                            Choose File
                            <input
                                type="file"
                                accept=".json"
                                hidden
                                onChange={handleImportData}
                            />
                        </Button>
                    </DialogContent>
                    <DialogActions>
                        <Button onClick={() => setImportDialogOpen(false)}>Cancel</Button>
                    </DialogActions>
                </Dialog>
            </Box>
        </ThemeProvider>
    );
} 