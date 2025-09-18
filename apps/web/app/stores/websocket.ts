import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { WebSocketClient, WebSocketMessage, createWebSocketClient } from '../lib/websocket';

export interface WebSocketStore {
  // 状態
  client: WebSocketClient | null;
  isConnected: boolean;
  isConnecting: boolean;
  connectionError: string | null;
  reconnectAttempts: number;
  currentRoomId: string | null;

  // メッセージ関連
  messages: ChatMessage[];
  typingUsers: Set<string>;

  // アクション
  connect: (token: string) => void;
  disconnect: () => void;
  joinRoom: (roomId: string) => void;
  leaveRoom: () => void;
  sendMessage: (content: string, roomId: string) => void;
  startTyping: (roomId: string) => void;
  stopTyping: (roomId: string) => void;
  addMessage: (message: ChatMessage) => void;
  setTypingUser: (userId: string, isTyping: boolean) => void;
  clearMessages: () => void;
}

export interface ChatMessage {
  id: string;
  content: string;
  userId: string;
  roomId: string;
  timestamp: number;
  type: 'text' | 'system';
}

export const useWebSocketStore = create<WebSocketStore>()(
  devtools(
    (set, get) => ({
      // 初期状態
      client: null,
      isConnected: false,
      isConnecting: false,
      connectionError: null,
      reconnectAttempts: 0,
      currentRoomId: null,
      messages: [],
      typingUsers: new Set(),

      // WebSocket接続
      connect: (token: string) => {
        const { client: existingClient } = get();

        // 既存の接続があれば切断
        if (existingClient) {
          existingClient.disconnect();
        }

        set({ isConnecting: true, connectionError: null });

        const client = createWebSocketClient(token);

        // コールバック設定
        client.setCallbacks({
          onOpen: () => {
            console.log('WebSocket接続成功');
            set({
              isConnected: true,
              isConnecting: false,
              connectionError: null,
              reconnectAttempts: 0
            });
          },

          onClose: (event) => {
            console.log('WebSocket接続終了:', event.code);
            set({
              isConnected: false,
              isConnecting: false,
              currentRoomId: null
            });
          },

          onError: (event) => {
            console.error('WebSocketエラー:', event);
            set({
              isConnected: false,
              isConnecting: false,
              connectionError: 'WebSocket接続エラーが発生しました'
            });
          },

          onMessage: (message: WebSocketMessage) => {
            get().handleWebSocketMessage(message);
          },

          onReconnect: (attempt: number) => {
            console.log(`再接続試行中: ${attempt}`);
            set({
              isConnecting: true,
              reconnectAttempts: attempt
            });
          },

          onReconnectFailed: () => {
            console.error('再接続に失敗しました');
            set({
              isConnecting: false,
              connectionError: '再接続に失敗しました'
            });
          },
        });

        // 接続開始
        client.connect();
        set({ client });
      },

      // WebSocket切断
      disconnect: () => {
        const { client } = get();
        if (client) {
          client.disconnect();
        }
        set({
          client: null,
          isConnected: false,
          isConnecting: false,
          currentRoomId: null,
          messages: [],
          typingUsers: new Set()
        });
      },

      // ルーム参加
      joinRoom: (roomId: string) => {
        const { client, currentRoomId } = get();
        if (!client || !client.isConnected()) {
          console.warn('WebSocket未接続のためルーム参加できません');
          return;
        }

        // 既に同じルームにいる場合は何もしない
        if (currentRoomId === roomId) {
          return;
        }

        // 現在のルームから退出
        if (currentRoomId) {
          client.leaveRoom();
        }

        // 新しいルームに参加
        if (client.joinRoom(roomId)) {
          set({ currentRoomId: roomId });
          // ルーム切り替え時にメッセージとタイピング状態をクリア
          get().clearMessages();
          set({ typingUsers: new Set() });
        }
      },

      // ルーム退出
      leaveRoom: () => {
        const { client } = get();
        if (client && client.isConnected()) {
          client.leaveRoom();
        }
        set({
          currentRoomId: null,
          messages: [],
          typingUsers: new Set()
        });
      },

      // メッセージ送信
      sendMessage: (content: string, roomId: string) => {
        const { client } = get();
        if (!client || !client.isConnected()) {
          console.warn('WebSocket未接続のためメッセージを送信できません');
          return;
        }

        client.sendChatMessage(content, roomId);
      },

      // タイピング開始
      startTyping: (roomId: string) => {
        const { client } = get();
        if (client && client.isConnected()) {
          client.startTyping(roomId);
        }
      },

      // タイピング停止
      stopTyping: (roomId: string) => {
        const { client } = get();
        if (client && client.isConnected()) {
          client.stopTyping(roomId);
        }
      },

      // メッセージ追加
      addMessage: (message: ChatMessage) => {
        set((state) => ({
          messages: [...state.messages, message]
        }));
      },

      // タイピング状態設定
      setTypingUser: (userId: string, isTyping: boolean) => {
        set((state) => {
          const newTypingUsers = new Set(state.typingUsers);
          if (isTyping) {
            newTypingUsers.add(userId);
          } else {
            newTypingUsers.delete(userId);
          }
          return { typingUsers: newTypingUsers };
        });
      },

      // メッセージクリア
      clearMessages: () => {
        set({ messages: [] });
      },

      // WebSocketメッセージ処理（内部メソッド）
      handleWebSocketMessage: (message: WebSocketMessage) => {
        const state = get();

        switch (message.type) {
          case 'new_message': {
            // 新しいメッセージを受信
            const data = message.data as {
              content: string;
              user_id: string;
              room_id: string;
              message_id: string;
              timestamp: number;
            };

            const chatMessage: ChatMessage = {
              id: data.message_id,
              content: data.content,
              userId: data.user_id,
              roomId: data.room_id,
              timestamp: data.timestamp * 1000, //秒をミリ秒に変換
              type: 'text'
            };

            state.addMessage(chatMessage);
            break;
          }

          case 'user_joined': {
            // ユーザー参加通知
            const data = message.data as { user_id: string; message: string };
            const systemMessage: ChatMessage = {
              id: `system_${Date.now()}`,
              content: data.message,
              userId: 'system',
              roomId: state.currentRoomId || '',
              timestamp: Date.now(),
              type: 'system'
            };
            state.addMessage(systemMessage);
            break;
          }

          case 'user_left': {
            // ユーザー退出通知
            const data = message.data as { user_id: string; message: string };
            const systemMessage: ChatMessage = {
              id: `system_${Date.now()}`,
              content: data.message,
              userId: 'system',
              roomId: state.currentRoomId || '',
              timestamp: Date.now(),
              type: 'system'
            };
            state.addMessage(systemMessage);
            // 退出したユーザーのタイピング状態を削除
            state.setTypingUser(data.user_id, false);
            break;
          }

          case 'typing_start': {
            // タイピング開始
            const data = message.data as { user_id: string; room_id: string };
            state.setTypingUser(data.user_id, true);
            break;
          }

          case 'typing_stop': {
            // タイピング停止
            const data = message.data as { user_id: string; room_id: string };
            state.setTypingUser(data.user_id, false);
            break;
          }

          case 'connected': {
            // 接続確認
            console.log('WebSocket接続確認:', message.data);
            break;
          }

          default:
            console.log('未処理のWebSocketメッセージ:', message);
        }
      },
    }),
    { name: 'websocket-store' }
  )
);