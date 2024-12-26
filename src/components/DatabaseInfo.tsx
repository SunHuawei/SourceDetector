import { useState, useEffect } from 'react';
import { Box, Typography, Paper, Tooltip, IconButton } from '@mui/material';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';

export function DatabaseInfo() {
    const [dbPath, setDbPath] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        async function fetchDbPath() {
            try {
                const result = await window.database.getPath();
                if (result.success) {
                    setDbPath(result.data);
                }
            } catch (error) {
                console.error('Failed to fetch database path:', error);
            }
        }

        fetchDbPath();
    }, []);

    const handleCopy = () => {
        if (dbPath) {
            navigator.clipboard.writeText(dbPath);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    if (!dbPath) return null;

    return (
        <Paper sx={{ p: 2, mb: 2 }}>
            <Box display="flex" alignItems="center" gap={1}>
                <Typography variant="body2" color="text.secondary" sx={{ flexGrow: 1 }}>
                    Database Location: {dbPath}
                </Typography>
                <Tooltip title={copied ? 'Copied!' : 'Copy path'}>
                    <IconButton onClick={handleCopy} size="small">
                        <ContentCopyIcon fontSize="small" />
                    </IconButton>
                </Tooltip>
            </Box>
        </Paper>
    );
} 