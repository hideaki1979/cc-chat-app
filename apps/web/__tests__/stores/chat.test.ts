import { renderHook, act } from '@testing-library/react';
import { useChatStore } from '../../app/stores/chat';
import type { Message } from '../../app/components/chat';
import type { ChatRoom } from '../../app/components/layout';

// モックデータ
const mockRooms: ChatRoom[] = [
  {
    id: 'room1',
    name: 'テストルーム1',
    is_group_chat: true,
    member_count: 5,
    updated_at: new Date().toISOString(),
  },
  {
    id: 'room2',
    name: 'テストルーム2',
    is_group_chat: false,
    updated_at: new Date().toISOString(),
  },
];

const mockMessages: Message[] = [
  {
    id: 'msg1',
    content: 'メッセージ1',
    sender_id: 'user1',
    sender_name: 'ユーザー1',
    user_id: 'user1',
    room_id: 'room1',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    message_type: 'text',
  },
  {
    id: 'msg2',
    content: 'メッセージ2',
    sender_id: 'user2',
    sender_name: 'ユーザー2',
    user_id: 'user2',
    room_id: 'room1',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    message_type: 'text',
  },
  {
    id: 'msg3',
    content: 'ルーム2のメッセージ',
    sender_id: 'user1',
    sender_name: 'ユーザー1',
    user_id: 'user1',
    room_id: 'room2',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    message_type: 'text',
  },
];

