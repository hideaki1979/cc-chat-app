'use client';

import { useEffect } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { useAuthStore } from '../stores/auth';
import path from 'path';

/**
 * 認証状態管理のカスタムフック
 * - 認証状態の初期化
 * - ページリロード時の認証状態復元
 * - 未認証時のリダイレクト処理
 */
export function useAuth() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const searchParamsString = searchParams.toString();
  const currentPathWithQuery = searchParamsString
    ? `${pathname}?${searchParamsString}`
    : pathname;

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
        currentPath: currentPathWithQuery,
        onUnauthorized: (currentPath) => {
          // 認証が必要なページで未認証の場合はログインページにリダイレクト
          router.replace(`/login?redirect=${encodeURIComponent(currentPath)}`);
        },
      });
    }
  }, [isInitialized, currentPathWithQuery, initializeAuth, router]);

  return {
    user,
    isLoading,
    isInitialized,
    error,
    isAuthenticated: !!user,
  };
}