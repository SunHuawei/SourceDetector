import { createTheme } from '@mui/material/styles';
import { useEffect, useMemo, useState } from 'react';
import { MESSAGE_TYPES } from '@/background/constants';
import type { ThemePreference } from '@/types';
import { trackEvent } from '@/utils/analytics';

function resolvePaletteMode(preference: ThemePreference, systemPrefersDark: boolean) {
  if (preference === 'dark') return 'dark';
  if (preference === 'light') return 'light';
  return systemPrefersDark ? 'dark' : 'light';
}

type ThemeAnalyticsSurface = 'popup' | 'settings' | 'source_explorer' | 'unknown';
const lastThemeSignatureBySurface = new Map<ThemeAnalyticsSurface, string>();

function resolveThemeAnalyticsSurface(): ThemeAnalyticsSurface {
  if (typeof window === 'undefined') {
    return 'unknown';
  }

  const pathname = window.location.pathname;
  if (pathname.includes('/popup/')) {
    return 'popup';
  }
  if (pathname.includes('/settings/')) {
    return 'settings';
  }
  if (pathname.includes('/desktop/')) {
    return 'source_explorer';
  }
  return 'unknown';
}

export function useAppTheme(surface: ThemeAnalyticsSurface = resolveThemeAnalyticsSurface()) {
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

  const paletteMode = useMemo(
    () => resolvePaletteMode(themePreference, systemPrefersDark),
    [themePreference, systemPrefersDark]
  );

  useEffect(() => {
    const signature = `${themePreference}:${paletteMode}:${systemPrefersDark ? '1' : '0'}`;
    if (lastThemeSignatureBySurface.get(surface) === signature) {
      return;
    }
    lastThemeSignatureBySurface.set(surface, signature);

    void trackEvent('theme_applied', {
      surface,
      theme_preference: themePreference,
      theme_mode: paletteMode,
      system_prefers_dark: systemPrefersDark,
    });
  }, [paletteMode, surface, systemPrefersDark, themePreference]);

  return useMemo(
    () =>
      createTheme({
        palette: {
          mode: paletteMode,
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
    [paletteMode]
  );
}
