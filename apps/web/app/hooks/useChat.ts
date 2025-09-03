'use client';

import { useCallback } from 'react';
import { apiProxy } from '../lib/api';
import { useChatStore } from '../stores/chat';
import type { Message, ChatRoom } from '../types/chat';
import axios from 'axios';

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

export const useChat = () => {
  const {
    rooms,
    currentRoomId,
    messages,
    isLoading,
    setRooms,
    setCurrentRoom,
    setMessages,
    addMessage,
    beginLoading,
    endLoading,
  } = useChatStore();

  // チャットルーム一覧取得
  const fetchRooms = useCallback(async () => {
    try {
      beginLoading();
      const response = await apiProxy.get('/chatrooms');
      const data: GetRoomsResponse = response.data;

      if (data && Array.isArray(data.rooms)) {
        setRooms(data.rooms);
      } else {
        setRooms([]);
      }
    } catch (error) {
      console.error('Failed to fetch rooms:', error);
      // 404エラーの場合は空の配列を設定
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        setRooms([]);
        return; // エラーを再スローしない
      }
      throw error;
    } finally {
      endLoading();
    }
  }, [setRooms, beginLoading, endLoading]);

  // メッセージ一覧取得
  const fetchMessages = useCallback(async (roomId: string, page = 1) => {
    try {
      beginLoading();
      const response = await apiProxy.get(`/chatrooms/${roomId}/messages`, {
        params: { page, page_size: 50 }
      });
      const data: GetMessagesResponse = response.data;

      if (data && Array.isArray(data.messages)) {
        // メッセージを時系列順（古い順）に並べ替え
        const sortedMessages = [...data.messages].sort((a, b) =>
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        );
        setMessages(roomId, sortedMessages);
      } else {
        setMessages(roomId, []);
      }
    } catch (error) {
      console.error('Failed to fetch messages:', error);
      // 404エラーの場合は空の配列を設定
      if (error && typeof error === 'object' && 'response' in error && 
          error.response && typeof error.response === 'object' && 
          'status' in error.response && error.response.status === 404) {
        setMessages(roomId, []);
        return; // エラーを再スローしない
      }
      throw error;
    } finally {
      endLoading();
    }
  }, [setMessages, beginLoading, endLoading]);

  // メッセージ送信
  const sendMessage = useCallback(async (roomId: string, content: string): Promise<Message | null> => {
    try {
      const response = await apiProxy.post(`/chatrooms/${roomId}/messages`, {
        content,
      });

      const message: Message = response.data;
      if (message) {
        addMessage(message);
        return message;
      }
      return null;
    } catch (error) {
      console.error('Failed to send message:', error);
      throw error;
    }
  }, [addMessage]);

  // ルーム選択
  const selectRoom = useCallback(async (roomId: string): Promise<void> => {
    setCurrentRoom(roomId);
    // ルーム選択時にメッセージも取得
    await fetchMessages(roomId);
  }, [setCurrentRoom, fetchMessages]);

  return {
    // State
    rooms,
    currentRoomId,
    messages,
    isLoading,
    currentRoomMessages: (currentRoomId && messages[currentRoomId]) || [],

    // Actions
    fetchRooms,
    fetchMessages,
    sendMessage,
    selectRoom,
  };
};