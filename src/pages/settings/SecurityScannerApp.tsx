import { DEFAULT_SETTINGS, MESSAGE_TYPES, STORAGE_LIMITS } from '@/background/constants';
import { CHROME_WEB_STORE_REVIEW_URL, GITHUB_FEEDBACK_URL } from '@/constants/links';
import { formatBytes } from '@/background/utils';
import { Toast } from '@/components/Toast';
import {
    BUILT_IN_RULES,
    getBuiltInRules,
    getUserRules,
    initializeRulesStorage,
    removeUserRule,
    setRuleEnabled,
    upsertUserRule
} from '@/storage/rules';
import { AppSettings, Rule, StorageStats, ThemePreference } from '@/types';
import { browserAPI } from '@/utils/browser-polyfill';
import { trackEvent, trackProductEvent } from '@/utils/analytics';
import { Add as AddIcon, Delete as DeleteIcon, GitHub as GitHubIcon, StarRate as StarRateIcon } from '@mui/icons-material';
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
    Divider,
    IconButton,
    List,
    ListItem,
    ListItemText,
    Paper,
    Slider,
    Stack,
    Switch,
    TextField,
    Toolbar,
    Tooltip,
    Typography,
    ToggleButton,
    ToggleButtonGroup
} from '@mui/material';
import { useEffect, useState } from 'react';

interface ToastMessage {
    type: 'success' | 'error' | 'info' | 'warning';
    text: string;
}

