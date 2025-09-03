import axios from 'axios';
import type { AxiosError, InternalAxiosRequestConfig } from 'axios';
import type { UseBoundStore, StoreApi } from 'zustand';
import type { AuthStore } from '../types/auth';
import { ChatRoom } from '../types/chat';

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
      const authState = window.authStore?.getState?.();
      const token = authState?.accessToken;
      if (token) {
        config.headers = {
          ...(config.headers || {}),
          Authorization: `Bearer ${token}`,
        } as typeof config.headers;
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

// チャットルーム関連のAPI関数
export interface CreateChatRoomRequest {
  name: string;
  is_group_chat: boolean;
  member_ids: string[];
}

export interface ChatRoomMember {
  user_id: string;
  name: string;
  email: string;
  joined_at: string;
}

export interface ChatRoomResponse {
  id: string;
  name: string;
  is_group_chat: boolean;
  member_count?: number;
  last_message?: {
    content: string;
    sender_name: string;
    created_at: string;
  };
  updated_at: string;
  created_at: string;
  members?: ChatRoomMember[];
}

export interface UserSearchResult {
  id: string;
  name: string;
  email: string;
  profile_image_url?: string;
}

export interface UserSearchResponse {
  users: UserSearchResult[];
  total: number;
}

/**
 * ダイレクトメッセージ（1対1チャット）を開始する
 * 既存のDMがある場合はそれを返し、なければ新規作成
 */
export const createDirectMessage = async (targetUserId: string): Promise<ChatRoomResponse> => {
  const { data } = await apiProxy.post('/chatrooms/dm', {
    target_user_id: targetUserId,
  });
  return data;
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


export default api;