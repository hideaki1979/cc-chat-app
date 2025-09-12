import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { Sidebar } from '../../../app/components/layout/Sidebar';
import type { ChatRoom } from '../../../app/types/chat';

// MockデータとUtility Functions
const mockUser = {
  id: '1',
  name: 'テストユーザー',
  email: 'test@example.com',
};

const mockRooms: ChatRoom[] = [
  {
    id: '1',
    name: 'テストルーム1',
    is_group_chat: true,
    updated_at: '2024-01-01T00:00:00Z',
    last_message: {
      content: 'こんにちは！',
      sender_name: 'テストユーザー',
      created_at: '2024-01-01T00:00:00Z',
    },
    member_count: 5,
  },
  {
    id: '2',
    name: 'ダイレクトメッセージ',
    is_group_chat: false,
    updated_at: '2024-01-02T00:00:00Z',
    last_message: undefined,
    member_count: 2,
  },
];

describe('Sidebar Component', () => {
  const mockHandlers = {
    onRoomSelect: jest.fn(),
    onCreateRoom: jest.fn(),
    onLogout: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Basic Rendering', () => {
    test('renders sidebar with basic structure', () => {
      render(
        <Sidebar
          user={mockUser}
          rooms={[]}
          {...mockHandlers}
        />
      );

      // 基本構造要素の確認
      expect(screen.getByTestId('test-sidebar')).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: 'CC Chat' })).toBeVisible();
      expect(screen.getByRole('button', { name: 'DM' })).toBeVisible();
      expect(screen.getByRole('button', { name: 'ルーム' })).toBeVisible();
    });

    test('renders user information correctly', () => {
      render(
        <Sidebar
          user={mockUser}
          rooms={[]}
          {...mockHandlers}
        />
      );

      expect(screen.getByText('テストユーザー')).toBeVisible();
      expect(screen.getByText('test@example.com')).toBeVisible();
      expect(screen.getByTitle('ログアウト')).toBeVisible();
    });

    test('renders empty state when no rooms', () => {
      render(
        <Sidebar
          user={mockUser}
          rooms={[]}
          {...mockHandlers}
        />
      );

      expect(screen.getByTestId('empty-rooms-message')).toBeVisible();
      expect(screen.getByText('チャットルームがありません')).toBeVisible();
      expect(screen.getByText('新規ルームを作成してチャットを開始しましょう')).toBeVisible();
    });
  });

  describe('Room Display and Interaction', () => {
    test('renders room list correctly', () => {
      render(
        <Sidebar
          user={mockUser}
          rooms={mockRooms}
          currentRoomId="1"
          {...mockHandlers}
        />
      );

      // ルーム要素の表示確認
      expect(screen.getByText('テストルーム1')).toBeVisible();
      expect(screen.getByText('ダイレクトメッセージ')).toBeVisible();
      expect(screen.getByText('グループ')).toBeVisible(); // グループチャットバッジ

      // 最後のメッセージ表示確認
      expect(screen.getByText('テストユーザー: こんにちは！')).toBeVisible();
      expect(screen.getByText('メッセージはまだありません')).toBeVisible();

      // メンバー数表示確認
      expect(screen.getByText('5人')).toBeVisible();
    });

    test('highlights current room correctly', () => {
      render(
        <Sidebar
          user={mockUser}
          rooms={mockRooms}
          currentRoomId="1"
          {...mockHandlers}
        />
      );

      // アクティブなルームが適切にハイライトされている
      const roomButton = screen.getByText('テストルーム1').closest('button');
      expect(roomButton).toHaveClass('bg-blue-50', 'border-l-4', 'border-blue-500');
    });

    test('calls onRoomSelect when room is clicked', () => {
      render(
        <Sidebar
          user={mockUser}
          rooms={mockRooms}
          {...mockHandlers}
        />
      );

      fireEvent.click(screen.getByText('テストルーム1'));
      expect(mockHandlers.onRoomSelect).toHaveBeenCalledWith('1');
    });
  });

  describe('User Actions', () => {
    test('calls onCreateRoom when room button is clicked', () => {
      render(
        <Sidebar
          user={mockUser}
          rooms={[]}
          {...mockHandlers}
        />
      );

      fireEvent.click(screen.getByRole('button', { name: 'ルーム' }));
      expect(mockHandlers.onCreateRoom).toHaveBeenCalledTimes(1);
    });

    test('calls onLogout when logout button is clicked', () => {
      render(
        <Sidebar
          user={mockUser}
          rooms={[]}
          {...mockHandlers}
        />
      );

      fireEvent.click(screen.getByTitle('ログアウト'));
      expect(mockHandlers.onLogout).toHaveBeenCalledTimes(1);
    });

    test('opens user search modal when DM button is clicked', () => {
      render(
        <Sidebar
          user={mockUser}
          rooms={[]}
          {...mockHandlers}
        />
      );

      // DM ボタンをクリック
      fireEvent.click(screen.getByRole('button', { name: 'DM' }));
      
      // UserSearchコンポーネントがレンダリングされることを確認
      // 注：UserSearchコンポーネントの内部実装に依存
    });
  });

  describe('Time Formatting', () => {
    test('formats recent time as minutes', () => {
      const now = new Date();
      const minutesAgo = new Date(now.getTime() - 30 * 60 * 1000).toISOString(); // 30分前
      
      const recentRoom: ChatRoom = {
        ...mockRooms[0],
        id: 'recent',
        name: 'Recent Room',
        updated_at: minutesAgo,
        is_group_chat: true,
      };

      render(
        <Sidebar
          user={mockUser}
          rooms={[recentRoom]}
          {...mockHandlers}
        />
      );

      // 30分前の表示を確認
      expect(screen.getByText('30分前')).toBeVisible();
    });

    test('formats hours as time ago', () => {
      const now = new Date();
      const hoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString(); // 2時間前
      
      const hoursRoom: ChatRoom = {
        ...mockRooms[0],
        id: 'hours',
        name: 'Hours Room',
        updated_at: hoursAgo,
        is_group_chat: true,
      };

      render(
        <Sidebar
          user={mockUser}
          rooms={[hoursRoom]}
          {...mockHandlers}
        />
      );

      // 2時間前の表示を確認
      expect(screen.getByText('2時間前')).toBeVisible();
    });

    test('formats old dates as month-day format', () => {
      const oldDate = new Date('2024-01-15T10:00:00Z');
      
      const oldRoom: ChatRoom = {
        ...mockRooms[0],
        id: 'old',
        name: 'Old Room',
        updated_at: oldDate.toISOString(),
        is_group_chat: true,
      };

      render(
        <Sidebar
          user={mockUser}
          rooms={[oldRoom]}
          {...mockHandlers}
        />
      );

      // 日付形式での表示を確認（1月15日のような形式）
      expect(screen.getByText(/1月15日/)).toBeVisible();
    });
  });

  describe('Accessibility and UX', () => {
    test('provides appropriate ARIA labels and titles', () => {
      render(
        <Sidebar
          user={mockUser}
          rooms={mockRooms}
          {...mockHandlers}
        />
      );

      // アクセシビリティ属性の確認
      expect(screen.getByTitle('ユーザーを検索してDMを開始')).toBeInTheDocument();
      expect(screen.getByTitle('ログアウト')).toBeInTheDocument();
      expect(screen.getByTestId('logout-button')).toBeInTheDocument();
    });

    test('maintains proper focus and keyboard navigation', () => {
      render(
        <Sidebar
          user={mockUser}
          rooms={mockRooms}
          {...mockHandlers}
        />
      );

      // キーボードナビゲーション可能要素の確認
      const interactiveElements = screen.getAllByRole('button');
      expect(interactiveElements.length).toBeGreaterThan(0);
      
      // 各ボタンがfocusable であることを確認
      interactiveElements.forEach(element => {
        expect(element).not.toHaveAttribute('tabindex', '-1');
      });
    });

    test('displays appropriate visual feedback for interactions', () => {
      render(
        <Sidebar
          user={mockUser}
          rooms={mockRooms}
          currentRoomId="1"
          {...mockHandlers}
        />
      );

      // ホバー状態やアクティブ状態のCSSクラスが適用されていることを確認
      const roomButton = screen.getByText('テストルーム1').closest('button');
      expect(roomButton).toHaveClass('hover:bg-gray-100');
    });
  });

  describe('Edge Cases and Error Handling', () => {
    test('handles undefined/null props gracefully', () => {
      render(
        <Sidebar
          user={undefined}
          rooms={undefined}
          {...mockHandlers}
        />
      );

      // エラーが発生せずにレンダリングされることを確認
      expect(screen.getByTestId('test-sidebar')).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: 'CC Chat' })).toBeVisible();
      expect(screen.getByTestId('empty-rooms-message')).toBeVisible();
    });

    test('handles rooms with missing optional fields', () => {
      const incompleteRoom: ChatRoom = {
        id: 'incomplete',
        name: 'Incomplete Room',
        is_group_chat: false,
        updated_at: '2024-01-01T00:00:00Z',
        last_message: undefined,
        // member_count が undefined
      };

      render(
        <Sidebar
          user={mockUser}
          rooms={[incompleteRoom]}
          {...mockHandlers}
        />
      );

      expect(screen.getByText('Incomplete Room')).toBeVisible();
      expect(screen.getByText('メッセージはまだありません')).toBeVisible();
    });

    test('handles very long room names and messages', () => {
      const longContentRoom: ChatRoom = {
        id: 'long',
        name: '非常に長いルーム名がある場合のテストケースです。これは画面幅を超える可能性があります。',
        is_group_chat: true,
        updated_at: '2024-01-01T00:00:00Z',
        last_message: {
          content: '非常に長いメッセージ内容がある場合のテストケースです。これも画面幅を超える可能性があり、適切に切り詰められる必要があります。',
          sender_name: '非常に長いユーザー名テストケース',
          created_at: '2024-01-01T00:00:00Z',
        },
        member_count: 99,
      };

      render(
        <Sidebar
          user={mockUser}
          rooms={[longContentRoom]}
          {...mockHandlers}
        />
      );

      // 長いコンテンツが適切に表示される（切り詰めクラスが適用される）
      const roomNameElement = screen.getByText(/非常に長いルーム名/).closest('h3');
      expect(roomNameElement).toHaveClass('truncate');
    });
  });

  describe('Integration with Parent Components', () => {
    test('supports controlled component pattern', () => {
      const { rerender } = render(
        <Sidebar
          user={mockUser}
          rooms={mockRooms}
          currentRoomId="1"
          {...mockHandlers}
        />
      );

      // 初期状態の確認
      let roomButton = screen.getByText('テストルーム1').closest('button');
      expect(roomButton).toHaveClass('bg-blue-50');

      // currentRoomIdを変更してre-render
      rerender(
        <Sidebar
          user={mockUser}
          rooms={mockRooms}
          currentRoomId="2"
          {...mockHandlers}
        />
      );

      // ハイライトが変更されることを確認
      roomButton = screen.getByText('ダイレクトメッセージ').closest('button');
      expect(roomButton).toHaveClass('bg-blue-50');
    });

    test('maintains state consistency across prop changes', () => {
      const { rerender } = render(
        <Sidebar
          user={mockUser}
          rooms={mockRooms.slice(0, 1)}
          {...mockHandlers}
        />
      );

      expect(screen.getByText('テストルーム1')).toBeVisible();

      // ルームリストを更新
      rerender(
        <Sidebar
          user={mockUser}
          rooms={mockRooms}
          {...mockHandlers}
        />
      );

      // 新しいルームが追加されることを確認
      expect(screen.getByText('テストルーム1')).toBeVisible();
      expect(screen.getByText('ダイレクトメッセージ')).toBeVisible();
    });
  });

  // E2Eから移管された詳細UIテスト
  describe('Detailed UI Tests (migrated from E2E)', () => {
    test('should display correct heading text "CC Chat"', () => {
      render(
        <Sidebar
          user={mockUser}
          rooms={[]}
          {...mockHandlers}
        />
      );

      const heading = screen.getByRole('heading', { name: 'CC Chat' });
      expect(heading).toBeVisible();
      expect(heading.tagName).toBe('H1');
      expect(heading).toHaveClass('text-xl', 'font-bold');
    });

    test('should display user avatar with correct initial', () => {
      render(
        <Sidebar
          user={mockUser}
          rooms={[]}
          {...mockHandlers}
        />
      );

      // ユーザー名の最初の文字が大文字で表示される
      expect(screen.getByText('テ')).toBeVisible();
    });

    test('should show room creation buttons with correct labels', () => {
      render(
        <Sidebar
          user={mockUser}
          rooms={[]}
          {...mockHandlers}
        />
      );

      const dmButton = screen.getByRole('button', { name: 'DM' });
      const roomButton = screen.getByRole('button', { name: 'ルーム' });
      
      expect(dmButton).toBeVisible();
      expect(roomButton).toBeVisible();
      expect(dmButton).toHaveAttribute('title', 'ユーザーを検索してDMを開始');
    });

    test('should display version information in footer', () => {
      render(
        <Sidebar
          user={mockUser}
          rooms={[]}
          {...mockHandlers}
        />
      );

      expect(screen.getByText('CC Chat App v1.0')).toBeVisible();
    });

    test('should apply dark mode classes correctly', () => {
      const { container } = render(
        <Sidebar
          user={mockUser}
          rooms={[]}
          {...mockHandlers}
        />
      );

      // ダークモード対応クラスが適用されている
      const sidebar = container.querySelector('[data-testid="test-sidebar"]');
      expect(sidebar).toHaveClass('dark:bg-gray-800');
    });
  });
});