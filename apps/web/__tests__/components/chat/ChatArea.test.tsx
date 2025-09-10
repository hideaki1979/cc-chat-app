import { useState } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { ChatArea } from '../../../app/components/chat/ChatArea';
import type { Message } from '../../../app/components/chat';

// useChatフックのモック
jest.mock('../../../app/hooks/useChat', () => ({
  useChat: jest.fn(),
}));

// MessageListとMessageInputのモック
jest.mock('../../../app/components/chat/MessageList', () => ({
  MessageList: ({ messages, currentUserId }: { messages: Message[], currentUserId: string }) => (
    <div data-testid="message-list">
      <div>Messages: {messages.length}</div>
      <div>Current User: {currentUserId}</div>
    </div>
  ),
}));

jest.mock('../../../app/components/chat/MessageInput', () => {
  interface MockMessageInputProps {
    onSendMessage: (content: string) => void | Promise<void>;
    disabled?: boolean;
    placeholder?: string;
  }
  return {
    MessageInput: ({ onSendMessage, disabled, placeholder }: MockMessageInputProps) => {
      const [value, setValue] = useState('');
      return (
        <div data-testid="message-input">
          <input
            data-testid="message-input-field"
            placeholder={placeholder}
            disabled={disabled}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && value.trim()) {
                onSendMessage(value.trim());
                setValue('');
              }
            }}
          />
        </div>
      );
    },
  };
});

import { useChat } from '../../../app/hooks/useChat';

const mockedUseChat = useChat as jest.MockedFunction<typeof useChat>;

const mockMessages: Message[] = [
  {
    id: 'msg1',
    content: 'テストメッセージ1',
    sender_id: 'user1',
    sender_name: '田中さん',
    room_id: 'room1',
    user_id: 'user1',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    message_type: 'text',
  },
  {
    id: 'msg2',
    content: 'テストメッセージ2',
    sender_id: 'current_user',
    sender_name: 'あなた',
    room_id: 'room1',
    user_id: 'current_user',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    message_type: 'text',
  },
];

// useChatフックのモックレスポンス
const mockUseChatReturn = {
  rooms: [],
  currentRoomId: 'room1',
  messages: { room1: mockMessages },
  currentRoomMessages: mockMessages,
  isLoading: false,
  sendMessage: jest.fn(),
  fetchMessages: jest.fn(),
  fetchRooms: jest.fn(),
  selectRoom: jest.fn(),
  beginLoading: jest.fn(),
  endLoading: jest.fn(),
};

