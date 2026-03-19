import { createTheme } from '@mui/material/styles';
import { useEffect, useMemo, useState } from 'react';
import { MESSAGE_TYPES } from '@/background/constants';
import type { ThemePreference } from '@/types';

function resolvePaletteMode(preference: ThemePreference, systemPrefersDark: boolean) {
  if (preference === 'dark') return 'dark';
  if (preference === 'light') return 'light';
  return systemPrefersDark ? 'dark' : 'light';
}

export function useAppTheme() {
  const [themePreference, setThemePreference] = useState<ThemePreference>('system');
  const [systemPrefersDark, setSystemPrefersDark] = useState(() =>
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia('(prefers-color-scheme: dark)').matches
      : false
  );

  useEffect(() => {
    chrome.runtime
      .sendMessage({
        type: MESSAGE_TYPES.GET_SETTINGS,
      })
      .then(response => {
        if (response.success && response.data?.themePreference) {
          setThemePreference(response.data.themePreference);
        }
      })
      .catch(error => {
        console.error('Error loading theme setting:', error);
      });
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return;
    }

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (event: MediaQueryListEvent) => {
      setSystemPrefersDark(event.matches);
    };

    setSystemPrefersDark(mediaQuery.matches);
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  return useMemo(
    () =>
      createTheme({
        palette: {
          mode: resolvePaletteMode(themePreference, systemPrefersDark),
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
      }),
    [themePreference, systemPrefersDark]
  );
}
