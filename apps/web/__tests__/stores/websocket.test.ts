import { renderHook, act } from '@testing-library/react';
import { useWebSocketStore, ChatMessage } from '../../app/stores/websocket';
import { WebSocketMessage, WebSocketCallbacks } from '../../app/lib/websocket';

// WebSocketClientのモック型定義
interface MockWebSocketClient {
  connect: jest.Mock;
  disconnect: jest.Mock;
  isConnected: jest.Mock;
  joinRoom: jest.Mock;
  leaveRoom: jest.Mock;
  sendChatMessage: jest.Mock;
  startTyping: jest.Mock;
  stopTyping: jest.Mock;
  setCallbacks: jest.Mock;
}

// WebSocketClientのモック
const mockWebSocketClient: MockWebSocketClient = {
  connect: jest.fn(),
  disconnect: jest.fn(),
  isConnected: jest.fn(),
  joinRoom: jest.fn(),
  leaveRoom: jest.fn(),
  sendChatMessage: jest.fn(),
  startTyping: jest.fn(),
  stopTyping: jest.fn(),
  setCallbacks: jest.fn(),
};

// createWebSocketClientをモック
jest.mock('../../app/lib/websocket', () => ({
  ...jest.requireActual('../../app/lib/websocket'),
  createWebSocketClient: jest.fn(() => mockWebSocketClient as unknown),
}));

