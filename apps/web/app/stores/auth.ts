'use client';

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
// import { api } from '../lib/api';
import type {
  AuthStore,
  LoginCredentials,
  RegisterCredentials,
  AuthResponse
} from '../types/auth';
// import { isAxiosError } from 'axios';
import type { User } from '../types/auth';

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

      // ユーザー情報を直接設定（初期化や再取得時に使用）
      setUser: (user: User | null) => {
        set({ user });
      },

      login: async (credentials: LoginCredentials) => {
        const { setLoading, setError } = get();

        try {
          setLoading(true);
          setError(null);

          const res = await fetch('/api/backend/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(credentials),
            credentials: 'include',
          });
          if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            const errorMessage = (data && data.message) || 'メールアドレスまたはパスワードに誤りがあります';
            set({ isLoading: false, error: errorMessage, user: null, accessToken: null });
            return false;
          }
          const { user, token: accessToken } = (await res.json()) as AuthResponse;
          set({ user, accessToken, isLoading: false, error: null });
          return true;
        } catch (error: unknown) {
          const errorMessage = error instanceof Error ? error.message : 'ログインに失敗しました';
          set({ isLoading: false, error: errorMessage, user: null, accessToken: null });
          return false;
        }
      },

      register: async (credentials: RegisterCredentials) => {
        const { setLoading, setError } = get();

        try {
          setLoading(true);
          setError(null);

          const res = await fetch('/api/backend/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name: credentials.username,
              email: credentials.email,
              password: credentials.password,
            }),
            credentials: 'include',
          });
          if (!res.ok) {
            const data = await res.json().catch(() => ({} as { message?: string; code?: string }));
            const errorMessage = (data && data.message) || '登録に失敗しました';
            set({ isLoading: false, error: errorMessage, user: null, accessToken: null });
            return { ok: false as const, status: res.status, code: data?.code };
          }
          const { user, token: accessToken } = (await res.json()) as AuthResponse;
          set({ user, accessToken, isLoading: false, error: null });
          return { ok: true as const };
        } catch (error: unknown) {
          const errorMessage = error instanceof Error ? error.message : '登録に失敗しました';
          set({ isLoading: false, error: errorMessage, user: null, accessToken: null });
          return { ok: false as const };
        }
      },

      logout: async () => {
        try {
          // バックエンドのlogoutエンドポイントを呼び出してCookieをクリア
          await fetch('/api/backend/logout', { method: 'POST', credentials: 'include' });
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
          // Next.js Route Handler 経由でバックエンドへ
          const response = await fetch('/api/backend/refresh', { method: 'POST', credentials: 'include' });
          if (!response.ok) throw new Error('Failed to refresh token');
          const data = await response.json();
          const { token: accessToken } = data as { token: string };
          set({ accessToken });
        } catch (error) {
          const state = get();
          state.logout();
          throw error;
        }
      },

      // 初期化用: リロード時に現在ユーザーを取得（リトライしない）
      loadCurrentUser: async () => {
        const { setLoading } = get();
        try {
          setLoading(true);
          const authState = get();
          // アクセストークンが無い場合はサーバーに問い合わせず未ログイン扱いにする
          if (!authState.accessToken) {
            set({ user: null, isLoading: false });
            return;
          }
          const headers: HeadersInit = authState.accessToken
            ? { Authorization: `Bearer ${authState.accessToken}` }
            : {} as Record<string, string>;
          const res = await fetch('/api/backend/profile', { headers, credentials: 'include' });
          if (!res.ok) {
            set({ user: null, isLoading: false });
            return;
          }
          const user = await res.json() as User;
          set({ user, isLoading: false, error: null });
        } catch (error) {
          set({ isLoading: false });
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