import axios from 'axios';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000, // 10秒でタイムアウト
  withCredentials: true, // httpOnly Cookieの送信を有効化
});

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    // メモリ内のaccess_tokenを認証ストアから取得
    // useAuthStoreをdynamic importで取得（SSRエラー回避）
    if (typeof window !== 'undefined') {
      try {
        // Zustandストアから直接取得
        const authState = (window as any).authStore?.getState?.();
        const token = authState?.accessToken;
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
      } catch (error) {
        // ストアが初期化されていない場合はスキップ
        console.debug('Auth store not yet initialized');
      }
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle unauthorized requests and token refresh
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401 && typeof window !== 'undefined') {
      const originalRequest = error.config as any;
      // refresh自体の401はスキップ
      if (originalRequest?.url?.includes('/auth/refresh')) {
        return Promise.reject(error);
      }

      // 同一リクエストの多重リトライを抑止
      if (originalRequest?._retry) {
        return Promise.reject(error);
      }
      originalRequest._retry = true;

      try {
        // 認証ストアのrefreshAccessTokenを呼び出し（Cookieベース）
        const authState = (window as any).authStore?.getState?.();
        if (authState?.refreshAccessToken) {
          await authState.refreshAccessToken();
          // トークン更新成功、元のリクエストを再実行
          return api.request(originalRequest);
        }
      } catch (refreshError) {
        // リフレッシュ失敗、ログイン画面へリダイレクト
        console.error('Token refresh failed:', refreshError);
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default api;