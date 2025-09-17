import { render, screen } from '@testing-library/react';
import { useRouter } from 'next/navigation';
import { ChatPageClient } from '../../../app/components/pages/ChatPageClient';
import { useAuthStore } from '../../../app/stores/auth';

// Next.js useRouterのモック
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
}));

// Auth store のモック
jest.mock('../../../app/stores/auth', () => ({
  useAuthStore: jest.fn(),
}));

// Layout componentsの型定義
interface MockChatLayoutProps {
  children: React.ReactNode;
  sidebar: React.ReactNode;
  header: (props: { onToggleSidebar: () => void; isSidebarOpen: boolean }) => React.ReactNode;
}

interface MockSidebarProps {
  user?: {
    id: string;
    name: string;
    email: string;
  };
}

// Layout componentsのモック
jest.mock('../../../app/components/layout', () => ({
  ChatLayout: ({ children, sidebar, header }: MockChatLayoutProps) => (
    <div data-testid="chat-layout">
      <div data-testid="sidebar">{sidebar}</div>
      <div data-testid="header">{header({ onToggleSidebar: jest.fn(), isSidebarOpen: false })}</div>
      <div data-testid="main-content">{children}</div>
    </div>
  ),
  Sidebar: ({ user }: MockSidebarProps) => (
    <div data-testid="sidebar-component">
      {user ? `User: ${user.name}` : 'No user'}
    </div>
  ),
  ChatHeader: () => <div data-testid="chat-header">Chat Header</div>,
}));

// Next.js AppRouterInstanceの完全な型定義
const mockRouter = {
  push: jest.fn(),
  replace: jest.fn(),
  prefetch: jest.fn(),
  back: jest.fn(),
  forward: jest.fn(),
  refresh: jest.fn(),
};

const mockUseRouter = useRouter as jest.MockedFunction<typeof useRouter>;
const mockUseAuthStore = useAuthStore as jest.MockedFunction<typeof useAuthStore>;

describe('ChatPageClient', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseRouter.mockReturnValue(mockRouter);
  });

  describe('認証済みユーザー', () => {
    const mockUser = {
      id: '1',
      name: 'テストユーザー',
      email: 'test@example.com',
    };

    beforeEach(() => {
      mockUseAuthStore.mockReturnValue({
        user: mockUser,
        logout: jest.fn(),
      });
    });

    test('チャットレイアウトが正しく表示される', () => {
      render(<ChatPageClient />);

      expect(screen.getByTestId('chat-layout')).toBeInTheDocument();
      expect(screen.getByTestId('sidebar')).toBeInTheDocument();
      expect(screen.getByTestId('header')).toBeInTheDocument();
      expect(screen.getByTestId('main-content')).toBeInTheDocument();
    });

    test('サイドバーにユーザー情報が表示される', () => {
      render(<ChatPageClient />);

      expect(screen.getByText('User: テストユーザー')).toBeInTheDocument();
    });

    test('チャットプレースホルダーが表示される', () => {
      render(<ChatPageClient />);

      expect(screen.getByTestId('chat-placeholder')).toBeInTheDocument();
      expect(screen.getByTestId('welcome-message')).toBeInTheDocument();
      expect(screen.getByText('左のサイドバーからチャットルームを選択するか、')).toBeInTheDocument();
    });

    test('ダッシュボードに戻るボタンが機能する', () => {
      render(<ChatPageClient />);

      const backButton = screen.getByTestId('back-to-dashboard-button');
      expect(backButton).toBeInTheDocument();
      expect(backButton).toHaveTextContent('ダッシュボードに戻る');
    });
  });

  describe('未認証ユーザー', () => {
    beforeEach(() => {
      mockUseAuthStore.mockReturnValue({
        user: null,
        logout: jest.fn(),
      });
    });

    test('ユーザー情報なしでもレイアウトが表示される', () => {
      render(<ChatPageClient />);

      expect(screen.getByTestId('chat-layout')).toBeInTheDocument();
      expect(screen.getByText('No user')).toBeInTheDocument();
    });
  });
});