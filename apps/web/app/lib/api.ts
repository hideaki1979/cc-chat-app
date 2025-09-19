import axios, { AxiosHeaders } from 'axios';
import type { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { ChatRoom, ChatRoomResponse } from '../types/chat';
import { UserSearchResponse } from '../types/user';
import { useAuthStore } from '../stores/auth';
import { http } from '../lib/http';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000, // 10秒でタイムアウト
  withCredentials: true, // httpOnly Cookieの送信を有効化
});

// プロキシ用axiosインスタンス（/api/backend 経由）
export const apiProxy = axios.create({
  baseURL: '/api/backend',
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000,
  withCredentials: true,
});

// Request interceptor to add auth token
const attachAuthHeader = (config: InternalAxiosRequestConfig) => {
  // メモリ内のaccess_tokenを認証ストアから取得（SSR回避）
  if (typeof window !== 'undefined') {
    try {
      const authState = useAuthStore.getState();
      const token = authState?.accessToken;
      if (token) {
        const headers = AxiosHeaders.from(config.headers);
        headers.set('Authorization', `Bearer ${token}`);
        config.headers = headers;
      }
    } catch (error) {
      console.error('Auth store not yet initialized:', error);
    }
  }
  return config;
};

api.interceptors.request.use(attachAuthHeader, (error) => Promise.reject(error));
apiProxy.interceptors.request.use(attachAuthHeader, (error) => Promise.reject(error));

// Response interceptor: 不要な自動リトライは行わず、そのままエラーを返す
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => Promise.reject(error)
);
apiProxy.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => Promise.reject(error)
);

/**
 * ダイレクトメッセージ（1対1チャット）を開始する
 * 既存のDMがある場合はそれを返し、なければ新規作成
 */
export const createDirectMessage = async (targetUserId: string): Promise<ChatRoomResponse> => {
  return http.postJSON<ChatRoomResponse>('/api/backend/chatrooms/dm', { target_user_id: targetUserId });
};

/**
 * ユーザーを検索する
 */
export const searchUsers = async (query: string): Promise<UserSearchResponse> => {
  const { data } = await apiProxy.get('/users/search', {
    params: { query },
  });
  return data;
};

/**
 * チャットルーム一覧を取得する
 */
export const getChatRooms = async (): Promise<ChatRoom[]> => {
  const { data } = await apiProxy.get<{ rooms: ChatRoomResponse[] }>('/chatrooms');

  // ChatRoomResponse[] から ChatRoom[] への変換
  const chatRooms: ChatRoom[] = (data.rooms || []).map((apiRoom): ChatRoom => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { created_at, ...chatRoom } = apiRoom;
    return chatRoom
  })
  return chatRooms;
};

/**
 * チャットルーム詳細を取得する
 */
export const getChatRoom = async (roomId: string): Promise<ChatRoomResponse> => {
  const { data } = await apiProxy.get(`/chatrooms/${roomId}`);
  return data;
};

export const fetchUsersBatch = async (userIds: string[]) => {
  return http.postJSON<{ users: Array<{ id: string, name: string, profile_image_url?: string }> }>(`/api/backend/users/batch`, {
    user_ids: userIds
  });
};

export default api;