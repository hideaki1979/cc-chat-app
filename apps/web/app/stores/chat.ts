'use client';

import { create } from 'zustand';
import type { Message, ChatRoom } from '../types/chat';
import { getChatRooms } from '../lib/api';

interface ChatState {
  // チャットルーム関連
  rooms: ChatRoom[];
  currentRoomId: string | null;

  // メッセージ関連
  messages: Record<string, Message[]>; // roomId -> Message[]のマッピング
  isLoading: boolean;
  pendingCount: number;

  // WebSocket接続状態
  isConnected: boolean;
  connectionStatus: 'disconnected' | 'connecting' | 'connected' | 'error';

  // アクション
  setRooms: (rooms: ChatRoom[]) => void;
  setCurrentRoom: (roomId: string | null) => void;
  addRoom: (room: ChatRoom) => void;
  updateRoom: (roomId: string, updates: Partial<ChatRoom>) => void;
  removeRoom: (roomId: string) => void;
  loadRooms: () => Promise<void>;

  // メッセージ操作
  setMessages: (roomId: string, messages: Message[]) => void;
  addMessage: (message: Message) => void;
  updateMessage: (messageId: string, updates: Partial<Message>) => void;
  removeMessage: (messageId: string) => void;

  // WebSocket接続管理
  setConnectionStatus: (status: ChatState['connectionStatus']) => void;

  // 読み込み状態
  setLoading: (loading: boolean) => void;
  beginLoading: () => void;
  endLoading: () => void;

  // ユーティリティ
  getCurrentRoomMessages: () => Message[];
  clearCurrentRoomMessages: () => void;
}

export const useChatStore = create<ChatState>((set, get) => ({
  // 初期状態
  rooms: [],
  currentRoomId: null,
  messages: {},
  isLoading: false,
  pendingCount: 0,
  isConnected: false,
  connectionStatus: 'disconnected',

  // チャットルーム管理（純粋な状態管理のみ）
  setRooms: (rooms) => set({ rooms }),
  setCurrentRoom: (roomId) => set({ currentRoomId: roomId }),
  
  addRoom: (room) => 
    set((state) => ({
      rooms: [...state.rooms, room],
      currentRoomId: room.id,
    })),
  
  updateRoom: (roomId, updates) =>
    set((state) => ({
      rooms: state.rooms.map(room => 
        room.id === roomId ? { ...room, ...updates } : room
      ),
    })),
  
  removeRoom: (roomId) =>
    set((state) => ({
      rooms: state.rooms.filter(room => room.id !== roomId),
      currentRoomId: state.currentRoomId === roomId ? null : state.currentRoomId,
    })),

  loadRooms: async () => {
    try {
      set({ isLoading: true });
      const rooms = await getChatRooms();
      set({ rooms, isLoading: false });
    } catch (error) {
      console.error('ルーム読み込みエラー:', error);
      set({ isLoading: false });
    }
  },

  // メッセージ管理
  setMessages: (roomId, messages) =>
    set((state) => ({
      messages: {
        ...state.messages,
        [roomId]: messages,
      },
    })),

  addMessage: (message) =>
    set((state) => {
      const roomMessages = state.messages[message.room_id] || [];
      return {
        messages: {
          ...state.messages,
          [message.room_id]: [...roomMessages, message],
        },
      };
    }),

  updateMessage: (messageId, updates) =>
    set((state) => {
      let changed = false;
      const newMessages: Record<string, Message[]> = {};

      for (const [roomId, roomMessages = []] of Object.entries(state.messages)) {
        const idx = roomMessages.findIndex((m) => m.id === messageId);
        if (idx !== -1) {
          const next = roomMessages.slice();
          next[idx] = { ...roomMessages[idx], ...updates } as Message;
          newMessages[roomId] = next;
          changed = true;
        } else {
          newMessages[roomId] = roomMessages;
        }
      }

      return changed ? { messages: newMessages } : {};
    }),

  removeMessage: (messageId) =>
    set((state) => {
      const newMessages = { ...state.messages };

      // 全ルームからメッセージを検索して削除
      Object.keys(newMessages).forEach((roomId) => {
        const roomMessages = newMessages[roomId];
        if (roomMessages) {
          newMessages[roomId] = roomMessages.filter(msg => msg.id !== messageId);
        }
      });

      return { messages: newMessages };
    }),

  // WebSocket接続管理
  setConnectionStatus: (status) =>
    set({
      connectionStatus: status,
      isConnected: status === 'connected',
    }),

  // 読み込み状態
  setLoading: (loading) => set({ isLoading: loading }),
  beginLoading: () => set((state) => ({
    pendingCount: state.pendingCount + 1,
    isLoading: true
  })),
  endLoading: () => set((state) => {
    const nextCount = Math.max(0, state.pendingCount - 1);
    return {
      pendingCount: nextCount,
      isLoading: nextCount > 0
    };
  }),

  // ユーティリティ関数
  getCurrentRoomMessages: () => {
    const state = get();
    if (!state.currentRoomId) return [];
    return state.messages[state.currentRoomId] || [];
  },

  clearCurrentRoomMessages: () =>
    set((state) => {
      if (!state.currentRoomId) return state;

      const newMessages = { ...state.messages };
      delete newMessages[state.currentRoomId];

      return { messages: newMessages };
    }),
}));