'use client';

import { useEffect, useState } from 'react';
import { ThemeCookieManager } from '../../../lib/theme-cookies';

type Theme = 'light' | 'dark' | 'system';

export function useTheme() {
  const [theme, setTheme] = useState<Theme>('system');
  const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark'>('light');

  // 初期化: Cookieからテーマ復元（マウント時1回のみ）
  useEffect(() => {
    const savedTheme = ThemeCookieManager.getTheme();
    if (savedTheme) {
      setTheme(savedTheme);
    }
  }, []);

  // テーマ適用とシステムテーマ監視
  useEffect(() => {
    const root = window.document.documentElement;
    
    const applyTheme = (newTheme: 'light' | 'dark') => {
      root.classList.remove('light', 'dark');
      root.classList.add(newTheme);
      setResolvedTheme(newTheme);
    };

    if (theme === 'system') {
      // システムテーマを取得して適用
      const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      applyTheme(systemTheme);

      // システムテーマ変更の監視
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const handleSystemThemeChange = () => {
        if (theme === 'system') { // 現在もsystemモードの場合のみ適用
          const newSystemTheme = mediaQuery.matches ? 'dark' : 'light';
          applyTheme(newSystemTheme);
        }
      };

      mediaQuery.addEventListener('change', handleSystemThemeChange);
      return () => mediaQuery.removeEventListener('change', handleSystemThemeChange);
    } else {
      // 明示的なテーマ（light/dark）を適用
      applyTheme(theme);
    }
  }, [theme]);

  const toggleTheme = () => {
    const newTheme = resolvedTheme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    ThemeCookieManager.setTheme(newTheme);
  };

  const setThemeMode = (newTheme: Theme) => {
    setTheme(newTheme);
    ThemeCookieManager.setTheme(newTheme);
  };

  return {
    theme,
    resolvedTheme,
    toggleTheme,
    setTheme: setThemeMode,
  };
}