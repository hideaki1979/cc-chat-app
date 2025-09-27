'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuthStore } from '../stores/auth';

/**
 * 認証状態管理のカスタムフック
 * - 認証状態の初期化
 * - ページリロード時の認証状態復元
 * - 未認証時のリダイレクト処理
 */
export function useAuth() {
  const router = useRouter();
  const pathname = usePathname();

  const {
    user,
    isLoading,
    isInitialized,
    error,
    initializeAuth,
  } = useAuthStore();

  useEffect(() => {
    if (!isInitialized) {
      initializeAuth({
        currentPath: pathname,
        onUnauthorized: (currentPath) => {
          // 認証が必要なページで未認証の場合はログインページにリダイレクト
          router.replace(`/login?redirect=${encodeURIComponent(currentPath)}`);
        },
      });
    }
  }, [isInitialized, pathname, initializeAuth, router]);

  return {
    user,
    isLoading,
    isInitialized,
    error,
    isAuthenticated: !!user,
  };
}