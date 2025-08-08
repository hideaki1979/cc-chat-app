'use client';

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { api } from '../lib/api';
import type {
  AuthStore,
  LoginCredentials,
  RegisterCredentials,
  AuthResponse
} from '../types/auth';

export const useAuthStore = create<AuthStore>()(
  devtools(
    // persist機能を削除してメモリ内のみに変更（セキュリティ向上）
    (set, get) => ({
      // State（メモリ内のみ保存）
      user: null,
      accessToken: null,
      // refreshToken削除（httpOnly Cookieで管理）
      isLoading: false,
      error: null,

      // Actions
      setLoading: (loading: boolean) => {
        set({ isLoading: loading });
      },

      setError: (error: string | null) => {
        set({ error });
      },

      clearError: () => {
        set({ error: null });
      },

      login: async (credentials: LoginCredentials) => {
        const { setLoading, setError } = get();

        try {
          setLoading(true);
          setError(null);

          const response = await api.post<AuthResponse>('/auth/login', credentials);
          const { user, token: accessToken } = response.data;
          // refresh_tokenはhttpOnly Cookieでバックエンドが自動設定

          // access_tokenはメモリ内のみ保存（セキュリティ向上）
          set({
            user,
            accessToken,
            isLoading: false,
            error: null,
          });
        } catch (error: unknown) {
          const errorMessage = error instanceof Error
            ? error.message
            : (error as { response?: { data?: { message?: string } } })?.response?.data?.message || 'ログインに失敗しました';
          set({
            isLoading: false,
            error: errorMessage,
            user: null,
            accessToken: null,
          });
          // Cookieは自動的にクリアされる（バックエンドのエラー処理で）
          throw error;
        }
      },

      register: async (credentials: RegisterCredentials) => {
        const { setLoading, setError } = get();

        try {
          setLoading(true);
          setError(null);

          const response = await api.post<AuthResponse>('/auth/register', {
            name: credentials.username,  // usernameをnameに変換
            email: credentials.email,
            password: credentials.password
          });
          const { user, token: accessToken } = response.data;
          // refresh_tokenはhttpOnly Cookieでバックエンドが自動設定

          // access_tokenはメモリ内のみ保存（セキュリティ向上）
          set({
            user,
            accessToken,
            isLoading: false,
            error: null,
          });
        } catch (error: unknown) {
          const errorMessage = error instanceof Error
            ? error.message
            : (error as { response?: { data?: { message?: string } } })?.response?.data?.message || '登録に失敗しました';
          set({
            isLoading: false,
            error: errorMessage,
            user: null,
            accessToken: null,
          });
          // Cookieは自動的にクリアされる（バックエンドのエラー処理で）
          throw error;
        }
      },

      logout: async () => {
        try {
          // バックエンドのlogoutエンドポイントを呼び出してCookieをクリア
          await api.post('/auth/logout');
        } catch (error) {
          // ログアウトAPIが失敗してもクライアントステートはクリア
          console.error('Logout API failed:', error);
        }

        // メモリ内のaccess_tokenをクリア
        set({
          user: null,
          accessToken: null,
          isLoading: false,
          error: null,
        });
      },

      refreshAccessToken: async () => {
        try {
          // Cookieからrefresh_tokenを自動送信してアクセストークンを更新
          const response = await api.post<{ token: string }>('/auth/refresh');
          const { token: accessToken } = response.data;
          // 新しいrefresh_tokenもhttpOnly Cookieで自動設定済み

          // 新しいaccess_tokenをメモリに保存
          set({ accessToken });
        } catch (error) {
          // Refresh failed, logout user
          const state = get();
          state.logout();
          throw error;
        }
      },
    }),
    {
      name: 'auth-store',
    }
  )
);

// axiosインターセプターからアクセスできるようにwindowオブジェクトに登録
if (typeof window !== 'undefined') {
  window.authStore = useAuthStore;
}