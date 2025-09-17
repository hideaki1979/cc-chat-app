import { render, screen } from '@testing-library/react';
import { useRouter } from 'next/navigation';
import { DashboardPageClient } from '../../../app/components/pages/DashboardPageClient';
import { useAuthStore } from '../../../app/stores/auth';

// Next.js useRouterのモック
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
}));

// Auth store のモック
jest.mock('../../../app/stores/auth', () => ({
  useAuthStore: jest.fn(),
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

describe('DashboardPageClient', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseRouter.mockReturnValue(mockRouter);
  });

  describe('認証済みユーザー', () => {
    const mockUser = {
      id: '1',
      name: 'テストユーザー',
      email: 'test@example.com',
      created_at: '2024-01-01T00:00:00Z',
    };

    beforeEach(() => {
      mockUseAuthStore.mockReturnValue({
        user: mockUser,
        logout: jest.fn(),
      });
    });

    test('ユーザー情報が正しく表示される', () => {
      render(<DashboardPageClient />);

      expect(screen.getByText('ダッシュボード')).toBeInTheDocument();
      expect(screen.getByText('ようこそ、テストユーザーさん！')).toBeInTheDocument();
      expect(screen.getByText('メールアドレス: test@example.com')).toBeInTheDocument();
      expect(screen.getByText('ユーザーID: 1')).toBeInTheDocument();
    });

    test('チャット開始ボタンがクリック可能', () => {
      render(<DashboardPageClient />);

      const chatButton = screen.getByText('チャットを開始');
      expect(chatButton).toBeInTheDocument();
      expect(chatButton).not.toBeDisabled();
    });

    test('プロフィール設定ボタンが無効状態', () => {
      render(<DashboardPageClient />);

      const profileButton = screen.getByText('近日公開');
      expect(profileButton).toBeInTheDocument();
      expect(profileButton).toBeDisabled();
    });
  });

  describe('未認証ユーザー', () => {
    beforeEach(() => {
      mockUseAuthStore.mockReturnValue({
        user: null,
        logout: jest.fn(),
      });
    });

    test('ローディング状態が表示される', () => {
      render(<DashboardPageClient />);

      expect(screen.getByText('ユーザー情報を読み込み中...')).toBeInTheDocument();
      expect(screen.queryByText('ダッシュボード')).not.toBeInTheDocument();
    });

    test('ローディングスピナーが表示される', () => {
      render(<DashboardPageClient />);

      const spinner = screen.getByText('ユーザー情報を読み込み中...').previousElementSibling;
      expect(spinner).toHaveClass('animate-spin');
    });
  });
});