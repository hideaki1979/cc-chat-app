import axios from 'axios';
import type { AxiosError, InternalAxiosRequestConfig } from 'axios';
import type { UseBoundStore, StoreApi } from 'zustand';
import type { AuthStore } from '../types/auth';

declare global {
  interface Window {
    authStore?: UseBoundStore<StoreApi<AuthStore>>;
  }
}

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
  (config: InternalAxiosRequestConfig) => {
    // メモリ内のaccess_tokenを認証ストアから取得
    // useAuthStoreをdynamic importで取得（SSRエラー回避）
    if (typeof window !== 'undefined') {
      try {
        // Zustandストアから直接取得
        const authState = window.authStore?.getState?.();
        const token = authState?.accessToken;
        if (token) {
          config.headers = {
            ...(config.headers || {}),
            Authorization: `Bearer ${token}`,
          } as typeof config.headers;
        }
      } catch (error) {
        // ストアが初期化されていない場合はスキップ
        console.error('Auth store not yet initialized:', error);
      }
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor: 不要な自動リトライは行わず、そのままエラーを返す
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => Promise.reject(error)
);

export default api;