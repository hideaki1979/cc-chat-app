'use client';

import { useEffect, useState } from 'react';

type Breakpoint = 'sm' | 'md' | 'lg' | 'xl' | '2xl';

interface ResponsiveBreakpoints {
  sm: boolean;   // >= 640px
  md: boolean;   // >= 768px
  lg: boolean;   // >= 1024px
  xl: boolean;   // >= 1280px
  '2xl': boolean; // >= 1536px
}

const breakpoints = {
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  '2xl': 1536,
};

export function useResponsive() {
  const [screenSize, setScreenSize] = useState<ResponsiveBreakpoints>({
    sm: false,
    md: false,
    lg: false,
    xl: false,
    '2xl': false,
  });

  useEffect(() => {
    const checkBreakpoints = () => {
      const width = window.innerWidth;
      setScreenSize({
        sm: width >= breakpoints.sm,
        md: width >= breakpoints.md,
        lg: width >= breakpoints.lg,
        xl: width >= breakpoints.xl,
        '2xl': width >= breakpoints['2xl'],
      });
    };

    // 初期チェック
    checkBreakpoints();

    // リサイズイベントリスナー
    window.addEventListener('resize', checkBreakpoints);
    return () => window.removeEventListener('resize', checkBreakpoints);
  }, []);

  // 特定のブレークポイント以上かチェック
  const isAbove = (breakpoint: Breakpoint) => screenSize[breakpoint];

  // 特定のブレークポイント以下かチェック
  const isBelow = (breakpoint: Breakpoint) => !screenSize[breakpoint];

  // モバイルデバイスかどうか
  const isMobile = !screenSize.md;

  // タブレットデバイスかどうか
  const isTablet = screenSize.md && !screenSize.lg;

  // デスクトップデバイスかどうか
  const isDesktop = screenSize.lg;

  return {
    ...screenSize,
    isAbove,
    isBelow,
    isMobile,
    isTablet,
    isDesktop,
  };
}