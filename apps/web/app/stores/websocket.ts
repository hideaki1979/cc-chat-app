import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { WebSocketClient, WebSocketMessage, createWebSocketClient } from '../lib/websocket';
import type { Message } from '../types/chat';

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

  // ChatStoreとの統合用
  _chatStoreUpsertMessage: ((message: Message) => void) | null;

  // アクション
  connect: (token?: string) => void;
  disconnect: () => void;
  joinRoom: (roomId: string) => void;
  leaveRoom: () => void;
  sendMessage: (content: string, roomId: string, userId?: string) => void;
  startTyping: (roomId: string) => void;
  stopTyping: (roomId: string) => void;
  addMessage: (message: ChatMessage) => void;
  upsertMessage: (message: ChatMessage) => void;
  setTypingUser: (userId: string, isTyping: boolean) => void;
  clearMessages: () => void;
  handleWebSocketMessage: (message: WebSocketMessage) => void;
  setChatStoreIntegration: (upsertMessage: (message: Message) => void) => void;
}

export interface ChatMessage {
  id: string;
  content: string;
  userId: string;
  roomId: string;
  timestamp: number;
  type: 'text' | 'system' | 'error';
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

      // ChatStoreとの統合用（オプショナル）
      _chatStoreUpsertMessage: null as ((message: Message) => void) | null,

      // WebSocket接続
      connect: (token?: string) => {
        const { client: existingClient, isConnecting } = get();

        console.log('🔌 WebSocket接続開始:', { hasToken: !!token, hasExistingClient: !!existingClient, isConnecting });

        // 既に接続中の場合はスキップ
        if (isConnecting) {
          console.log('🔌 既に接続中のためスキップします');
          return;
        }

        // 既存の接続があれば先に切断
        if (existingClient) {
          console.log('🔌 既存接続を切断中...');
          existingClient.disconnect();
          // 少し待ってから新しい接続を開始
          setTimeout(() => {
            get().connect(token);
          }, 100);
          return;
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
            const ws = event?.target as WebSocket;
            const errorDetails = {
              type: event?.type || 'Unknown type',
              target: event?.target?.constructor?.name || 'Unknown target',
              readyState: ws?.readyState || 'Unknown',
              readyStateText: ws?.readyState ? ['CONNECTING', 'OPEN', 'CLOSING', 'CLOSED'][ws.readyState] : 'Unknown',
              url: ws?.url || 'URL不明',
              timestamp: new Date().toISOString()
            };
            console.error('WebSocketエラー詳細:', errorDetails);

            set({
              isConnected: false,
              isConnecting: false,
              connectionError: `接続エラー (${errorDetails.readyStateText}): ${errorDetails.url}`
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
      sendMessage: (content: string, roomId: string, userId?: string) => {
        const { client, currentRoomId, addMessage, isConnected } = get();
        console.log('🚀 sendMessage called:', {
          content: content.substring(0, 50) + (content.length > 50 ? '...' : ''),
          roomId,
          userId,
          isConnected,
          currentRoomId,
          connectionState: client?.getConnectionState()
        });

        if (!client || !isConnected) {
          const errorMsg = 'メッセージ送信失敗: WebSocket未接続';
          console.warn(errorMsg, {
            hasClient: !!client,
            isConnected,
            connectionState: client?.getConnectionState(),
            currentRoomId
          });
          // ユーザーにエラーを通知（システムメッセージとして）
          if (userId) {
            const errorMessage: ChatMessage = {
              id: `error_${Date.now()}`,
              content: errorMsg,
              userId: 'system',
              roomId: roomId || currentRoomId || '',
              timestamp: Date.now(),
              type: 'error'
            };
            addMessage(errorMessage);
          }
          return;
        }

        // WebSocketでメッセージを送信
        const sendSuccess = client.sendChatMessage(content, roomId);

        if (!sendSuccess) {
          console.warn('メッセージ送信に失敗しました');
          if (userId) {
            const errorMessage: ChatMessage = {
              id: `error_${Date.now()}`,
              content: 'メッセージの送信に失敗しました。接続を確認してください。',
              userId: 'system',
              roomId: roomId || currentRoomId || '',
              timestamp: Date.now(),
              type: 'error'
            };
            addMessage(errorMessage);
          }
          return;
        }

        // 送信者自身のメッセージを即座にローカルに追加（楽観的更新）
        if (userId) {
          const optimisticMessage: ChatMessage = {
            id: `temp_${Date.now()}`, // 一時的なID
            content,
            userId,
            roomId: roomId || currentRoomId || '',
            timestamp: Date.now(),
            type: 'text'
          };

          console.log('📝 Adding optimistic message:', optimisticMessage);
          addMessage(optimisticMessage);

          // メッセージ追加後のstateを確認
          const state = get();
          console.log('📊 Messages after add:', state.messages.length);
        }
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

      // メッセージのUpsert
      upsertMessage: (message: ChatMessage) => {
        set((state) => {
          const existingIndex = state.messages.findIndex(m => m.id === message.id);

          const updateMessages = existingIndex >= 0
            ? state.messages.map((m, i) => i === existingIndex ? message : m)
            : [...state.messages, message];
          return { messages: updateMessages };
        })
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

      // ChatStoreとの統合設定
      setChatStoreIntegration: (upsertMessage: (message: Message) => void) => {
        set({ _chatStoreUpsertMessage: upsertMessage });
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
              file_url?: string;
            };

            console.log('📩 Received WebSocket message:', data);

            const chatMessage: ChatMessage = {
              id: data.message_id,
              content: data.content,
              userId: data.user_id,
              roomId: data.room_id,
              timestamp: data.timestamp * 1000, //秒をミリ秒に変換
              type: 'text'
            };

            console.log('📥 Adding received message:', chatMessage);
            state.upsertMessage(chatMessage);

            // ChatStoreにも統合（設定されている場合）
            if (state._chatStoreUpsertMessage) {
              const chatStoreMessage: Message = {
                id: data.message_id,
                content: data.content,
                user_id: data.user_id,
                room_id: data.room_id,
                created_at: new Date(data.timestamp * 1000).toISOString(),
                updated_at: new Date(data.timestamp * 1000).toISOString(),
                file_url: data.file_url || undefined,
                sender: {
                  id: data.user_id,
                  name: 'User', // 実際のユーザー名は別途解決される
                }
              };

              console.log('🔄 Syncing to ChatStore:', chatStoreMessage);
              state._chatStoreUpsertMessage(chatStoreMessage);
            }

            // メッセージ追加後のstateを確認
            const afterState = get();
            console.log('📊 Messages after receive:', afterState.messages.length);
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
            state.upsertMessage(systemMessage);
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
            state.upsertMessage(systemMessage);
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