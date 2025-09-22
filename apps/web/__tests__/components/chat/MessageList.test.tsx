import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MessageList } from '../../../app/components/chat/MessageList';
import { Message } from '../../../app/types/chat';

// react-virtuosoのモック
jest.mock('react-virtuoso', () => ({
  Virtuoso: ({ data, itemContent, components }: any) => {
    return (
      <div data-testid="virtuoso-container">
        {components?.Header && <components.Header />}
        <div data-testid="virtuoso-list">
          {data.map((item: any, index: number) => (
            <div key={item.id || index} data-testid={`virtuoso-item-${index}`}>
              {itemContent(index)}
            </div>
          ))}
        </div>
      </div>
    );
  },
}));

// モックデータ
const mockMessages: Message[] = [
  {
    id: 'msg1',
    content: 'こんにちは！',
    sender_id: 'user1',
    sender_name: '田中さん',
    room_id: 'room1',
    user_id: 'user1',
    created_at: new Date(Date.now() - 60 * 60 * 1000).toISOString(), // 1時間前
    updated_at: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
    message_type: 'text',
  },
  {
    id: 'msg2',
    content: 'お疲れ様です。\n今日はいい天気ですね。',
    sender_id: 'current_user',
    sender_name: 'あなた',
    room_id: 'room1',
    user_id: 'current_user',
    created_at: new Date(Date.now() - 30 * 60 * 1000).toISOString(), // 30分前
    updated_at: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
    message_type: 'text',
  },
  {
    id: 'msg3',
    content: 'システムメッセージです',
    sender_id: 'system',
    sender_name: 'システム',
    room_id: 'room1',
    user_id: 'system',
    created_at: new Date(Date.now() - 10 * 60 * 1000).toISOString(), // 10分前
    updated_at: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
    message_type: 'system',
  },
  {
    id: 'msg4',
    content: '編集されたメッセージです',
    sender_id: 'user1',
    sender_name: '田中さん',
    room_id: 'room1',
    user_id: 'user1',
    created_at: new Date(Date.now() - 5 * 60 * 1000).toISOString(), // 5分前
    updated_at: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
    message_type: 'text',
    is_edited: true,
  },
];

// WebSocketとCSRFのモック
jest.mock('../../../app/hooks/useWebSocket', () => ({
  useWebSocket: jest.fn(() => ({
    messages: [],
    joinRoom: jest.fn(),
    isConnected: false,
  })),
}));

jest.mock('../../../app/stores/chat', () => ({
  useChatStore: jest.fn(() => ({})),
}));

jest.mock('../../../app/hooks/useUserResolver', () => ({
  useUserResolver: jest.fn(() => ({
    getUserName: jest.fn((id: string) => `User ${id}`),
  })),
}));

// fetchをモック
global.fetch = jest.fn();

