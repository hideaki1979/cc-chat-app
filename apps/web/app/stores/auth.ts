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
import { LOGIN_PAGE_PATH, REGISTER_PAGE_PATH } from '../constants/constants';

// 同一タブ内でのrefresh多重実行を防止するシンプルなsingleflightロック
let refreshPromise: Promise<void> | null = null;

export const useAuthStore = create<AuthStore>()(
  devtools(
    // persist機能を削除してメモリ内のみに変更（セキュリティ向上）
    (set, get) => ({
      // State（メモリ内のみ保存）
      user: null,
      accessToken: null,
      // refreshToken削除（httpOnly Cookieで管理）
      isLoading: false,  // 初期状態はローディングなし
      isInitialized: false,  // 初期化完了フラグ
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
          set({ user, accessToken, isLoading: false, error: null, isInitialized: true });
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
          set({ user, accessToken, isLoading: false, error: null, isInitialized: true });
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
          isInitialized: true,  // ログアウト後も初期化済み状態
          error: null,
        });
      },

      refreshAccessToken: async (onUnauthorized?: (currentPath: string) => void, currentPath?: string) => {
        try {
          // 既に実行中ならそれを待つ
          if (refreshPromise) {
            await refreshPromise;
            return;
          }

          refreshPromise = (async () => {
            // Next.js Route Handler 経由でバックエンドへ
            const response = await fetch('/api/backend/refresh', { method: 'POST', credentials: 'include' });
            if (!response.ok) {
              // 401 の場合は即ログアウトし、外部にリダイレクト処理を委譲
              if (response.status === 401) {
                try {
                  const { logout } = get();
                  await logout();
                } finally {
                  // リダイレクト処理を外部に委譲（Next.jsルーターを使用するため）
                  if (onUnauthorized) {
                    const pathToUse = currentPath || '/';
                    onUnauthorized(pathToUse);
                  }
                }
              }
              throw new Error(`Failed to refresh token: ${response.status}`);
            }
            const data = await response.json();
            const { token: accessToken } = data as { token: string };
            set({ accessToken });
          })();

          await refreshPromise;
        } catch (error) {
          // リフレッシュ失敗時はログアウト状態にする（ログアウトAPIは呼ばない）
          set({
            user: null,
            accessToken: null,
            isLoading: false,
            error: null,
          });
          throw error;
        } finally {
          refreshPromise = null;
        }
      },

      _fetchUserProfileAfterRefresh: async (currentPath?: string, onUnauthorized?: (currentPath: string) => void): Promise<User> => {
        const { refreshAccessToken } = get();
        await refreshAccessToken(currentPath, onUnauthorized);

        const { accessToken } = get();
        if (!accessToken) {
          throw new Error('認証セッションが確立できませんでした');
        }

        const headers: HeadersInit = { Authorization: `Bearer ${accessToken}` };
        const res = await fetch('/api/backend/profile', {
          headers,
          credentials: 'include'
        });
        if (!res.ok) {
          throw new Error(`プロファイルの取得に失敗しました：${res.status}`);
        }
        return (await res.json()) as User;
      },

      // 手動でのユーザー情報再取得（AuthInitがrefreshを担当する前提で、プロフィール取得のみ）
      loadCurrentUser: async () => {
        const { setLoading } = get();
        try {
          setLoading(true);

          const { accessToken } = get();
          if (!accessToken) {
            set({ isLoading: false, isInitialized: true });
            throw new Error('Access token is not available');
          }

          const headers: HeadersInit = { Authorization: `Bearer ${accessToken}` };
          const res = await fetch('/api/backend/profile', {
            headers,
            credentials: 'include',
          });
          if (!res.ok) {
            throw new Error(`プロファイルの取得に失敗しました：${res.status}`);
          }
          const user = (await res.json()) as User;
          set({ user, isLoading: false, error: null, isInitialized: true });
        } catch (error) {
          console.error('Load current user failed:', error);
          set({ isLoading: false, isInitialized: true });
          throw error;
        }
      },

      // 初期化関数（カスタムフック側で明示的に呼び出す）
      initializeAuth: async (currentPath?: string, onUnauthorized?: (currentPath: string) => void) => {
        const state = get();
        if (state.isInitialized) return; // 既に初期化済みなら何もしない

        // パス情報を外部から受け取る（Next.jsのusePathnameを使用するため）
        const path = currentPath || '';

        // ゲストページ（/login, /register）では自動リフレッシュを行わず初期化のみ行う
        const guestOnly = [LOGIN_PAGE_PATH, REGISTER_PAGE_PATH];
        if (guestOnly.some((p) => path.startsWith(p))) {
          set({ isInitialized: true, isLoading: false, error: null });
          return;
        }

        // localStorage からの認証状態の復元は廃止（XSS耐性強化のため）

        try {
          set({ isLoading: true });

          // onUnauthorizedコールバックを_fetchUserProfileAfterRefreshに渡す
          const user = await get()._fetchUserProfileAfterRefresh(currentPath, onUnauthorized);
          set({ user, isInitialized: true, isLoading: false, error: null });
        } catch {
          set({
            user: null,
            accessToken: null,
            isInitialized: true,
            isLoading: false,
            error: null
          });
        }
      },
    }),
    {
      name: 'auth-store',
    }
  )
);

