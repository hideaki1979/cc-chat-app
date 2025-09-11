import { renderHook, act } from '@testing-library/react';
import { useChat } from '../../app/hooks/useChat';
import { useChatStore } from '../../app/stores/chat';
import type { Message, ChatRoom } from '../../app/types/chat';

// Mock the service layer and error handling
jest.mock('../../app/lib/services/chatService');
jest.mock('../../app/lib/services/errorService');
jest.mock('../../app/stores/chat');

// Import mocked functions with proper types
import {
  fetchChatRooms,
  fetchRoomMessages,
  sendChatMessage
} from '../../app/lib/services/chatService';
import {
  normalizeError,
  logError
} from '../../app/lib/services/errorService';

const mockedFetchChatRooms = fetchChatRooms as jest.MockedFunction<typeof fetchChatRooms>;
const mockedFetchRoomMessages = fetchRoomMessages as jest.MockedFunction<typeof fetchRoomMessages>;
const mockedSendChatMessage = sendChatMessage as jest.MockedFunction<typeof sendChatMessage>;
const mockedNormalizeError = normalizeError as jest.MockedFunction<typeof normalizeError>;
const mockedLogError = logError as jest.MockedFunction<typeof logError>;
const mockedUseChatStore = useChatStore as jest.MockedFunction<typeof useChatStore>;

// Type for store state
interface MockChatStoreState {
  rooms: ChatRoom[];
  currentRoomId: string | null;
  messages: Record<string, Message[]>;
  isLoading: boolean;
  setRooms: jest.MockedFunction<(rooms: ChatRoom[]) => void>;
  setCurrentRoom: jest.MockedFunction<(roomId: string) => void>;
  setMessages: jest.MockedFunction<(roomId: string, messages: Message[]) => void>;
  addMessage: jest.MockedFunction<(message: Message) => void>;
  beginLoading: jest.MockedFunction<() => void>;
  endLoading: jest.MockedFunction<() => void>;
}

// Mock store state
const mockStoreState: MockChatStoreState = {
  rooms: [],
  currentRoomId: null,
  messages: {},
  isLoading: false,
  setRooms: jest.fn(),
  setCurrentRoom: jest.fn(),
  setMessages: jest.fn(),
  addMessage: jest.fn(),
  beginLoading: jest.fn(),
  endLoading: jest.fn(),
};

// Sample data
const mockRooms: ChatRoom[] = [
  {
    id: '1',
    name: 'Test Room',
    is_group_chat: false,
    updated_at: '2024-01-01T00:00:00Z'
  }
];

const mockMessages: Message[] = [
  {
    id: 'msg1',
    content: 'Test message',
    sender_id: 'user1',
    sender_name: 'Test User',
    room_id: '1',
    user_id: 'user1',
    created_at: '2024-01-01T10:00:00Z',
    updated_at: '2024-01-01T10:00:00Z',
    message_type: 'text',
  }
];

const mockAppError = {
  message: 'Test error',
  type: 'network' as const,
  originalError: new Error('Original error')
};