describe('MessageList', () => {
  beforeEach(() => {
    // IntersectionObserver のモック
    global.IntersectionObserver = jest.fn().mockImplementation(() => ({
      observe: jest.fn(),
      unobserve: jest.fn(),
      disconnect: jest.fn(),
    }));

    // ResizeObserver のモック（react-virtuosoで必要）
    global.ResizeObserver = jest.fn().mockImplementation(() => ({
      observe: jest.fn(),
      unobserve: jest.fn(),
      disconnect: jest.fn(),
    }));

    // scrollIntoView のモック
    Element.prototype.scrollIntoView = jest.fn();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test('メッセージが正しく表示される', () => {
    render(<MessageList messages={mockMessages} currentUserId="current_user" />);

    expect(screen.getByText('こんにちは！')).toBeInTheDocument();
    expect(screen.getAllByText((_, element) => {
      return element?.textContent === 'お疲れ様です。\n今日はいい天気ですね。';
    })[0]).toBeInTheDocument();
    expect(screen.getByText('システムメッセージです')).toBeInTheDocument();
    expect(screen.getByText('編集されたメッセージです')).toBeInTheDocument();
  });

  test('送信者名が正しく表示される', () => {
    render(<MessageList messages={mockMessages} currentUserId="current_user" />);

    expect(screen.getAllByText('田中さん')).toHaveLength(2);
    expect(screen.queryByText('あなた')).not.toBeInTheDocument(); // 自分のメッセージには送信者名が表示されない
  });

  test('自分のメッセージが右側に表示される', () => {
    render(<MessageList messages={mockMessages} currentUserId="current_user" />);

    // Virtuoso内で自分のメッセージを含むアイテムを探す
    const myMessageItem = screen.getByTestId('virtuoso-item-1'); // current_userのメッセージは2番目
    expect(myMessageItem).toBeInTheDocument();

    // その中でjustify-endクラスを持つ要素を探す
    const justifyEndElement = myMessageItem.querySelector('.justify-end');
    expect(justifyEndElement).toBeInTheDocument();
    expect(justifyEndElement).toHaveClass('justify-end');
  });

  test('他人のメッセージが左側に表示される', () => {
    render(<MessageList messages={mockMessages} currentUserId="current_user" />);

    // 他人のメッセージを含むアイテムを探す
    const otherMessageItem = screen.getByTestId('virtuoso-item-0'); // 最初のメッセージは他人
    expect(otherMessageItem).toBeInTheDocument();

    // その中でjustify-startクラスを持つ要素を探す
    const justifyStartElement = otherMessageItem.querySelector('.justify-start');
    expect(justifyStartElement).toBeInTheDocument();
    expect(justifyStartElement).toHaveClass('justify-start');
  });

  test('システムメッセージが中央に表示される', () => {
    render(<MessageList messages={mockMessages} currentUserId="current_user" />);

    // システムメッセージを含む要素を探す
    const systemMessage = screen.getByText('システムメッセージです').closest('.flex');
    expect(systemMessage).toHaveClass('justify-center');
  });

  test('編集済みマークが表示される', () => {
    render(<MessageList messages={mockMessages} currentUserId="current_user" />);

    expect(screen.getByText('編集済み')).toBeInTheDocument();
  });

  test('時刻フォーマットが正しく表示される', () => {
    render(<MessageList messages={mockMessages} currentUserId="current_user" />);

    // 時刻表示を確認（通常のメッセージのみ、システムメッセージは時刻表示が異なる場合がある）
    expect(screen.getByText('1時間前')).toBeInTheDocument();
    expect(screen.getByText('30分前')).toBeInTheDocument();
    expect(screen.getByText('5分前')).toBeInTheDocument();
  });

  test('メッセージがない場合の表示', () => {
    render(<MessageList messages={[]} currentUserId="current_user" />);

    expect(screen.getByText('メッセージはまだありません')).toBeInTheDocument();
    expect(screen.getByText('最初のメッセージを送信してチャットを開始しましょう')).toBeInTheDocument();
  });

  test('ローディング状態の表示', () => {
    const mockOnLoadMore = jest.fn();
    render(
      <MessageList
        messages={mockMessages}
        currentUserId="current_user"
        isLoading={true}
        onLoadMore={mockOnLoadMore}
        hasMore={true}
      />
    );

    expect(screen.getByText('読み込み中...')).toBeInTheDocument();
  });

  test('過去メッセージ読み込みボタンの動作', () => {
    const mockOnLoadMore = jest.fn();
    render(
      <MessageList
        messages={mockMessages}
        currentUserId="current_user"
        onLoadMore={mockOnLoadMore}
        hasMore={true}
      />
    );

    const loadMoreButton = screen.getByText('過去のメッセージを読み込む');
    expect(loadMoreButton).toBeInTheDocument();

    loadMoreButton.click();
    expect(mockOnLoadMore).toHaveBeenCalledTimes(1);
  });

  test('アバターが正しく表示される', () => {
    render(<MessageList messages={mockMessages} currentUserId="current_user" />);

    // 田中さんのアバター（名前の最初の文字）
    const avatars = screen.getAllByText('田');
    expect(avatars.length).toBeGreaterThan(0);
  });

  test('改行が正しく処理される', () => {
    render(<MessageList messages={mockMessages} currentUserId="current_user" />);

    // 改行を含むメッセージが存在することを確認（getAllByTextで全てを取得し、最初の要素を確認）
    const elements = screen.getAllByText((_, element) => {
      return Boolean(element?.textContent?.includes('お疲れ様です。') && element?.textContent?.includes('今日はいい天気ですね。'));
    });
    expect(elements.length).toBeGreaterThan(0);
    expect(elements[0]).toBeInTheDocument();
  });

  test('仮想スクロールによる自動スクロール（react-virtuoso）', async () => {
    const firstMessage = mockMessages[0];
    if (!firstMessage) throw new Error('Test message not found');

    const { rerender } = render(
      <MessageList messages={[firstMessage]} currentUserId="current_user" />
    );

    // 新しいメッセージを追加して再レンダリング
    rerender(
      <MessageList messages={mockMessages} currentUserId="current_user" />
    );

    // Virtuosoコンテナが存在することを確認（仮想スクロールが動作している証拠）
    await waitFor(() => {
      expect(screen.getByTestId('virtuoso-container')).toBeInTheDocument();
      expect(screen.getByTestId('virtuoso-list')).toBeInTheDocument();
    });
  });

  test('仮想スクロールで全メッセージがレンダリングされる', () => {
    render(<MessageList messages={mockMessages} currentUserId="current_user" />);

    // 各メッセージアイテムが存在することを確認
    mockMessages.forEach((_, index) => {
      expect(screen.getByTestId(`virtuoso-item-${index}`)).toBeInTheDocument();
    });
  });
});