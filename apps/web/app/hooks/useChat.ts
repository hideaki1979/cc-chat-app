'use client';

import { useCallback } from 'react';
import { api } from '../lib/api';
import { useChatStore } from '../stores/chat';
import type { Message, ChatRoom } from '../types/chat';

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
    setLoading,
    getCurrentRoomMessages,
  } = useChatStore();

  // チャットルーム一覧取得
  const fetchRooms = useCallback(async () => {
    try {
      setLoading(true);
      const response = await api.get('/api/backend/chatrooms');
      const data: GetRoomsResponse = response.data;
      
      if (data && Array.isArray(data.rooms)) {
        setRooms(data.rooms);
      }
    } catch (error) {
      console.error('Failed to fetch rooms:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [setRooms, setLoading]);

  // メッセージ一覧取得
  const fetchMessages = useCallback(async (roomId: string, page = 1) => {
    try {
      setLoading(true);
      const response = await api.get(`/api/backend/chatrooms/${roomId}/messages`, {
        params: { page, page_size: 50 }
      });
      const data: GetMessagesResponse = response.data;
      
      if (data && Array.isArray(data.messages)) {
        // メッセージを時系列順（古い順）に並べ替え
        const sortedMessages = data.messages.sort((a, b) => 
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        );
        setMessages(roomId, sortedMessages);
      }
    } catch (error) {
      console.error('Failed to fetch messages:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [setMessages, setLoading]);

  // メッセージ送信
  const sendMessage = useCallback(async (roomId: string, content: string): Promise<Message | null> => {
    try {
      const response = await api.post(`/api/backend/chatrooms/${roomId}/messages`, {
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
  const selectRoom = useCallback(async (roomId: string) => {
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
    currentRoomMessages: getCurrentRoomMessages(),

    // Actions
    fetchRooms,
    fetchMessages,
    sendMessage,
    selectRoom,
  };
};