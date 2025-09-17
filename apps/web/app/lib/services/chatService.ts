import { apiProxy } from '../api';
import type { Message, ChatRoom } from '../../types/chat';
import axios from 'axios';
import { MAX_MESSAGE_LENGTH, PAGE_SIZE } from '../../constants/constants';
import { http } from '../http';

/**
 * チャット関連のビジネスロジックを管理するサービス層
 * UI層から分離し、純粋なビジネスロジックに集中
 * Server Components/Client Components両方で使用可能
 */

// API レスポンス型定義
interface GetRoomsResponse {
  rooms: ChatRoom[];
  pagination: {
    page: number;
    page_size: number;
    total: number;
  };
}

interface GetMessagesResponse {
  messages: Message[];
  pagination: {
    page: number;
    page_size: number;
    total: number;
  };
}

/**
 * チャットルーム一覧を取得
 * @returns Promise<ChatRoom[]>
 */
export const fetchChatRooms = async (): Promise<ChatRoom[]> => {
  try {
    const response = await apiProxy.get('/chatrooms');
    const data: GetRoomsResponse = response.data;

    if (data && Array.isArray(data.rooms)) {
      return data.rooms;
    }
    return [];
  } catch (error) {
    // 404エラーは正常なケースとして扱う（ルームが存在しない）
    if (axios.isAxiosError(error) && error.response?.status === 404) {
      return [];
    }
    throw new Error(`チャットルーム取得に失敗しました: ${error}`);
  }
};

/**
 * 指定されたルームのメッセージ一覧を取得
 * @param roomId - ルームID
 * @param page - ページ番号（デフォルト: 1）
 * @returns Promise<Message[]>
 */
export const fetchRoomMessages = async (roomId: string, page = 1): Promise<Message[]> => {
  if (!roomId.trim()) {
    throw new Error('ルームIDが必要です');
  }

  try {
    const safePage = Math.max(1, Number.isFinite(page) ? Math.floor(page) : 1);
    const encodeRoomId = encodeURIComponent(roomId.trim());
    const response = await apiProxy.get<GetMessagesResponse>(`/chatrooms/${encodeRoomId}/messages`, {
      params: { page: safePage, page_size: PAGE_SIZE }
    });
    const data = response.data;
    if (data && Array.isArray(data.messages)) {
      // メッセージを時系列順（古い順）にソート - ビジネスロジック
      return sortMessagesByCreatedAt(data.messages);
    }
    return [];
  } catch (error) {
    // 404エラーは正常なケースとして扱う（メッセージが存在しない）
    if (axios.isAxiosError(error) && error.response?.status === 404) {
      return [];
    }
    throw new Error(`メッセージ取得に失敗しました: ${error}`);
  }
};

/**
 * メッセージを送信
 * @param roomId - ルームID
 * @param content - メッセージ内容
 * @returns Promise<Message | null>
 */
export const sendChatMessage = async (roomId: string, content: string): Promise<Message | null> => {
  // バリデーション - ビジネスルール
  if (!roomId.trim()) {
    throw new Error('ルームIDが必要です');
  }

  const trimmed = content.trim();
  if (!trimmed) throw new Error('メッセージ内容が空です');
  if (trimmed.length > MAX_MESSAGE_LENGTH) {
    throw new Error('メッセージは1000文字以内で入力してください');
  }

  try {
    const encodeRoomId = encodeURIComponent(roomId.trim());
    const message = await http.postJSON<Message>(`/api/backend/chatrooms/${encodeRoomId}/messages`, { content: trimmed });
    return message ?? null;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const status = error.response?.status;
      if (status === 400) throw new Error('不正なメッセージです');
      if (status === 403) throw new Error('このルームへの投稿権限がありません');
      if (status === 404) throw new Error('指定されたルームが見つかりません');
    }
    throw new Error(`メッセージ送信に失敗しました: ${error}`);
  }
};

/**
 * メッセージを作成日時順（古い順）にソート
 * ビジネスロジック：チャットは時系列順に表示する
 * @param messages - ソート対象のメッセージ配列
 * @returns ソート済みメッセージ配列
 */
export const sortMessagesByCreatedAt = (messages: Message[]): Message[] => {
  return [...messages].sort((a, b) =>
    new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );
};

/**
 * メッセージ送信のバリデーション
 * @param content - メッセージ内容
 * @returns バリデーション結果
 */
export const validateMessageContent = (content: string): { isValid: boolean; error?: string } => {

  const trimmed = content.trim();
  if (!trimmed) return { isValid: false, error: 'メッセージ内容が空です' };
  if (trimmed.length > MAX_MESSAGE_LENGTH) {
    return { isValid: false, error: 'メッセージは1000文字以内で入力してください' };
  }
  return { isValid: true };
};