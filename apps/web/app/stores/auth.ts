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

      refreshAccessToken: async () => {
        try {
          // Next.js Route Handler 経由でバックエンドへ
          const response = await fetch('/api/backend/refresh', { method: 'POST', credentials: 'include' });
          if (!response.ok) {
            throw new Error(`Failed to refresh token: ${response.status}`);
          }
          const data = await response.json();
          const { token: accessToken } = data as { token: string };
          set({ accessToken });
        } catch (error) {
          console.log('リフレッシュトークンが無効です');
          // リフレッシュ失敗時はログアウト状態にする（ログアウトAPIは呼ばない）
          set({
            user: null,
            accessToken: null,
            isLoading: false,
            error: null,
          });
          throw error;
        }
      },

      // 手動でのユーザー情報再取得（リトライ機能付き）
      loadCurrentUser: async () => {
        const { setLoading, refreshAccessToken } = get();
        try {
          setLoading(true);
          
          // セッションを確立するために、まずトークンをリフレッシュする
          await refreshAccessToken();

          // ストアから最新のアクセストークンを取得
          const { accessToken } = get();

          // トークンがなければ認証されていない
          if (!accessToken) {
            throw new Error("セッションを確立出来ませんでした");
          }

          // プロファイル情報を取得
          const headers: HeadersInit = { Authorization: `Bearer ${accessToken}` };
          const res = await fetch('/api/backend/profile', { headers, credentials: 'include' });
          if (!res.ok) {
            throw new Error(`プロファイルの取得に失敗しました: ${res.status}`);
          }
          const user = await res.json() as User;
          set({ user, isLoading: false, error: null, isInitialized: true });
        } catch (error) {
          console.error('Load current user failed:', error);
          // エラー時はローディング状態を解除（ユーザーとトークンはrefreshAccessTokenでクリア済み）
          set({ isLoading: false, isInitialized: true });
          // エラーを再スローして呼び出し元で適切に処理できるようにする
          throw error;
        }
      },

      // 初期化関数（カスタムフック側で明示的に呼び出す）
      initializeAuth: async () => {
        const state = get();
        if (state.isInitialized) return; // 既に初期化済みなら何もしない

        try {
          console.log('認証状態を初期化中...');
          set({ isLoading: true });
          
          const { refreshAccessToken } = get();
          await refreshAccessToken();
          
          const { accessToken } = get();
          if (!accessToken) {
            throw new Error("認証セッションが確立できませんでした");
          }

          const headers: HeadersInit = { Authorization: `Bearer ${accessToken}` };
          const res = await fetch('/api/backend/profile', { headers, credentials: 'include' });
          if (!res.ok) {
            throw new Error(`プロファイルの取得に失敗しました: ${res.status}`);
          }
          const user = await res.json() as User;
          console.log('認証状態の初期化完了:', user);
          set({ user, isInitialized: true, isLoading: false, error: null });
        } catch (error) {
          console.log('初期化時の認証確認: ログイン状態ではありません', error);
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

// axiosインターセプターからアクセスできるようにwindowオブジェクトに登録
if (typeof window !== 'undefined') {
  window.authStore = useAuthStore;
}