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
import { PUBLIC_PAGES } from '../constants/constants';
import { http } from '../lib/http';

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
          const { user } = (await res.json()) as AuthResponse;
          // accessTokenはCookieで管理されるためストアに保存不要
          set({ user, accessToken: null, isLoading: false, error: null, isInitialized: true });
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
          const { user } = (await res.json()) as AuthResponse;
          // accessTokenはCookieで管理されるためストアに保存不要
          set({ user, accessToken: null, isLoading: false, error: null, isInitialized: true });
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

      refreshAccessToken: async (options: { currentPath?: string; onUnauthorized?: (currentPath: string) => void } = {}) => {
        try {
          // 既に実行中ならそれを待つ（同一タブ内での多重実行を防止）
          // これにより、複数の API コールが同時にリフレッシュを試行することを防ぐ
          if (refreshPromise) {
            await refreshPromise;
            return;
          }

          refreshPromise = (async () => {
            // 共通HTTPユーティリティ経由でCSRF付与
            // プロキシを経由することで、Cookie のドメイン問題を回避
            const res = await http.post('/api/backend/refresh');
            if (!res.ok) {
              // 401/403 の場合は即座にログアウトし、必要に応じてリダイレクト
              // これにより、セッション切れ時のUX向上を図る
              if (res.status === 401 || res.status === 403) {
                try {
                  const { logout } = get();
                  await logout();
                } finally {
                  // ログアウト後のリダイレクト処理をコールバックに委譲
                  // カスタムフックで適切なルーティング処理を実行
                  if (options.onUnauthorized) {
                    const pathToUse = options.currentPath || '/';
                    options.onUnauthorized(pathToUse);
                  }
                }
              }
              throw new Error(`Failed to refresh token: ${res.status}`);
            }
            // レスポンスの解析（エラー無視で安全に処理）
            await res.json().catch(() => ({}));
          })();

          await refreshPromise;
        } catch (error) {
          // リフレッシュ失敗時はログアウト状態にする
          // ただし、明示的なログアウトAPIは呼ばない（既に認証切れのため）
          set({
            user: null,
            accessToken: null,
            isLoading: false,
            error: null,
          });
          throw error;
        } finally {
          // 完了後は Promise をクリアし、次回実行を可能にする
          refreshPromise = null;
        }
      },

      _fetchUserProfileAfterRefresh: async (options: { currentPath?: string; onUnauthorized?: (currentPath: string) => void } = {}): Promise<User> => {
        const { refreshAccessToken } = get();
        // まずトークンのリフレッシュを実行（認証状態を最新に更新）
        await refreshAccessToken(options);

        // accessTokenはCookieで管理されるためAuthorizationヘッダ付与不要
        // credentials: 'include' でhttpOnlyクッキーを自動送信
        const res = await fetch('/api/backend/profile', {
          credentials: 'include'
        });
        if (!res.ok) {
          throw new Error(`プロファイルの取得に失敗しました：${res.status}`);
        }
        return (await res.json()) as User;
      },

      // 手動でのユーザー情報再取得（トークンリフレッシュ付き）
      loadCurrentUser: async () => {
        const { setLoading } = get();
        try {
          setLoading(true);

          // accessTokenはストアで管理しないため、直接リフレッシュを試行
          try {
            await get().refreshAccessToken();
          } catch (error) {
            // リフレッシュ失敗時はログアウト状態にする（バックエンド接続失敗も含む）
            console.warn('Token refresh failed, redirecting to login:', error);
            set({
              user: null,
              accessToken: null,
              isLoading: false,
              isInitialized: true,
              error: null
            });
            // ネットワークエラーと認証エラーを区別してメッセージを分岐
            const isConnectionError = error instanceof Error && error.message.includes('fetch failed');
            const errorMessage = isConnectionError
              ? 'サーバーに接続できません。しばらくしてから再度お試しください。'
              : '認証の有効期限が切れています。再度ログインしてください。';
            throw new Error(errorMessage);
          }

          // accessTokenはCookieで管理されるためAuthorizationヘッダ付与不要
          // credentials: 'include' でhttpOnlyクッキーを自動送信
          const res = await fetch('/api/backend/profile', {
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
      initializeAuth: async (options: { currentPath?: string; onUnauthorized?: (currentPath: string) => void } = {}) => {
        const state = get();
        // 初期化の重複実行を防ぐ（パフォーマンス最適化）
        if (state.isInitialized) return; // 既に初期化済みなら何もしない

        const path = options.currentPath || '';
        // パブリックページの判定（ログイン、登録ページなど）
        const isPublicPage = PUBLIC_PAGES.some((p) => path.startsWith(p));

        // パブリックページでは認証チェックをスキップ
        if (isPublicPage) {
          set({ isInitialized: true, isLoading: false, error: null });
          return;
        }

        try {
          set({ isLoading: true });

          // プライベートページでは認証が必要なため、プロファイル取得を試行
          // この過程でトークンリフレッシュも自動実行される
          const user = await get()._fetchUserProfileAfterRefresh(options);
          set({ user, isInitialized: true, isLoading: false, error: null });
        } catch (error) {
          console.warn('Auth initialization failed:', error);
          // 認証失敗時はログアウト状態にセット
          // エラーは表示せず、ログアウト状態でページを表示
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