describe('useChat', () => {
  beforeEach(() => {
    // Clear all mock history and implementations
    jest.clearAllMocks();

    // Reset store and error service mocks
    mockedUseChatStore.mockReturnValue(mockStoreState);
    mockedNormalizeError.mockReturnValue(mockAppError);
    mockedLogError.mockImplementation(() => { });
  });

  describe('fetchRooms', () => {
    it('should fetch rooms successfully', async () => {
      mockedFetchChatRooms.mockResolvedValue(mockRooms);

      const { result } = renderHook(() => useChat());

      await act(async () => {
        await result.current.fetchRooms();
      });

      expect(mockedFetchChatRooms).toHaveBeenCalledTimes(1);
      expect(mockStoreState.beginLoading).toHaveBeenCalled();
      expect(mockStoreState.setRooms).toHaveBeenCalledWith(mockRooms);
      expect(mockStoreState.endLoading).toHaveBeenCalled();
    });

    it('should handle fetch rooms error', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => { });
      const testError = new Error('Network error');
      mockedFetchChatRooms.mockRejectedValueOnce(testError);

      const { result } = renderHook(() => useChat());

      await expect(act(async () => {
        await result.current.fetchRooms();
      })).rejects.toEqual(mockAppError);


      expect(mockedFetchChatRooms).toHaveBeenCalledTimes(1);
      expect(mockedNormalizeError).toHaveBeenCalledWith(testError, 'チャットルーム取得');
      expect(mockedLogError).toHaveBeenCalledWith(mockAppError, 'useChat.fetchRooms');
      expect(mockStoreState.setRooms).toHaveBeenCalledWith([]);
      expect(mockStoreState.beginLoading).toHaveBeenCalled();
      expect(mockStoreState.endLoading).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });

  describe('fetchMessages', () => {
    const roomId = '1';

    it('should fetch messages successfully', async () => {
      mockedFetchRoomMessages.mockResolvedValue(mockMessages);

      const { result } = renderHook(() => useChat());

      await act(async () => {
        await result.current.fetchMessages(roomId);
      });

      expect(mockedFetchRoomMessages).toHaveBeenCalledWith(roomId, 1);
      expect(mockStoreState.beginLoading).toHaveBeenCalled();
      expect(mockStoreState.setMessages).toHaveBeenCalledWith(roomId, mockMessages);
      expect(mockStoreState.endLoading).toHaveBeenCalled();
    });

    it('should fetch messages with custom page', async () => {
      mockedFetchRoomMessages.mockResolvedValue(mockMessages);

      const { result } = renderHook(() => useChat());

      await act(async () => {
        await result.current.fetchMessages(roomId, 2);
      });

      expect(mockedFetchRoomMessages).toHaveBeenCalledWith(roomId, 2);
    });

    it('should handle fetch messages error', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => { });
      const testError = new Error('Network error');
      mockedFetchRoomMessages.mockRejectedValueOnce(testError);

      const { result } = renderHook(() => useChat());


      await expect(act(async () => {
        await result.current.fetchMessages(roomId);
      })).rejects.toEqual(mockAppError);

      expect(mockedFetchRoomMessages).toHaveBeenCalledTimes(1);
      expect(mockedNormalizeError).toHaveBeenCalledWith(testError, 'メッセージ取得');
      expect(mockedLogError).toHaveBeenCalledWith(mockAppError, 'useChat.fetchMessages');
      expect(mockStoreState.setMessages).toHaveBeenCalledWith(roomId, []);

      consoleSpy.mockRestore();
    });
  });

  describe('sendMessage', () => {
    const roomId = '1';
    const content = 'Test message';

    it('should send message successfully', async () => {
      mockedSendChatMessage.mockResolvedValue(mockMessages[0]!);

      const { result } = renderHook(() => useChat());

      let messageResult;
      await act(async () => {
        messageResult = await result.current.sendMessage(roomId, content);
      });

      expect(mockedSendChatMessage).toHaveBeenCalledWith(roomId, content);
      expect(mockStoreState.addMessage).toHaveBeenCalledWith(mockMessages[0]);
      expect(messageResult).toBe(mockMessages[0]);
    });

    it('should handle send message error', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => { });
      const testError = new Error('Network error');
      mockedSendChatMessage.mockRejectedValueOnce(testError);

      const { result } = renderHook(() => useChat());

      await expect(act(async () => {
        await result.current.sendMessage(roomId, content);
      })).rejects.toEqual(mockAppError);

      expect(mockedSendChatMessage).toHaveBeenCalledTimes(1);
      expect(mockedNormalizeError).toHaveBeenCalledWith(testError, 'メッセージ送信');
      expect(mockedLogError).toHaveBeenCalledWith(mockAppError, 'useChat.sendMessage');
      expect(mockStoreState.addMessage).not.toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it('should return null if message is null', async () => {
      mockedSendChatMessage.mockResolvedValueOnce(null);
      const { result } = renderHook(() => useChat());

      let messageResult;
      await act(async () => {
        messageResult = await result.current.sendMessage(roomId, content);
      });

      expect(messageResult).toBeNull();
      expect(mockStoreState.addMessage).not.toHaveBeenCalled();
    });
  });

  describe('selectRoom', () => {
    const roomId = '1';

    it('should select room and fetch messages', async () => {
      mockedFetchRoomMessages.mockResolvedValue(mockMessages);

      const { result } = renderHook(() => useChat());

      await act(async () => {
        await result.current.selectRoom(roomId);
      });

      expect(mockStoreState.setCurrentRoom).toHaveBeenCalledWith(roomId);
      expect(mockedFetchRoomMessages).toHaveBeenCalledWith(roomId, 1);
    });
  });

  describe('state values', () => {
    it('should return correct state values', () => {
      const mockStateWithMessages = {
        ...mockStoreState,
        rooms: mockRooms,
        currentRoomId: '1',
        messages: { '1': mockMessages },
        isLoading: false,
      };

      mockedUseChatStore.mockReturnValue(mockStateWithMessages);

      const { result } = renderHook(() => useChat());

      expect(result.current.rooms).toBe(mockRooms);
      expect(result.current.currentRoomId).toBe('1');
      expect(result.current.messages).toEqual({ '1': mockMessages });
      expect(result.current.currentRoomMessages).toEqual(mockMessages);
      expect(result.current.isLoading).toBe(false);
    });

    it('should return empty array for currentRoomMessages when no room selected', () => {
      const { result } = renderHook(() => useChat());

      expect(result.current.currentRoomMessages).toEqual([]);
    });

    it('should return empty array for currentRoomMessages when room has no messages', () => {
      const mockStateWithCurrentRoom = {
        ...mockStoreState,
        currentRoomId: '2',
        messages: { '1': mockMessages }, // Room '2' has no messages
      };

      mockedUseChatStore.mockReturnValue(mockStateWithCurrentRoom);

      const { result } = renderHook(() => useChat());

      expect(result.current.currentRoomMessages).toEqual([]);
    });
  });
});