describe('WebSocketStore', () => {
  beforeEach(() => {
    // ストアの状態をリセット
    useWebSocketStore.setState({
      client: null,
      isConnected: false,
      isConnecting: false,
      connectionError: null,
      reconnectAttempts: 0,
      currentRoomId: null,
      messages: [],
      typingUsers: new Set(),
    });

    // モックをクリア
    jest.clearAllMocks();
  });

  describe('初期状態', () => {
    test('初期状態が正しく設定されること', () => {
      const { result } = renderHook(() => useWebSocketStore());

      expect(result.current.client).toBeNull();
      expect(result.current.isConnected).toBe(false);
      expect(result.current.isConnecting).toBe(false);
      expect(result.current.connectionError).toBeNull();
      expect(result.current.reconnectAttempts).toBe(0);
      expect(result.current.currentRoomId).toBeNull();
      expect(result.current.messages).toEqual([]);
      expect(result.current.typingUsers).toEqual(new Set());
    });
  });

  describe('接続管理', () => {
    test('WebSocket接続を開始できること', () => {
      const { result } = renderHook(() => useWebSocketStore());

      act(() => {
        result.current.connect();
      });

      expect(result.current.isConnecting).toBe(true);
      expect(result.current.connectionError).toBeNull();
      expect(result.current.client).toBeTruthy();
      expect(mockWebSocketClient.setCallbacks).toHaveBeenCalled();
      expect(mockWebSocketClient.connect).toHaveBeenCalled();
    });

    test('既存の接続がある場合は切断してから新しい接続を作成すること', () => {
      const { result } = renderHook(() => useWebSocketStore());

      // 最初の接続
      act(() => {
        result.current.connect();
      });

      // 2回目の接続
      act(() => {
        result.current.connect();
      });

      expect(mockWebSocketClient.disconnect).toHaveBeenCalled();
    });

    test('WebSocket接続を切断できること', () => {
      const { result } = renderHook(() => useWebSocketStore());

      // 先に接続
      act(() => {
        result.current.connect();
      });

      // 切断
      act(() => {
        result.current.disconnect();
      });

      expect(mockWebSocketClient.disconnect).toHaveBeenCalled();
      expect(result.current.client).toBeNull();
      expect(result.current.isConnected).toBe(false);
      expect(result.current.isConnecting).toBe(false);
      expect(result.current.currentRoomId).toBeNull();
      expect(result.current.messages).toEqual([]);
      expect(result.current.typingUsers).toEqual(new Set());
    });
  });

  describe('ルーム管理', () => {
    beforeEach(() => {
      const { result } = renderHook(() => useWebSocketStore());
      act(() => {
        result.current.connect();
      });
      mockWebSocketClient.isConnected.mockReturnValue(true);
      mockWebSocketClient.joinRoom.mockReturnValue(true);
    });

    test('ルームに参加できること', () => {
      const { result } = renderHook(() => useWebSocketStore());

      act(() => {
        result.current.joinRoom('room123');
      });

      expect(mockWebSocketClient.joinRoom).toHaveBeenCalledWith('room123');
      expect(result.current.currentRoomId).toBe('room123');
    });

    test('既に同じルームにいる場合は何もしないこと', () => {
      const { result } = renderHook(() => useWebSocketStore());

      // 最初にルームに参加
      act(() => {
        result.current.joinRoom('room123');
      });

      jest.clearAllMocks();

      // 同じルームに再度参加を試行
      act(() => {
        result.current.joinRoom('room123');
      });

      expect(mockWebSocketClient.joinRoom).not.toHaveBeenCalled();
      expect(mockWebSocketClient.leaveRoom).not.toHaveBeenCalled();
    });

    test('ルームを切り替えるときは既存のルームから退出すること', () => {
      const { result } = renderHook(() => useWebSocketStore());

      // 最初のルームに参加
      act(() => {
        result.current.joinRoom('room123');
      });

      // 2番目のルームに参加
      act(() => {
        result.current.joinRoom('room456');
      });

      expect(mockWebSocketClient.leaveRoom).toHaveBeenCalled();
      expect(mockWebSocketClient.joinRoom).toHaveBeenCalledWith('room456');
      expect(result.current.currentRoomId).toBe('room456');
    });

    test('ルームから退出できること', () => {
      const { result } = renderHook(() => useWebSocketStore());

      // 先にルームに参加
      act(() => {
        result.current.joinRoom('room123');
      });

      // ルームから退出
      act(() => {
        result.current.leaveRoom();
      });

      expect(mockWebSocketClient.leaveRoom).toHaveBeenCalled();
      expect(result.current.currentRoomId).toBeNull();
      expect(result.current.messages).toEqual([]);
      expect(result.current.typingUsers).toEqual(new Set());
    });

    test('未接続時はルーム操作が警告を出すこと', () => {
      const { result } = renderHook(() => useWebSocketStore());
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      mockWebSocketClient.isConnected.mockReturnValue(false);

      act(() => {
        result.current.joinRoom('room123');
      });

      expect(consoleSpy).toHaveBeenCalledWith('WebSocket未接続のためルーム参加できません');
      expect(result.current.currentRoomId).toBeNull();

      consoleSpy.mockRestore();
    });
  });

  describe('メッセージ管理', () => {
    beforeEach(() => {
      const { result } = renderHook(() => useWebSocketStore());
      act(() => {
        result.current.connect();
      });
      mockWebSocketClient.isConnected.mockReturnValue(true);
    });

    test('メッセージを送信できること', () => {
      const { result } = renderHook(() => useWebSocketStore());

      act(() => {
        result.current.sendMessage('Hello World', 'room123');
      });

      expect(mockWebSocketClient.sendChatMessage).toHaveBeenCalledWith('Hello World', 'room123');
    });

    test('未接続時はメッセージ送信が警告を出すこと', () => {
      const { result } = renderHook(() => useWebSocketStore());
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      mockWebSocketClient.isConnected.mockReturnValue(false);

      act(() => {
        result.current.sendMessage('Hello World', 'room123');
      });

      expect(consoleSpy).toHaveBeenCalledWith('WebSocket未接続のためメッセージを送信できません');
      expect(mockWebSocketClient.sendChatMessage).not.toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    test('メッセージをupsertできること', () => {
      const { result } = renderHook(() => useWebSocketStore());

      const message: ChatMessage = {
        id: 'msg123',
        content: 'Hello',
        userId: 'user123',
        roomId: 'room123',
        timestamp: Date.now(),
        type: 'text'
      };

      act(() => {
        result.current.upsertMessage(message);
      });

      expect(result.current.messages).toContain(message);
    });

    test('同じIDのメッセージをupsertすると更新されること', () => {
      const { result } = renderHook(() => useWebSocketStore());

      const originalMessage: ChatMessage = {
        id: 'msg123',
        content: 'Hello',
        userId: 'user123',
        roomId: 'room123',
        timestamp: Date.now(),
        type: 'text'
      };

      const updateMessage: ChatMessage = {
        ...originalMessage,
        content: 'Updated Hello',
        timestamp: Date.now() + 1000
      };

      // 最初のメッセージを追加
      act(() => {
        result.current.upsertMessage(originalMessage);
      });

      expect(result.current.messages).toHaveLength(1);
      expect(result.current.messages[0]!.content).toBe('Hello');

      // 同じIDで更新
      act(() => {
        result.current.upsertMessage(updateMessage);
      });

      expect(result.current.messages).toHaveLength(1);
      expect(result.current.messages[0]!.content).toBe('Update Hello');
    });

    test('メッセージをクリアできること', () => {
      const { result } = renderHook(() => useWebSocketStore());

      // メッセージを追加
      const message: ChatMessage = {
        id: 'msg123',
        content: 'Hello',
        userId: 'user123',
        roomId: 'room123',
        timestamp: Date.now(),
        type: 'text'
      };

      act(() => {
        result.current.addMessage(message);
      });

      // メッセージをクリア
      act(() => {
        result.current.clearMessages();
      });

      expect(result.current.messages).toEqual([]);
    });
  });

  describe('タイピング管理', () => {
    beforeEach(() => {
      const { result } = renderHook(() => useWebSocketStore());
      act(() => {
        result.current.connect();
      });
      mockWebSocketClient.isConnected.mockReturnValue(true);
    });

    test('タイピング開始通知を送信できること', () => {
      const { result } = renderHook(() => useWebSocketStore());

      act(() => {
        result.current.startTyping('room123');
      });

      expect(mockWebSocketClient.startTyping).toHaveBeenCalledWith('room123');
    });

    test('タイピング停止通知を送信できること', () => {
      const { result } = renderHook(() => useWebSocketStore());

      act(() => {
        result.current.stopTyping('room123');
      });

      expect(mockWebSocketClient.stopTyping).toHaveBeenCalledWith('room123');
    });

    test('タイピング状態を設定できること', () => {
      const { result } = renderHook(() => useWebSocketStore());

      act(() => {
        result.current.setTypingUser('user123', true);
      });

      expect(result.current.typingUsers.has('user123')).toBe(true);

      act(() => {
        result.current.setTypingUser('user123', false);
      });

      expect(result.current.typingUsers.has('user123')).toBe(false);
    });
  });

  describe('WebSocketコールバック処理', () => {
    test('接続成功時の処理が正しく動作すること', () => {
      const { result } = renderHook(() => useWebSocketStore());

      act(() => {
        result.current.connect();
      });

      // setCallbacksに渡されたコールバックを取得
      const setCallbacksCall = mockWebSocketClient.setCallbacks.mock.calls[0];
      const callbacks = setCallbacksCall[0] as WebSocketCallbacks;

      // onOpenコールバックを実行
      act(() => {
        callbacks.onOpen?.(new Event('open'));
      });

      expect(result.current.isConnected).toBe(true);
      expect(result.current.isConnecting).toBe(false);
      expect(result.current.connectionError).toBeNull();
      expect(result.current.reconnectAttempts).toBe(0);
    });

    test('接続終了時の処理が正しく動作すること', () => {
      const { result } = renderHook(() => useWebSocketStore());

      act(() => {
        result.current.connect();
      });

      const setCallbacksCall = mockWebSocketClient.setCallbacks.mock.calls[0];
      const callbacks = setCallbacksCall[0] as WebSocketCallbacks;

      // onCloseコールバックを実行
      act(() => {
        callbacks.onClose?.(new CloseEvent('close', { code: 1000 }));
      });

      expect(result.current.isConnected).toBe(false);
      expect(result.current.isConnecting).toBe(false);
      expect(result.current.currentRoomId).toBeNull();
    });

    test('接続エラー時の処理が正しく動作すること', () => {
      const { result } = renderHook(() => useWebSocketStore());

      act(() => {
        result.current.connect();
      });

      const setCallbacksCall = mockWebSocketClient.setCallbacks.mock.calls[0];
      const callbacks = setCallbacksCall[0] as WebSocketCallbacks;

      // onErrorコールバックを実行
      act(() => {
        callbacks.onError?.(new Event('error'));
      });

      expect(result.current.isConnected).toBe(false);
      expect(result.current.isConnecting).toBe(false);
      expect(result.current.connectionError).toBe('WebSocket接続エラーが発生しました');
    });

    test('再接続試行時の処理が正しく動作すること', () => {
      const { result } = renderHook(() => useWebSocketStore());

      act(() => {
        result.current.connect();
      });

      const setCallbacksCall = mockWebSocketClient.setCallbacks.mock.calls[0];
      const callbacks = setCallbacksCall[0] as WebSocketCallbacks;

      // onReconnectコールバックを実行
      act(() => {
        callbacks.onReconnect?.(2);
      });

      expect(result.current.isConnecting).toBe(true);
      expect(result.current.reconnectAttempts).toBe(2);
    });

    test('再接続失敗時の処理が正しく動作すること', () => {
      const { result } = renderHook(() => useWebSocketStore());

      act(() => {
        result.current.connect();
      });

      const setCallbacksCall = mockWebSocketClient.setCallbacks.mock.calls[0];
      const callbacks = setCallbacksCall[0] as WebSocketCallbacks;

      // onReconnectFailedコールバックを実行
      act(() => {
        callbacks.onReconnectFailed?.();
      });

      expect(result.current.isConnecting).toBe(false);
      expect(result.current.connectionError).toBe('再接続に失敗しました');
    });

    test('新着メッセージ受信時の処理が正しく動作すること', () => {
      const { result } = renderHook(() => useWebSocketStore());

      act(() => {
        result.current.connect();
      });

      const setCallbacksCall = mockWebSocketClient.setCallbacks.mock.calls[0];
      const callbacks = setCallbacksCall[0] as WebSocketCallbacks;

      const message: WebSocketMessage = {
        type: 'new_message',
        data: {
          content: 'Hello',
          user_id: 'user123',
          room_id: 'room123',
          message_id: 'msg123',
          timestamp: 1234567890
        }
      };

      // onMessageコールバックを実行
      act(() => {
        callbacks.onMessage?.(message);
      });

      expect(result.current.messages).toHaveLength(1);
      expect(result.current.messages[0]).toMatchObject({
        id: 'msg123',
        content: 'Hello',
        userId: 'user123',
        roomId: 'room123',
        type: 'text'
      });
    });
  });
});