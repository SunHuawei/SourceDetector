import { createTheme } from '@mui/material/styles';
import { useEffect, useState } from 'react';
import { MESSAGE_TYPES } from '@/background/constants';

export function useAppTheme() {
    const [darkMode, setDarkMode] = useState(false);

    useEffect(() => {
        // Load theme setting
        chrome.runtime.sendMessage({
            type: MESSAGE_TYPES.GET_SETTINGS
        }).then(response => {
            if (response.success) {
                setDarkMode(response.data.darkMode);
            }
        });
    }, []);

    return createTheme({
        palette: {
            mode: darkMode ? 'dark' : 'light',
            primary: {
                main: '#1976d2',
            },
            secondary: {
                main: '#dc004e',
            },
        },
        components: {
            MuiButton: {
                styleOverrides: {
                    root: {
                        textTransform: 'none',
                    },
                },
            },
            MuiAppBar: {
                styleOverrides: {
                    root: {
                        boxShadow: 'none',
                        borderBottom: '1px solid rgba(0, 0, 0, 0.12)',
                    },
                },
            },
        },
    });
} 