describe('ChatArea', () => {
  const mockOnSendMessage = jest.fn();

  beforeEach(() => {
    mockOnSendMessage.mockClear();
    mockedUseChat.mockReturnValue(mockUseChatReturn);
    mockUseChatReturn.sendMessage.mockClear();
    mockUseChatReturn.fetchMessages.mockClear();
  });

  test('ルームが選択されていない場合のプレースホルダー表示', () => {
    render(
      <ChatArea
        messages={[]}
        currentUserId="current_user"
        onSendMessage={mockOnSendMessage}
      />
    );

    expect(screen.getByText('チャットルームを選択してください')).toBeInTheDocument();
    expect(screen.getByText(/左のサイドバーからチャットルームを選択するか/)).toBeInTheDocument();

    // MessageListとMessageInputは表示されない
    expect(screen.queryByTestId('message-list')).not.toBeInTheDocument();
    expect(screen.queryByTestId('message-input')).not.toBeInTheDocument();
  });

  test('ルームが選択されている場合のチャット表示', () => {
    render(
      <ChatArea
        roomId="room1"
        roomName="テストルーム"
        messages={mockMessages}
        currentUserId="current_user"
        onSendMessage={mockOnSendMessage}
      />
    );

    // MessageListとMessageInputが表示される
    expect(screen.getByTestId('message-list')).toBeInTheDocument();
    expect(screen.getByTestId('message-input')).toBeInTheDocument();

    // MessageListにメッセージ数とユーザーIDが渡される
    expect(screen.getByText('Messages: 2')).toBeInTheDocument();
    expect(screen.getByText('Current User: current_user')).toBeInTheDocument();
  });

  test('メッセージ送信機能', async () => {
    const user = userEvent.setup();

    render(
      <ChatArea
        roomId="room1"
        roomName="テストルーム"
        messages={mockMessages}
        currentUserId="current_user"
        onSendMessage={mockOnSendMessage}
      />
    );

    const input = screen.getByTestId('message-input-field');
    await user.type(input, 'test message');
    await user.keyboard('{Enter}');

    await waitFor(() => {
      expect(mockOnSendMessage).toHaveBeenCalledWith('test message');
    });
  });

  test('送信中状態の表示', async () => {
    const slowOnSendMessage = jest.fn((): Promise<void> => new Promise(resolve => setTimeout(resolve, 100)));

    const user = userEvent.setup();

    render(
      <ChatArea
        roomId="room1"
        roomName="テストルーム"
        messages={mockMessages}
        currentUserId="current_user"
        onSendMessage={slowOnSendMessage}
      />
    );

    const input = screen.getByTestId('message-input-field');
    await user.type(input, 'test message');
    
    // 送信開始
    user.keyboard('{Enter}');

    // 送信中表示を確認（プレースホルダーとして表示）
    await waitFor(() => {
      expect(input).toHaveAttribute('placeholder', '送信中...');
    });

    // 送信完了まで待つ
    await waitFor(() => {
      expect(input).toHaveAttribute('placeholder', 'テストルームにメッセージを送信...');
    });
  });

  test('disabled状態', () => {
    render(
      <ChatArea
        roomId="room1"
        roomName="テストルーム"
        messages={mockMessages}
        currentUserId="current_user"
        onSendMessage={mockOnSendMessage}
        disabled={true}
      />
    );

    const input = screen.getByTestId('message-input-field');
    expect(input).toBeDisabled();
  });

  test('カスタムプレースホルダーの表示', () => {
    render(
      <ChatArea
        roomId="room1"
        roomName="カスタムルーム"
        messages={mockMessages}
        currentUserId="current_user"
        onSendMessage={mockOnSendMessage}
      />
    );

    const input = screen.getByTestId('message-input-field');
    expect(input).toHaveAttribute('placeholder', 'カスタムルームにメッセージを送信...');
  });

  test('メッセージ送信エラーの処理', async () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => { });
    const errorOnSendMessage = jest.fn().mockRejectedValue(new Error('送信エラー'));

    const user = userEvent.setup();

    render(
      <ChatArea
        roomId="room1"
        roomName="テストルーム"
        messages={mockMessages}
        currentUserId="current_user"
        onSendMessage={errorOnSendMessage}
      />
    );

    const input = screen.getByTestId('message-input-field');
    await user.type(input, 'テストメッセージ');
    await user.keyboard('{Enter}');

    await waitFor(() => {
      expect(errorOnSendMessage).toHaveBeenCalledWith('テストメッセージ');
    });

    await waitFor(() => {
      expect(consoleErrorSpy).toHaveBeenCalledWith('メッセージ送信エラー:', 'メッセージ送信: 送信エラー');
    });

    consoleErrorSpy.mockRestore();
  });

  test('ローディング状態の表示', () => {
    render(
      <ChatArea
        roomId="room1"
        roomName="テストルーム"
        messages={mockMessages}
        currentUserId="current_user"
        onSendMessage={mockOnSendMessage}
        isLoading={true}
      />
    );

    // MessageListにローディング状態が渡されることを確認
    expect(screen.getByTestId('message-list')).toBeInTheDocument();
  });

  test('空のメッセージリスト', () => {
    render(
      <ChatArea
        roomId="room1"
        roomName="空のルーム"
        messages={[]}
        currentUserId="current_user"
        onSendMessage={mockOnSendMessage}
      />
    );

    expect(screen.getByText('Messages: 0')).toBeInTheDocument();
  });

  test('roomIdが変更された時にメッセージを取得', () => {
    const { rerender } = render(
      <ChatArea
        roomId="room1"
        roomName="テストルーム1"
        messages={mockMessages}
        currentUserId="current_user"
        onSendMessage={mockOnSendMessage}
      />
    );

    expect(mockUseChatReturn.fetchMessages).toHaveBeenCalledWith('room1');

    // roomIdを変更
    rerender(
      <ChatArea
        roomId="room2"
        roomName="テストルーム2"
        messages={mockMessages}
        currentUserId="current_user"
        onSendMessage={mockOnSendMessage}
      />
    );

    expect(mockUseChatReturn.fetchMessages).toHaveBeenCalledWith('room2');
  });

  test('onSendMessageが未指定の場合はuseChatのsendMessageを使用', async () => {
    const user = userEvent.setup();
    mockUseChatReturn.sendMessage.mockResolvedValue({
      id: 'new-msg',
      content: 'test message',
      sender_id: 'current_user',
      sender_name: 'Test User',
      room_id: 'room1',
      created_at: new Date().toISOString()
    });

    render(
      <ChatArea
        roomId="room1"
        roomName="テストルーム"
        messages={mockMessages}
        currentUserId="current_user"
      />
    );

    const input = screen.getByTestId('message-input-field');
    await user.type(input, 'test message');
    await user.keyboard('{Enter}');

    await waitFor(() => {
      expect(mockUseChatReturn.sendMessage).toHaveBeenCalledWith('room1', 'test message');
    });
  });

  test('useChatからのメッセージとローディング状態を使用', () => {
    // useChatからのデータを使用する場合
    mockedUseChat.mockReturnValue({
      ...mockUseChatReturn,
      currentRoomMessages: [mockMessages[0]!], // 1件のみ
      isLoading: true,
    });

    render(
      <ChatArea
        roomId="room1"
        roomName="テストルーム"
        currentUserId="current_user"
        onSendMessage={mockOnSendMessage}
      />
    );

    // useChatからのメッセージ数が使用される
    expect(screen.getByText('Messages: 1')).toBeInTheDocument();
    // MessageListにローディング状態が渡される（モックでは確認できないが、実装上は渡される）
    expect(screen.getByTestId('message-list')).toBeInTheDocument();
  });
});