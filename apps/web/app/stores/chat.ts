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
  upsertRoom: (room: ChatRoom) => void;
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

  upsertRoom: (room) =>
    set((state) => {
      // 既存ルームの検索（IDベースで判定）
      const existingIndex = state.rooms.findIndex((r) => r.id === room.id);
      // 新規追加 or 既存更新の分岐処理
      const updateRooms = existingIndex === -1
        ? [...state.rooms, room]  // 新規追加: 配列末尾に追加
        : state.rooms.map((r, i) => i === existingIndex ? { ...r, ...room } : r); // 既存更新: 該当インデックスのみ更新

      return {
        rooms: updateRooms,
        currentRoomId: room.id,   // 追加/更新したルームを現在のルームに設定（自動選択）
      }
    }),

  updateRoom: (roomId, updates) =>
    set((state) => ({
      rooms: state.rooms.map(room =>
        room.id === roomId ? { ...room, ...updates } : room
      ),
    })),

  removeRoom: (roomId) =>
    set((state) => ({
      // 指定されたルームを配列から除去
      rooms: state.rooms.filter(room => room.id !== roomId),
      // 削除されたルームが現在選択中の場合は選択を解除
      currentRoomId: state.currentRoomId === roomId ? null : state.currentRoomId,
      // 削除されたルームのメッセージ履歴も同時に削除（メモリリーク防止）
      messages: Object.fromEntries(
        Object.entries(state.messages).filter(([rid]) => rid !== roomId)
      )
    })),

  loadRooms: async () => {
    try {
      set({ isLoading: true });
      const rooms = await getChatRooms(); // 既にChatroom[]型
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

      // 全ルームを走査してメッセージを検索・更新
      for (const [roomId, roomMessages = []] of Object.entries(state.messages)) {
        const idx = roomMessages.findIndex((m) => m.id === messageId);
        if (idx !== -1) {
          // メッセージが見つかった場合: 配列をコピーして該当メッセージを更新
          const next = roomMessages.slice();
          next[idx] = { ...roomMessages[idx], ...updates } as Message;
          newMessages[roomId] = next;
          changed = true;
        } else {
          // メッセージが見つからない場合: 元の配列をそのまま保持
          newMessages[roomId] = roomMessages;
        }
      }

      // 変更があった場合のみ状態を更新（パフォーマンス最適化）
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
    // 複数の非同期処理の同時実行に対応（カウンタベース）
    pendingCount: state.pendingCount + 1,
    isLoading: true
  })),
  endLoading: () => set((state) => {
    // カウンタを減らし、0以下にならないよう制限
    const nextCount = Math.max(0, state.pendingCount - 1);
    return {
      pendingCount: nextCount,
      // 全ての非同期処理が完了した場合のみローディング状態を解除
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