import React from 'react';
import { Snackbar, Box, Typography } from '@mui/material';
import {
    CheckCircle as SuccessIcon,
    Error as ErrorIcon,
    Info as InfoIcon,
    Warning as WarningIcon
} from '@mui/icons-material';

type ToastSeverity = 'success' | 'error' | 'info' | 'warning';

interface ToastProps {
    open: boolean;
    message: string;
    severity?: ToastSeverity;
    onClose: () => void;
    autoHideDuration?: number;
}

const severityColors: Record<ToastSeverity, string> = {
    success: '#4caf50',
    error: '#f44336',
    info: '#2196f3',
    warning: '#ff9800'
};

const severityIcons: Record<ToastSeverity, React.ReactNode> = {
    success: <SuccessIcon fontSize="small" />,
    error: <ErrorIcon fontSize="small" />,
    info: <InfoIcon fontSize="small" />,
    warning: <WarningIcon fontSize="small" />
};

export function Toast({
    open,
    message,
    severity = 'info',
    onClose,
    autoHideDuration = 2000
}: ToastProps) {
    return (
        <Snackbar
            open={open}
            autoHideDuration={autoHideDuration}
            onClose={onClose}
            anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
            sx={{ maxWidth: '300px', top: '100px' }}
        >
            <Box
                sx={{
                    backgroundColor: severityColors[severity],
                    color: '#fff',
                    padding: '6px 16px',
                    borderRadius: 1,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1,
                    boxShadow: 2,
                    '&:hover': {
                        opacity: 0.9
                    }
                }}
            >
                {severityIcons[severity]}
                <Typography variant="body2">
                    {message}
                </Typography>
            </Box>
        </Snackbar>
    );
} 