function createCustomRuleId(): string {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return `custom_regex_${crypto.randomUUID()}`;
    }

    return `custom_regex_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export default function SecurityScannerApp() {
    const [loading, setLoading] = useState(true);
    const [settings, setSettings] = useState<AppSettings | null>(null);
    const [stats, setStats] = useState<StorageStats | null>(null);
    const [builtInRules, setBuiltInRules] = useState<Rule[]>([]);
    const [userRules, setUserRules] = useState<Rule[]>([]);
    const [customRuleName, setCustomRuleName] = useState('');
    const [customRulePattern, setCustomRulePattern] = useState('');
    const [customRuleFlags, setCustomRuleFlags] = useState('');
    const [rulesUpdating, setRulesUpdating] = useState(false);
    const [clearDialogOpen, setClearDialogOpen] = useState(false);
    const [message, setMessage] = useState<ToastMessage | null>(null);

    useEffect(() => {
        void loadData();
        void trackEvent('settings_viewed');
    }, []);

    const loadRules = async () => {
        await initializeRulesStorage();
        const [storedBuiltInRules, storedUserRules] = await Promise.all([
            getBuiltInRules(),
            getUserRules()
        ]);

        const builtInRuleEnabledMap = new Map(
            storedBuiltInRules.map((rule) => [rule.id, rule.isEnabled] as const)
        );

        setBuiltInRules(
            BUILT_IN_RULES.map((rule) => ({
                ...rule,
                isEnabled: builtInRuleEnabledMap.get(rule.id) ?? rule.isEnabled
            }))
        );
        setUserRules(storedUserRules);
    };

    const loadData = async (): Promise<void> => {
        try {
            const [settingsResponse, statsResponse] = await Promise.all([
                browserAPI.runtime.sendMessage({
                    type: MESSAGE_TYPES.GET_SETTINGS
                }),
                browserAPI.runtime.sendMessage({
                    type: MESSAGE_TYPES.GET_STORAGE_STATS
                })
            ]);

            if (settingsResponse.success) {
                setSettings(settingsResponse.data);
            }

            if (statsResponse.success) {
                setStats(statsResponse.data);
            }

            await loadRules();
        } catch (error) {
            console.error('Error loading settings:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSettingChange = async <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
        if (!settings) return;

        try {
            const newSettings = { ...settings, [key]: value };
            const response = await browserAPI.runtime.sendMessage({
                type: MESSAGE_TYPES.UPDATE_SETTINGS,
                data: newSettings
            });

            if (response.success) {
                const previousThemePreference = settings.themePreference;
                setSettings(newSettings);
                void trackProductEvent('settings_changed', {
                    surface: 'settings',
                    setting_key: key,
                    setting_value: value
                });
                if (key === 'themePreference') {
                    const nextThemePreference = value as ThemePreference;
                    const systemPrefersDark =
                        typeof window !== 'undefined' &&
                        typeof window.matchMedia === 'function' &&
                        window.matchMedia('(prefers-color-scheme: dark)').matches;
                    const appliedThemeMode =
                        nextThemePreference === 'system'
                            ? (systemPrefersDark ? 'dark' : 'light')
                            : nextThemePreference;
                    void trackEvent('theme_changed', {
                        surface: 'settings',
                        trigger: 'theme_toggle',
                        previous_theme_preference: previousThemePreference,
                        theme_preference: nextThemePreference,
                        theme_mode: appliedThemeMode,
                        system_prefers_dark: systemPrefersDark
                    });
                }
                setMessage({ type: 'success', text: 'Settings saved successfully' });
            }
        } catch (error) {
            console.error('Error updating settings:', error);
            setMessage({ type: 'error', text: 'Failed to save settings' });
        }
    };

    const handleBuiltInRuleToggle = async (ruleId: string, isEnabled: boolean) => {
        try {
            setRulesUpdating(true);
            await setRuleEnabled(ruleId, isEnabled);
            setBuiltInRules((previousRules) =>
                previousRules.map((rule) =>
                    rule.id === ruleId
                        ? { ...rule, isEnabled }
                        : rule
                )
            );
            void trackProductEvent('settings_changed', {
                surface: 'settings',
                setting_key: 'built_in_rule_enabled',
                setting_target: ruleId,
                setting_value: isEnabled
            });
            setMessage({ type: 'success', text: 'Built-in rule updated' });
        } catch (error) {
            console.error('Error updating built-in rule:', error);
            setMessage({ type: 'error', text: 'Failed to update built-in rule' });
        } finally {
            setRulesUpdating(false);
        }
    };

    const handleUserRuleToggle = async (ruleId: string, isEnabled: boolean) => {
        try {
            setRulesUpdating(true);
            await setRuleEnabled(ruleId, isEnabled);
            setUserRules((previousRules) =>
                previousRules.map((rule) =>
                    rule.id === ruleId
                        ? { ...rule, isEnabled }
                        : rule
                )
            );
            void trackProductEvent('settings_changed', {
                surface: 'settings',
                setting_key: 'custom_rule_enabled',
                setting_target: ruleId,
                setting_value: isEnabled
            });
            setMessage({ type: 'success', text: 'Custom rule updated' });
        } catch (error) {
            console.error('Error updating custom rule:', error);
            setMessage({ type: 'error', text: 'Failed to update custom rule' });
        } finally {
            setRulesUpdating(false);
        }
    };

    const handleAddCustomRule = async () => {
        const normalizedPattern = customRulePattern.trim();
        const normalizedFlags = customRuleFlags.trim();
        const normalizedName = customRuleName.trim().length > 0
            ? customRuleName.trim()
            : `Custom Rule ${userRules.length + 1}`;

        if (normalizedPattern.length === 0) {
            setMessage({ type: 'warning', text: 'Regex pattern is required' });
            return;
        }

        const newRule: Rule = {
            id: createCustomRuleId(),
            name: normalizedName,
            pattern: normalizedPattern,
            flags: normalizedFlags.length > 0 ? normalizedFlags : undefined,
            description: 'User-defined regex rule',
            isEnabled: true,
            isBuiltIn: false
        };

        try {
            setRulesUpdating(true);
            await upsertUserRule(newRule);
            await loadRules();
            void trackEvent('settings_add_custom_rule', {
                rule_id: newRule.id,
                has_flags: Boolean(newRule.flags)
            });
            void trackProductEvent('settings_changed', {
                surface: 'settings',
                setting_key: 'custom_rule_added',
                setting_target: newRule.id,
                has_flags: Boolean(newRule.flags)
            });
            setCustomRuleName('');
            setCustomRulePattern('');
            setCustomRuleFlags('');
            setMessage({ type: 'success', text: 'Custom rule added' });
        } catch (error) {
            console.error('Error adding custom rule:', error);
            setMessage({
                type: 'error',
                text: error instanceof Error ? error.message : 'Failed to add custom rule'
            });
        } finally {
            setRulesUpdating(false);
        }
    };

    const handleDeleteCustomRule = async (ruleId: string) => {
        try {
            setRulesUpdating(true);
            await removeUserRule(ruleId);
            setUserRules((previousRules) => previousRules.filter((rule) => rule.id !== ruleId));
            void trackProductEvent('settings_changed', {
                surface: 'settings',
                setting_key: 'custom_rule_deleted',
                setting_target: ruleId
            });
            setMessage({ type: 'success', text: 'Custom rule deleted' });
        } catch (error) {
            console.error('Error deleting custom rule:', error);
            setMessage({ type: 'error', text: 'Failed to delete custom rule' });
        } finally {
            setRulesUpdating(false);
        }
    };

    const handleClearData = async () => {
        try {
            setLoading(true);
            const response = await browserAPI.runtime.sendMessage({
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
                void trackEvent('settings_clear_data');
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

    const handleOpenGithubFeedback = () => {
        void trackEvent('settings_open_github_feedback');
        void trackProductEvent('share_clicked', {
            surface: 'settings',
            placement: 'header_feedback_icon',
            share_target: 'github_issues',
            share_channel: 'github'
        });
        window.open(GITHUB_FEEDBACK_URL, '_blank', 'noopener,noreferrer');
    };

    const handleOpenRateUs = () => {
        void trackEvent('settings_open_rate_us');
        void trackProductEvent('share_clicked', {
            surface: 'settings',
            placement: 'header_rate_us_icon',
            share_target: 'chrome_web_store_reviews',
            share_channel: 'chrome_web_store'
        });
        window.open(CHROME_WEB_STORE_REVIEW_URL, '_blank', 'noopener,noreferrer');
    };

    if (loading) {
        return (
            <Box display="flex" justifyContent="center" alignItems="center" height="100vh">
                <CircularProgress />
            </Box>
        );
    }

    return (
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
                    <Tooltip title="Rate us on Chrome Web Store">
                        <IconButton color="inherit" onClick={handleOpenRateUs}>
                            <StarRateIcon />
                        </IconButton>
                    </Tooltip>
                    <Tooltip title="Feedback on GitHub">
                        <IconButton
                            color="inherit"
                            onClick={handleOpenGithubFeedback}
                        >
                            <GitHubIcon />
                        </IconButton>
                    </Tooltip>
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

                <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
                    <Typography variant="h6" sx={{ mb: 1 }}>
                        Appearance
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                        Choose how the extension theme is applied. Default follows your system setting.
                    </Typography>
                    <ToggleButtonGroup
                        exclusive
                        value={settings?.themePreference ?? 'system'}
                        onChange={(_, value: ThemePreference | null) => {
                            if (value) {
                                void handleSettingChange('themePreference', value);
                            }
                        }}
                        size="small"
                    >
                        <ToggleButton value="system">System</ToggleButton>
                        <ToggleButton value="light">Light</ToggleButton>
                        <ToggleButton value="dark">Dark</ToggleButton>
                    </ToggleButtonGroup>
                </Paper>

                <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
                    <Typography variant="h6" sx={{ mb: 1 }}>
                        Storage
                    </Typography>
                    <List disablePadding>
                        <ListItem
                            sx={{ px: 0 }}
                            secondaryAction={(
                                <Box sx={{ width: '50%' }}>
                                    <Slider
                                        value={settings?.cleanupThreshold ?? 500}
                                        min={STORAGE_LIMITS.CLEANUP_THRESHOLD.min}
                                        max={STORAGE_LIMITS.CLEANUP_THRESHOLD.max}
                                        step={100}
                                        onChange={(_, value) => {
                                            if (typeof value === 'number') {
                                                void handleSettingChange('cleanupThreshold', value);
                                            }
                                        }}
                                    />
                                </Box>
                            )}
                        >
                            <ListItemText
                                primary="Cleanup Threshold (MB)"
                                secondary={`Clean up when storage exceeds ${formatBytes(
                                    (settings?.cleanupThreshold ?? 500) * 1024 * 1024
                                )}`}
                            />
                        </ListItem>
                    </List>
                </Paper>

                <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
                    <Typography variant="h6">Security Scanner</Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                        Configure built-in secret detectors and manage your custom regex rules.
                    </Typography>

                    <Divider sx={{ my: 2 }} />

                    <Typography variant="subtitle1" sx={{ mb: 1 }}>
                        Built-in Rules
                    </Typography>
                    <List disablePadding>
                        {builtInRules.map((rule) => (
                            <ListItem
                                key={rule.id}
                                sx={{ px: 0, py: 1 }}
                                secondaryAction={(
                                    <Switch
                                        edge="end"
                                        checked={rule.isEnabled}
                                        disabled={rulesUpdating}
                                        onChange={(_, isEnabled) => {
                                            void handleBuiltInRuleToggle(rule.id, isEnabled);
                                        }}
                                    />
                                )}
                            >
                                <ListItemText
                                    primary={rule.name}
                                    secondary={rule.description ?? rule.pattern}
                                />
                            </ListItem>
                        ))}
                    </List>

                    <Divider sx={{ my: 2 }} />

                    <Typography variant="subtitle1" sx={{ mb: 1 }}>
                        Custom Regex Rules
                    </Typography>
                    <Stack spacing={2}>
                        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                            <TextField
                                label="Rule Name"
                                size="small"
                                value={customRuleName}
                                onChange={(event) => setCustomRuleName(event.target.value)}
                                fullWidth
                            />
                            <TextField
                                label="Regex Pattern"
                                size="small"
                                value={customRulePattern}
                                onChange={(event) => setCustomRulePattern(event.target.value)}
                                fullWidth
                                required
                            />
                            <TextField
                                label="Flags (optional)"
                                size="small"
                                value={customRuleFlags}
                                onChange={(event) => setCustomRuleFlags(event.target.value)}
                                sx={{ minWidth: 180 }}
                            />
                            <Button
                                variant="contained"
                                startIcon={<AddIcon />}
                                disabled={rulesUpdating || customRulePattern.trim().length === 0}
                                onClick={() => {
                                    void handleAddCustomRule();
                                }}
                                sx={{ whiteSpace: 'nowrap' }}
                            >
                                Add Rule
                            </Button>
                        </Stack>

                        {userRules.length === 0 ? (
                            <Typography variant="body2" color="text.secondary">
                                No custom rules added yet.
                            </Typography>
                        ) : (
                            <List disablePadding>
                                {userRules.map((rule) => (
                                    <ListItem
                                        key={rule.id}
                                        sx={{ px: 0, py: 1 }}
                                        secondaryAction={(
                                            <Box display="flex" alignItems="center" gap={1}>
                                                <Switch
                                                    edge="end"
                                                    checked={rule.isEnabled}
                                                    disabled={rulesUpdating}
                                                    onChange={(_, isEnabled) => {
                                                        void handleUserRuleToggle(rule.id, isEnabled);
                                                    }}
                                                />
                                                <Button
                                                    color="error"
                                                    size="small"
                                                    startIcon={<DeleteIcon />}
                                                    disabled={rulesUpdating}
                                                    onClick={() => {
                                                        void handleDeleteCustomRule(rule.id);
                                                    }}
                                                >
                                                    Delete
                                                </Button>
                                            </Box>
                                        )}
                                    >
                                        <ListItemText
                                            primary={rule.name}
                                            secondary={`/${rule.pattern}/${rule.flags ?? ''}`}
                                        />
                                    </ListItem>
                                ))}
                            </List>
                        )}
                    </Stack>
                </Paper>

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
                    <Button
                        onClick={() => {
                            void handleClearData();
                        }}
                        color="error"
                    >
                        Clear
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
}
