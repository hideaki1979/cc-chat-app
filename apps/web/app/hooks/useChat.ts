'use client';

import { useCallback } from 'react';
import { useChatStore } from '../stores/chat';
import {
  fetchChatRooms,
  fetchRoomMessages,
  sendChatMessage,
  validateMessageContent,
} from '../lib/services/chatService';
import { normalizeError, logError } from '../lib/services/errorService';
import type { Message } from '../types/chat';

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
      const rooms = await fetchChatRooms();
      setRooms(rooms);
    } catch (error) {
      const appError = normalizeError(error, 'チャットルーム取得');
      logError(appError, 'useChat.fetchRooms');

      // UI層では空の配列を設定してエラーを隠す（UX向上）
      setRooms([]);
      throw appError;
    } finally {
      endLoading();
    }
  }, [setRooms, beginLoading, endLoading]);

  // メッセージ一覧取得
  const fetchMessages = useCallback(async (roomId: string, page = 1) => {
    try {
      beginLoading();
      const messages = await fetchRoomMessages(roomId, page);
      setMessages(roomId, messages);
    } catch (error) {
      const appError = normalizeError(error, 'メッセージ取得');
      logError(appError, 'useChat.fetchMessages');

      // UI層では空の配列を設定してエラーを隠す（UX向上）
      setMessages(roomId, []);
      throw appError;
    } finally {
      endLoading();
    }
  }, [setMessages, beginLoading, endLoading]);

  // メッセージ送信
  const sendMessage = useCallback(async (roomId: string, content: string): Promise<Message | null> => {
    // 送信前バリデーションをフック側に集約
    const validation = validateMessageContent(content);
    if (!validation.isValid) {
      throw new Error(validation.error || 'バリデーションエラー');
    }

    const message = await sendChatMessage(roomId, content);
    if (message) {
      addMessage(message);
    }
    return message;
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