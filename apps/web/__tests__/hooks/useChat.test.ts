import { renderHook, act } from '@testing-library/react';
import { useChat } from '../../app/hooks/useChat';
import { useChatStore } from '../../app/stores/chat';
import { apiProxy } from '../../app/lib/api';

// Mocks
jest.mock('../../app/lib/api');
jest.mock('../../app/stores/chat');

const mockedApiProxy = apiProxy as jest.Mocked<typeof apiProxy>;

// Mock store state
const mockStoreState = {
  rooms: [],
  currentRoomId: null,
  messages: {},
  isLoading: false,
  setRooms: jest.fn(),
  setCurrentRoom: jest.fn(),
  setMessages: jest.fn(),
  addMessage: jest.fn(),
  setLoading: jest.fn(),
  beginLoading: jest.fn(),
  endLoading: jest.fn(),
};

const mockedUseChatStore = useChatStore as jest.MockedFunction<typeof useChatStore>;

describe('useChat', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedUseChatStore.mockReturnValue(mockStoreState as any);
  });

  describe('fetchRooms', () => {
    it('should fetch rooms successfully', async () => {
      const mockRooms = [
        {
          id: '1',
          name: 'Test Room',
          is_group_chat: false,
          updated_at: '2024-01-01T00:00:00Z'
        }
      ];
      const mockResponse = {
        data: {
          rooms: mockRooms,
          pagination: { page: 1, page_size: 20, total: 1 }
        }
      };

      mockedApiProxy.get.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => useChat());

      await act(async () => {
        await result.current.fetchRooms();
      });

      expect(mockedApiProxy.get).toHaveBeenCalledWith('/chatrooms');
      expect(mockStoreState.beginLoading).toHaveBeenCalled();
      expect(mockStoreState.setRooms).toHaveBeenCalledWith(mockRooms);
      expect(mockStoreState.endLoading).toHaveBeenCalled();
    });

    it('should handle fetch rooms error', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      mockedApiProxy.get.mockRejectedValue(new Error('Network error'));

      const { result } = renderHook(() => useChat());

      await expect(act(async () => {
        await result.current.fetchRooms();
      })).rejects.toThrow('Network error');

      expect(consoleSpy).toHaveBeenCalledWith('Failed to fetch rooms:', expect.any(Error));
      expect(mockStoreState.beginLoading).toHaveBeenCalled();
      expect(mockStoreState.endLoading).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });

  describe('fetchMessages', () => {
    it('should fetch messages successfully and sort them by created_at', async () => {
      const roomId = 'room1';
      // 意図的にソートされていない順序のテストデータ
      const mockMessages = [
        {
          id: '3',
          content: 'Latest message',
          sender_id: 'user3',
          sender_name: 'User 3',
          room_id: roomId,
          created_at: '2024-01-01T00:02:00Z' // 最新
        },
        {
          id: '1',
          content: 'Hello',
          sender_id: 'user1',
          sender_name: 'User 1',
          room_id: roomId,
          created_at: '2024-01-01T00:00:00Z' // 最古
        },
        {
          id: '2',
          content: 'Hi',
          sender_id: 'user2',
          sender_name: 'User 2',
          room_id: roomId,
          created_at: '2024-01-01T00:01:00Z' // 中間
        }
      ];

      // ソート後の期待される順序（created_atの昇順）
      const expectedSortedMessages = [
        {
          id: '1',
          content: 'Hello',
          sender_id: 'user1',
          sender_name: 'User 1',
          room_id: roomId,
          created_at: '2024-01-01T00:00:00Z'
        },
        {
          id: '2',
          content: 'Hi',
          sender_id: 'user2',
          sender_name: 'User 2',
          room_id: roomId,
          created_at: '2024-01-01T00:01:00Z'
        },
        {
          id: '3',
          content: 'Latest message',
          sender_id: 'user3',
          sender_name: 'User 3',
          room_id: roomId,
          created_at: '2024-01-01T00:02:00Z'
        }
      ];

      const mockResponse = {
        data: {
          messages: mockMessages,
          pagination: { page: 1, page_size: 50, total: 3 }
        }
      };

      mockedApiProxy.get.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => useChat());

      await act(async () => {
        await result.current.fetchMessages(roomId);
      });

      expect(mockedApiProxy.get).toHaveBeenCalledWith(`/chatrooms/${roomId}/messages`, {
        params: { page: 1, page_size: 50 }
      });
      // ソートされた順序でsetMessagesが呼ばれることを確認
      expect(mockStoreState.setMessages).toHaveBeenCalledWith(roomId, expectedSortedMessages);
    });

    it('should handle fetch messages error', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      const roomId = 'room1';
      mockedApiProxy.get.mockRejectedValue(new Error('Network error'));

      const { result } = renderHook(() => useChat());

      await expect(act(async () => {
        await result.current.fetchMessages(roomId);
      })).rejects.toThrow('Network error');

      expect(consoleSpy).toHaveBeenCalledWith('Failed to fetch messages:', expect.any(Error));

      consoleSpy.mockRestore();
    });
  });

  describe('sendMessage', () => {
    it('should send message successfully', async () => {
      const roomId = 'room1';
      const content = 'Hello World';
      const mockMessage = {
        id: '1',
        content,
        sender_id: 'user1',
        sender_name: 'User 1',
        room_id: roomId,
        created_at: '2024-01-01T00:00:00Z'
      };
      const mockResponse = { data: mockMessage };

      mockedApiProxy.post.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => useChat());

      let sentMessage;
      await act(async () => {
        sentMessage = await result.current.sendMessage(roomId, content);
      });

      expect(mockedApiProxy.post).toHaveBeenCalledWith(`/chatrooms/${roomId}/messages`, {
        content
      });
      expect(mockStoreState.addMessage).toHaveBeenCalledWith(mockMessage);
      expect(sentMessage).toEqual(mockMessage);
    });

    it('should handle send message error', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      const roomId = 'room1';
      const content = 'Hello World';
      mockedApiProxy.post.mockRejectedValue(new Error('Network error'));

      const { result } = renderHook(() => useChat());

      await expect(act(async () => {
        await result.current.sendMessage(roomId, content);
      })).rejects.toThrow('Network error');

      expect(consoleSpy).toHaveBeenCalledWith('Failed to send message:', expect.any(Error));

      consoleSpy.mockRestore();
    });
  });

  describe('selectRoom', () => {
    it('should select room and fetch messages with proper sorting', async () => {
      const roomId = 'room1';
      // 意図的にソートされていない順序のテストデータ
      const mockMessages = [
        {
          id: '2',
          content: 'Second message',
          sender_id: 'user2',
          sender_name: 'User 2',
          room_id: roomId,
          created_at: '2024-01-01T00:01:00Z'
        },
        {
          id: '1',
          content: 'First message',
          sender_id: 'user1',
          sender_name: 'User 1',
          room_id: roomId,
          created_at: '2023-12-31T00:00:00Z'
        }
      ];

      // ソート後の期待される順序（時系列順・古い順）
      const expectedSortedMessages = [
        {
          id: '1',
          content: 'First message',
          sender_id: 'user1',
          sender_name: 'User 1',
          room_id: roomId,
          created_at: '2023-12-31T00:00:00Z'
        },
        {
          id: '2',
          content: 'Second message',
          sender_id: 'user2',
          sender_name: 'User 2',
          room_id: roomId,
          created_at: '2024-01-01T00:01:00Z'
        }
      ];

      const mockResponse = {
        data: {
          messages: mockMessages,
          pagination: { page: 1, page_size: 50, total: 2 }
        }
      };

      mockedApiProxy.get.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => useChat());

      await act(async () => {
        await result.current.selectRoom(roomId);
      });

      expect(mockStoreState.setCurrentRoom).toHaveBeenCalledWith(roomId);
      expect(mockedApiProxy.get).toHaveBeenCalledWith(`/chatrooms/${roomId}/messages`, {
        params: { page: 1, page_size: 50 }
      });
      // ソートされた順序でsetMessagesが呼ばれることを確認
      expect(mockStoreState.setMessages).toHaveBeenCalledWith(roomId, expectedSortedMessages);
    });
  });
});