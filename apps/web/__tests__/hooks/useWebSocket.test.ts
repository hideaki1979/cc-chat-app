import { renderHook, act } from '@testing-library/react';
import { useWebSocket } from '../../app/hooks/useWebSocket';
import { useWebSocketStore } from '../../app/stores/websocket';
import { useAuthStore } from '../../app/stores/auth';

// ストアをモック
jest.mock('../../app/stores/websocket');
jest.mock('../../app/stores/auth');

const mockUseWebSocketStore = useWebSocketStore as jest.MockedFunction<typeof useWebSocketStore>;
const mockUseAuthStore = useAuthStore as jest.MockedFunction<typeof useAuthStore>;

interface MockClient {
  disconnect: jest.Mock;
}

describe('useWebSocket', () => {
  const mockUser = {
    id: 'user1',
    email: 'test@example.com',
    name: 'Test User',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  }

  const mockWebSocketStore = {
    client: null,
    isConnected: false,
    isConnecting: false,
    connectionError: null,
    reconnectAttempts: 0,
    currentRoomId: null,
    messages: [],
    typingUsers: new Set<string>(),
    connect: jest.fn(),
    disconnect: jest.fn(),
    joinRoom: jest.fn(),
    leaveRoom: jest.fn(),
    sendMessage: jest.fn(),
    startTyping: jest.fn(),
    stopTyping: jest.fn(),
    clearMessages: jest.fn(),
  };

  const mockAuthStore = {
    accessToken: 'test-token',
    user: mockUser,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseWebSocketStore.mockReturnValue(mockWebSocketStore);
    mockUseAuthStore.mockReturnValue(mockAuthStore);
  });

  describe('初期化と認証管理', () => {
    test('ログイン済みでトークンがある場合は自動接続すること', () => {
      renderHook(() => useWebSocket());

      expect(mockWebSocketStore.connect).toHaveBeenCalledWith('test-token');
    });

    test('ログアウト時は自動切断すること', () => {
      // 最初はログイン済み
      mockUseAuthStore.mockReturnValue({
        accessToken: 'test-token',
        user: mockUser,
      });

      const { rerender } = renderHook(() => useWebSocket());

      // ログアウト状態に変更
      mockUseAuthStore.mockReturnValue({
        accessToken: null,
        user: null,
      });

      const mockClient: MockClient = { disconnect: jest.fn() };
      mockUseWebSocketStore.mockReturnValue({
        ...mockWebSocketStore,
        client: mockClient as MockClient,
      });

      rerender();

      expect(mockWebSocketStore.disconnect).toHaveBeenCalled();
    });

    test('トークンがない場合は接続しないこと', () => {
      mockUseAuthStore.mockReturnValue({
        accessToken: null,
        user: mockUser,
      });

      renderHook(() => useWebSocket());

      expect(mockWebSocketStore.connect).not.toHaveBeenCalled();
    });

    test('既に接続済みの場合は重複接続しないこと', () => {
      const mockClient: MockClient = { disconnect: jest.fn() };
      mockUseWebSocketStore.mockReturnValue({
        ...mockWebSocketStore,
        client: mockClient as MockClient,
      });

      renderHook(() => useWebSocket());

      expect(mockWebSocketStore.connect).not.toHaveBeenCalled();
    });
  });

  describe('接続管理メソッド', () => {
    test('手動接続ができること', () => {
      const { result } = renderHook(() => useWebSocket());

      act(() => {
        result.current.connect();
      });

      expect(mockWebSocketStore.connect).toHaveBeenCalledWith('test-token');
    });

    test('トークンがない場合は手動接続できないこと', () => {
      mockUseAuthStore.mockReturnValue({
        accessToken: null,
        user: null,
      });

      const { result } = renderHook(() => useWebSocket());

      act(() => {
        result.current.connect();
      });

      expect(mockWebSocketStore.connect).not.toHaveBeenCalled();
    });

    test('手動切断ができること', () => {
      const { result } = renderHook(() => useWebSocket());

      act(() => {
        result.current.disconnect();
      });

      expect(mockWebSocketStore.disconnect).toHaveBeenCalled();
    });
  });

  describe('ルーム管理メソッド', () => {
    beforeEach(() => {
      mockUseWebSocketStore.mockReturnValue({
        ...mockWebSocketStore,
        isConnected: true,
      });
    });

    test('接続済みの場合はルームに参加できること', () => {
      const { result } = renderHook(() => useWebSocket());

      act(() => {
        result.current.joinRoom('room123');
      });

      expect(mockWebSocketStore.joinRoom).toHaveBeenCalledWith('room123');
    });

    test('未接続の場合はルーム参加できないこと', () => {
      mockUseWebSocketStore.mockReturnValue({
        ...mockWebSocketStore,
        isConnected: false,
      });

      const { result } = renderHook(() => useWebSocket());

      act(() => {
        result.current.joinRoom('room123');
      });

      expect(mockWebSocketStore.joinRoom).not.toHaveBeenCalled();
    });

    test('接続済みの場合はルームから退出できること', () => {
      const { result } = renderHook(() => useWebSocket());

      act(() => {
        result.current.leaveRoom();
      });

      expect(mockWebSocketStore.leaveRoom).toHaveBeenCalled();
    });

    test('未接続の場合はルーム退出できないこと', () => {
      mockUseWebSocketStore.mockReturnValue({
        ...mockWebSocketStore,
        isConnected: false,
      });

      const { result } = renderHook(() => useWebSocket());

      act(() => {
        result.current.leaveRoom();
      });

      expect(mockWebSocketStore.leaveRoom).not.toHaveBeenCalled();
    });
  });

  describe('メッセージ管理メソッド', () => {
    beforeEach(() => {
      mockUseWebSocketStore.mockReturnValue({
        ...mockWebSocketStore,
        isConnected: true,
      });
    });

    test('接続済みでメッセージ内容がある場合はメッセージを送信できること', () => {
      const { result } = renderHook(() => useWebSocket());

      act(() => {
        result.current.sendMessage('Hello World', 'room123');
      });

      expect(mockWebSocketStore.sendMessage).toHaveBeenCalledWith('Hello World', 'room123');
    });

    test('空のメッセージは送信されないこと', () => {
      const { result } = renderHook(() => useWebSocket());

      act(() => {
        result.current.sendMessage('   ', 'room123');
      });

      expect(mockWebSocketStore.sendMessage).not.toHaveBeenCalled();
    });

    test('未接続の場合はメッセージを送信できないこと', () => {
      mockUseWebSocketStore.mockReturnValue({
        ...mockWebSocketStore,
        isConnected: false,
      });

      const { result } = renderHook(() => useWebSocket());

      act(() => {
        result.current.sendMessage('Hello World', 'room123');
      });

      expect(mockWebSocketStore.sendMessage).not.toHaveBeenCalled();
    });

    test('メッセージをクリアできること', () => {
      const { result } = renderHook(() => useWebSocket());

      act(() => {
        result.current.clearMessages();
      });

      expect(mockWebSocketStore.clearMessages).toHaveBeenCalled();
    });
  });

  describe('タイピング管理メソッド', () => {
    beforeEach(() => {
      mockUseWebSocketStore.mockReturnValue({
        ...mockWebSocketStore,
        isConnected: true,
      });
    });

    test('接続済みの場合はタイピング開始通知を送信できること', () => {
      const { result } = renderHook(() => useWebSocket());

      act(() => {
        result.current.startTyping('room123');
      });

      expect(mockWebSocketStore.startTyping).toHaveBeenCalledWith('room123');
    });

    test('未接続の場合はタイピング開始通知を送信できないこと', () => {
      mockUseWebSocketStore.mockReturnValue({
        ...mockWebSocketStore,
        isConnected: false,
      });

      const { result } = renderHook(() => useWebSocket());

      act(() => {
        result.current.startTyping('room123');
      });

      expect(mockWebSocketStore.startTyping).not.toHaveBeenCalled();
    });

    test('接続済みの場合はタイピング停止通知を送信できること', () => {
      const { result } = renderHook(() => useWebSocket());

      act(() => {
        result.current.stopTyping('room123');
      });

      expect(mockWebSocketStore.stopTyping).toHaveBeenCalledWith('room123');
    });

    test('未接続の場合はタイピング停止通知を送信できないこと', () => {
      mockUseWebSocketStore.mockReturnValue({
        ...mockWebSocketStore,
        isConnected: false,
      });

      const { result } = renderHook(() => useWebSocket());

      act(() => {
        result.current.stopTyping('room123');
      });

      expect(mockWebSocketStore.stopTyping).not.toHaveBeenCalled();
    });
  });

  describe('状態取得メソッド', () => {
    test('接続状態のテキストを正しく取得できること', () => {
      // 接続中
      mockUseWebSocketStore.mockReturnValue({
        ...mockWebSocketStore,
        isConnecting: true,
        reconnectAttempts: 0,
      });

      const { result, rerender } = renderHook(() => useWebSocket());
      expect(result.current.getConnectionStatusText()).toBe('接続中...');

      // 再接続中
      mockUseWebSocketStore.mockReturnValue({
        ...mockWebSocketStore,
        isConnecting: true,
        reconnectAttempts: 2,
      });

      rerender();
      expect(result.current.getConnectionStatusText()).toBe('再接続中... (2回目)');

      // 接続済み
      mockUseWebSocketStore.mockReturnValue({
        ...mockWebSocketStore,
        isConnected: true,
        isConnecting: false,
      });

      rerender();
      expect(result.current.getConnectionStatusText()).toBe('接続済み');

      // 接続エラー
      mockUseWebSocketStore.mockReturnValue({
        ...mockWebSocketStore,
        isConnected: false,
        isConnecting: false,
        connectionError: 'Network error',
      });

      rerender();
      expect(result.current.getConnectionStatusText()).toBe('接続エラー: Network error');

      // 未接続
      mockUseWebSocketStore.mockReturnValue({
        ...mockWebSocketStore,
        isConnected: false,
        isConnecting: false,
        connectionError: null,
      });

      rerender();
      expect(result.current.getConnectionStatusText()).toBe('未接続');
    });

    test('タイピング中のユーザー一覧を取得できること', () => {
      const typingUsers = new Set(['user1', 'user2']);
      mockUseWebSocketStore.mockReturnValue({
        ...mockWebSocketStore,
        typingUsers,
      });

      const { result } = renderHook(() => useWebSocket());
      const typingUsersList = result.current.typingUsers;

      expect(typingUsersList).toEqual(['user1', 'user2']);
    });
  });

  describe('状態の透過的アクセス', () => {
    test('WebSocketストアの状態が正しく透過されること', () => {
      const storeState = {
        ...mockWebSocketStore,
        isConnected: true,
        isConnecting: false,
        connectionError: null,
        reconnectAttempts: 3,
        currentRoomId: 'room123',
        messages: [
          {
            id: 'msg1',
            content: 'Hello',
            userId: 'user1',
            roomId: 'room123',
            timestamp: Date.now(),
            type: 'text' as const
          }
        ],
      };

      mockUseWebSocketStore.mockReturnValue(storeState);

      const { result } = renderHook(() => useWebSocket());

      expect(result.current.isConnected).toBe(true);
      expect(result.current.isConnecting).toBe(false);
      expect(result.current.connectionError).toBeNull();
      expect(result.current.reconnectAttempts).toBe(3);
      expect(result.current.currentRoomId).toBe('room123');
      expect(result.current.messages).toEqual(storeState.messages);
    });
  });

  describe('コンポーネントのアンマウント', () => {
    test('アンマウント時に接続が切断されること', () => {
      const mockClient: MockClient = { disconnect: jest.fn() };
      mockUseWebSocketStore.mockReturnValue({
        ...mockWebSocketStore,
        client: mockClient as MockClient,
      });

      const { unmount } = renderHook(() => useWebSocket());

      unmount();

      expect(mockWebSocketStore.disconnect).toHaveBeenCalled();
    });

    test('クライアントがない場合はアンマウント時に何もしないこと', () => {
      mockUseWebSocketStore.mockReturnValue({
        ...mockWebSocketStore,
        client: null,
      });

      const { unmount } = renderHook(() => useWebSocket());

      unmount();

      expect(mockWebSocketStore.disconnect).not.toHaveBeenCalled();
    });
  });
});