describe('useChatStore', () => {
  beforeEach(() => {
    // 各テスト前にストアをリセット
    const { result } = renderHook(() => useChatStore());
    act(() => {
      result.current.setRooms([]);
      result.current.setCurrentRoom(null);
      Object.keys(result.current.messages).forEach(roomId => {
        result.current.setMessages(roomId, []);
      });
      result.current.setConnectionStatus('disconnected');
      result.current.setLoading(false);
    });
  });

  describe('初期状態', () => {
    test('初期状態が正しく設定される', () => {
      const { result } = renderHook(() => useChatStore());

      expect(result.current.rooms).toEqual([]);
      expect(result.current.currentRoomId).toBeNull();
      expect(result.current.messages).toEqual({});
      expect(result.current.isLoading).toBe(false);
      expect(result.current.isConnected).toBe(false);
      expect(result.current.connectionStatus).toBe('disconnected');
    });
  });

  describe('チャットルーム管理', () => {
    test('ルーム一覧を設定できる', () => {
      const { result } = renderHook(() => useChatStore());

      act(() => {
        result.current.setRooms(mockRooms);
      });

      expect(result.current.rooms).toEqual(mockRooms);
    });

    test('現在のルームを設定できる', () => {
      const { result } = renderHook(() => useChatStore());

      act(() => {
        result.current.setCurrentRoom('room1');
      });

      expect(result.current.currentRoomId).toBe('room1');
    });
  });

  describe('メッセージ管理', () => {
    test('ルーム別にメッセージを設定できる', () => {
      const { result } = renderHook(() => useChatStore());

      act(() => {
        result.current.setMessages('room1', [mockMessages[0]!, mockMessages[1]!]);
        result.current.setMessages('room2', [mockMessages[2]!]);
      });

      expect(result.current.messages['room1']).toHaveLength(2);
      expect(result.current.messages['room2']).toHaveLength(1);
      expect(result.current.messages['room1']![0]).toEqual(mockMessages[0]);
      expect(result.current.messages['room2']![0]).toEqual(mockMessages[2]);
    });

    test('メッセージをupsertできる', () => {
      const { result } = renderHook(() => useChatStore());

      act(() => {
        result.current.setMessages('room1', [mockMessages[0]!]);
        result.current.upsertMessage(mockMessages[1]!);
      });

      expect(result.current.messages['room1']).toHaveLength(2);
      expect(result.current.messages['room1']![1]).toEqual(mockMessages[1]);
    });

    test('存在しないルームにメッセージをupsertできる', () => {
      const { result } = renderHook(() => useChatStore());

      act(() => {
        result.current.upsertMessage(mockMessages[0]!);
      });

      expect(result.current.messages['room1']).toHaveLength(1);
      expect(result.current.messages['room1']![0]).toEqual(mockMessages[0]);
    });

    // 重複チェック
    test('同じIDのメッセージをupsertすると更新される', () => {
      const {result} = renderHook(() => useChatStore());

      const originalMessage = mockMessages[0]!;
      const updateMessage = {
        ...originalMessage,
        content: '更新されたメッセージ',
        updated_at: new Date().toISOString()
      };

      act(() => {
        result.current.upsertMessage(originalMessage);
      });

      expect(result.current.messages['room1']).toHaveLength(1);

      act(() => {
        result.current.upsertMessage(updateMessage);
      });

      expect(result.current.messages['room1']).toHaveLength(1);
      expect(result.current.messages['room1']![0]!.content).toBe('更新されたメッセージ');
    });

    test('メッセージを更新できる', () => {
      const { result } = renderHook(() => useChatStore());

      act(() => {
        result.current.setMessages('room1', [mockMessages[0]!]);
        result.current.updateMessage('msg1', {
          content: '更新されたメッセージ',
          is_edited: true
        });
      });

      const updatedMessage = result.current.messages['room1']![0];
      expect(updatedMessage?.content).toBe('更新されたメッセージ');
      expect(updatedMessage?.is_edited).toBe(true);
      expect(updatedMessage?.id).toBe('msg1'); // 他のプロパティは保持される
    });

    test('メッセージを削除できる', () => {
      const { result } = renderHook(() => useChatStore());

      act(() => {
        result.current.setMessages('room1', mockMessages.slice(0, 2));
        result.current.removeMessage('msg1');
      });

      expect(result.current.messages['room1']).toHaveLength(1);
      expect(result.current.messages['room1']![0]?.id).toBe('msg2');
    });

    test('複数ルームから同じIDのメッセージを削除', () => {
      const { result } = renderHook(() => useChatStore());

      const duplicatedMessage = { ...mockMessages[0]!, room_id: 'room2' };

      act(() => {
        result.current.setMessages('room1', [mockMessages[0]!]);
        result.current.setMessages('room2', [duplicatedMessage]);
        result.current.removeMessage('msg1');
      });

      expect(result.current.messages['room1']).toHaveLength(0);
      expect(result.current.messages['room2']).toHaveLength(0);
    });
  });

  describe('WebSocket接続管理', () => {
    test('接続状態を設定できる', () => {
      const { result } = renderHook(() => useChatStore());

      act(() => {
        result.current.setConnectionStatus('connected');
      });

      expect(result.current.connectionStatus).toBe('connected');
      expect(result.current.isConnected).toBe(true);
    });

    test('接続状態に応じてisConnectedが更新される', () => {
      const { result } = renderHook(() => useChatStore());

      act(() => {
        result.current.setConnectionStatus('connecting');
      });
      expect(result.current.isConnected).toBe(false);

      act(() => {
        result.current.setConnectionStatus('connected');
      });
      expect(result.current.isConnected).toBe(true);

      act(() => {
        result.current.setConnectionStatus('error');
      });
      expect(result.current.isConnected).toBe(false);
    });
  });

  describe('ローディング状態管理', () => {
    test('ローディング状態を設定できる', () => {
      const { result } = renderHook(() => useChatStore());

      act(() => {
        result.current.setLoading(true);
      });

      expect(result.current.isLoading).toBe(true);

      act(() => {
        result.current.setLoading(false);
      });

      expect(result.current.isLoading).toBe(false);
    });

    test('beginLoading/endLoadingでペンディングカウント管理ができる', () => {
      const { result } = renderHook(() => useChatStore());

      // 初期状態
      expect(result.current.isLoading).toBe(false);
      expect(result.current.pendingCount).toBe(0);

      // 最初のローディング開始
      act(() => {
        result.current.beginLoading();
      });

      expect(result.current.isLoading).toBe(true);
      expect(result.current.pendingCount).toBe(1);

      // 2つ目のローディング開始
      act(() => {
        result.current.beginLoading();
      });

      expect(result.current.isLoading).toBe(true);
      expect(result.current.pendingCount).toBe(2);

      // 1つ目のローディング終了
      act(() => {
        result.current.endLoading();
      });

      expect(result.current.isLoading).toBe(true);
      expect(result.current.pendingCount).toBe(1);

      // 2つ目のローディング終了
      act(() => {
        result.current.endLoading();
      });

      expect(result.current.isLoading).toBe(false);
      expect(result.current.pendingCount).toBe(0);
    });

    test('endLoadingでペンディングカウントが負にならない', () => {
      const { result } = renderHook(() => useChatStore());

      // ローディングが開始されていない状態でendLoadingを呼び出し
      act(() => {
        result.current.endLoading();
      });

      expect(result.current.isLoading).toBe(false);
      expect(result.current.pendingCount).toBe(0);

      // 一度beginLoadingしてからendLoadingを複数回呼び出し
      act(() => {
        result.current.beginLoading();
      });

      act(() => {
        result.current.endLoading();
        result.current.endLoading(); // 余分な呼び出し
      });

      expect(result.current.isLoading).toBe(false);
      expect(result.current.pendingCount).toBe(0);
    });
  });

  describe('ユーティリティ関数', () => {
    test('現在のルームのメッセージを取得できる', () => {
      const { result } = renderHook(() => useChatStore());

      act(() => {
        result.current.setMessages('room1', mockMessages.slice(0, 2));
        result.current.setMessages('room2', [mockMessages[2]!]);
        result.current.setCurrentRoom('room1');
      });

      const currentMessages = result.current.getCurrentRoomMessages();
      expect(currentMessages).toHaveLength(2);
      expect(currentMessages[0]?.id).toBe('msg1');
    });

    test('ルームが選択されていない場合は空配列を返す', () => {
      const { result } = renderHook(() => useChatStore());

      act(() => {
        result.current.setMessages('room1', mockMessages.slice(0, 2));
      });

      const currentMessages = result.current.getCurrentRoomMessages();
      expect(currentMessages).toEqual([]);
    });

    test('現在のルームのメッセージをクリアできる', () => {
      const { result } = renderHook(() => useChatStore());

      act(() => {
        result.current.setMessages('room1', mockMessages.slice(0, 2));
        result.current.setMessages('room2', [mockMessages[2]!]);
        result.current.setCurrentRoom('room1');
        result.current.clearCurrentRoomMessages();
      });

      expect(result.current.messages['room1']).toBeUndefined();
      expect(result.current.messages['room2']).toHaveLength(1); // 他のルームは影響なし
    });

    test('ルームが選択されていない場合はクリア処理が無視される', () => {
      const { result } = renderHook(() => useChatStore());

      act(() => {
        result.current.setMessages('room1', mockMessages.slice(0, 2));
        result.current.clearCurrentRoomMessages();
      });

      expect(result.current.messages['room1']).toHaveLength(2); // 変更されない
    });
  });
});