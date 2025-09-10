import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { ChatLayout } from '../../../app/components/layout/ChatLayout';

describe('ChatLayout Component', () => {
  const mockToggleSidebar = jest.fn();
  
  const TestHeader: React.FC<{ onToggleSidebar: () => void; isSidebarOpen: boolean; testProp?: string }> = ({
    onToggleSidebar,
    isSidebarOpen,
    testProp
  }) => (
    <div data-testid="test-header">
      <button onClick={onToggleSidebar}>
        {isSidebarOpen ? 'Close' : 'Open'} Sidebar
      </button>
      {testProp && <span data-testid="test-prop">{testProp}</span>}
    </div>
  );

  const TestSidebar: React.FC = () => (
    <div data-testid="test-sidebar">Test Sidebar Content</div>
  );

  const TestContent: React.FC = () => (
    <div data-testid="test-content">Test Main Content</div>
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Basic Rendering', () => {
    test('renders without header and sidebar', () => {
      render(
        <ChatLayout>
          <TestContent />
        </ChatLayout>
      );

      expect(screen.getByTestId('test-content')).toBeInTheDocument();
      expect(screen.queryByTestId('test-header')).not.toBeInTheDocument();
      expect(screen.queryByTestId('test-sidebar')).not.toBeInTheDocument();
    });

    test('renders with sidebar', () => {
      render(
        <ChatLayout sidebar={<TestSidebar />}>
          <TestContent />
        </ChatLayout>
      );

      expect(screen.getByTestId('test-content')).toBeInTheDocument();
      expect(screen.getByTestId('test-sidebar')).toBeInTheDocument();
    });

    test('renders with header using Render Props pattern', () => {
      render(
        <ChatLayout
          header={(props) => <TestHeader {...props} testProp="test-value" />}
          sidebar={<TestSidebar />}
        >
          <TestContent />
        </ChatLayout>
      );

      expect(screen.getByTestId('test-content')).toBeInTheDocument();
      expect(screen.getByTestId('test-sidebar')).toBeInTheDocument();
      expect(screen.getByTestId('test-header')).toBeInTheDocument();
      expect(screen.getByTestId('test-prop')).toHaveTextContent('test-value');
    });
  });

  describe('Render Props Pattern', () => {
    test('passes correct props to header render function', () => {
      const headerSpy = jest.fn((props) => <TestHeader {...props} />);
      
      render(
        <ChatLayout header={headerSpy} sidebar={<TestSidebar />}>
          <TestContent />
        </ChatLayout>
      );

      expect(headerSpy).toHaveBeenCalledWith({
        onToggleSidebar: expect.any(Function),
        isSidebarOpen: true, // Default state
      });
    });

    test('header function receives updated sidebar state', () => {
      let capturedProps: any = null;
      const headerSpy = jest.fn((props) => {
        capturedProps = props;
        return <TestHeader {...props} />;
      });
      
      render(
        <ChatLayout header={headerSpy} sidebar={<TestSidebar />}>
          <TestContent />
        </ChatLayout>
      );

      // Initial state should be open (true)
      expect(capturedProps.isSidebarOpen).toBe(true);
      
      // Click toggle button
      const toggleButton = screen.getByText('Close Sidebar');
      fireEvent.click(toggleButton);

      // State should now be closed (false)
      expect(capturedProps.isSidebarOpen).toBe(false);
      expect(screen.getByText('Open Sidebar')).toBeInTheDocument();
    });

    test('allows custom props in addition to injected props', () => {
      render(
        <ChatLayout
          header={(props) => (
            <TestHeader {...props} testProp="custom-prop-value" />
          )}
          sidebar={<TestSidebar />}
        >
          <TestContent />
        </ChatLayout>
      );

      expect(screen.getByTestId('test-prop')).toHaveTextContent('custom-prop-value');
    });
  });

  describe('Sidebar State Management', () => {
    test('sidebar is open by default', () => {
      render(
        <ChatLayout
          header={(props) => <TestHeader {...props} />}
          sidebar={<TestSidebar />}
        >
          <TestContent />
        </ChatLayout>
      );

      expect(screen.getByText('Close Sidebar')).toBeInTheDocument();
    });

    test('toggles sidebar state when toggle function is called', () => {
      render(
        <ChatLayout
          header={(props) => <TestHeader {...props} />}
          sidebar={<TestSidebar />}
        >
          <TestContent />
        </ChatLayout>
      );

      // Initially closed text should show 'Close' (sidebar is open)
      expect(screen.getByText('Close Sidebar')).toBeInTheDocument();

      // Click to toggle
      fireEvent.click(screen.getByText('Close Sidebar'));

      // Now should show 'Open' (sidebar is closed)
      expect(screen.getByText('Open Sidebar')).toBeInTheDocument();

      // Click again to toggle back
      fireEvent.click(screen.getByText('Open Sidebar'));

      // Should show 'Close' again (sidebar is open)
      expect(screen.getByText('Close Sidebar')).toBeInTheDocument();
    });
  });

  describe('CSS Classes and Styling', () => {
    test('applies correct CSS classes for sidebar state', () => {
      const { container } = render(
        <ChatLayout
          header={(props) => <TestHeader {...props} />}
          sidebar={<TestSidebar />}
        >
          <TestContent />
        </ChatLayout>
      );

      // Find sidebar element
      const sidebarElement = container.querySelector('.fixed.inset-y-0.left-0');
      expect(sidebarElement).toBeInTheDocument();

      // Initially open (translate-x-0)
      expect(sidebarElement).toHaveClass('translate-x-0');
      expect(sidebarElement).not.toHaveClass('-translate-x-full');

      // Click to close
      fireEvent.click(screen.getByText('Close Sidebar'));

      // Should now be closed (-translate-x-full)
      expect(sidebarElement).toHaveClass('-translate-x-full');
      expect(sidebarElement).not.toHaveClass('translate-x-0');
    });

    test('shows overlay when sidebar is open on mobile', () => {
      const { container } = render(
        <ChatLayout
          header={(props) => <TestHeader {...props} />}
          sidebar={<TestSidebar />}
        >
          <TestContent />
        </ChatLayout>
      );

      // Find overlay element
      const overlay = container.querySelector('.fixed.inset-0.z-40.bg-black.bg-opacity-50.lg\\:hidden');
      expect(overlay).toBeInTheDocument();
    });

    test('hides overlay when sidebar is closed', () => {
      const { container } = render(
        <ChatLayout
          header={(props) => <TestHeader {...props} />}
          sidebar={<TestSidebar />}
        >
          <TestContent />
        </ChatLayout>
      );

      // Click to close sidebar
      fireEvent.click(screen.getByText('Close Sidebar'));

      // Overlay should not be present
      const overlay = container.querySelector('.fixed.inset-0.z-40.bg-black.bg-opacity-50.lg\\:hidden');
      expect(overlay).not.toBeInTheDocument();
    });
  });

  describe('Overlay Interaction', () => {
    test('clicking overlay closes sidebar', () => {
      const { container } = render(
        <ChatLayout
          header={(props) => <TestHeader {...props} />}
          sidebar={<TestSidebar />}
        >
          <TestContent />
        </ChatLayout>
      );

      // Initially sidebar is open
      expect(screen.getByText('Close Sidebar')).toBeInTheDocument();

      // Find and click overlay
      const overlay = container.querySelector('.fixed.inset-0.z-40.bg-black.bg-opacity-50.lg\\:hidden');
      expect(overlay).toBeInTheDocument();
      
      fireEvent.click(overlay!);

      // Sidebar should now be closed
      expect(screen.getByText('Open Sidebar')).toBeInTheDocument();
    });
  });

  describe('Type Safety', () => {
    test('header render function has correct TypeScript types', () => {
      // This test ensures that the TypeScript compiler would catch type errors
      const typedHeader = (props: { onToggleSidebar: () => void; isSidebarOpen: boolean }) => {
        // TypeScript should enforce that these properties exist and have correct types
        const toggleFunction: () => void = props.onToggleSidebar;
        const sidebarState: boolean = props.isSidebarOpen;
        
        return (
          <div>
            <button onClick={toggleFunction}>
              {sidebarState ? 'Close' : 'Open'}
            </button>
          </div>
        );
      };

      render(
        <ChatLayout header={typedHeader} sidebar={<TestSidebar />}>
          <TestContent />
        </ChatLayout>
      );

      expect(screen.getByText('Close')).toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    test('handles undefined header gracefully', () => {
      render(
        <ChatLayout header={undefined} sidebar={<TestSidebar />}>
          <TestContent />
        </ChatLayout>
      );

      expect(screen.getByTestId('test-content')).toBeInTheDocument();
      expect(screen.getByTestId('test-sidebar')).toBeInTheDocument();
      expect(screen.queryByTestId('test-header')).not.toBeInTheDocument();
    });

    test('handles undefined sidebar gracefully', () => {
      render(
        <ChatLayout
          header={(props) => <TestHeader {...props} />}
          sidebar={undefined}
        >
          <TestContent />
        </ChatLayout>
      );

      expect(screen.getByTestId('test-content')).toBeInTheDocument();
      expect(screen.getByTestId('test-header')).toBeInTheDocument();
      expect(screen.queryByTestId('test-sidebar')).not.toBeInTheDocument();
    });

    test('header function can return null', () => {
      render(
        <ChatLayout
          header={() => null}
          sidebar={<TestSidebar />}
        >
          <TestContent />
        </ChatLayout>
      );

      expect(screen.getByTestId('test-content')).toBeInTheDocument();
      expect(screen.getByTestId('test-sidebar')).toBeInTheDocument();
      expect(screen.queryByTestId('test-header')).not.toBeInTheDocument();
    });

    test('maintains sidebar state consistency across re-renders', () => {
      const { rerender } = render(
        <ChatLayout
          header={(props) => <TestHeader {...props} />}
          sidebar={<TestSidebar />}
        >
          <TestContent />
        </ChatLayout>
      );

      // Close sidebar
      fireEvent.click(screen.getByText('Close Sidebar'));
      expect(screen.getByText('Open Sidebar')).toBeInTheDocument();

      // Re-render with same props
      rerender(
        <ChatLayout
          header={(props) => <TestHeader {...props} />}
          sidebar={<TestSidebar />}
        >
          <TestContent />
        </ChatLayout>
      );

      // State should be preserved
      expect(screen.getByText('Open Sidebar')).toBeInTheDocument();
    });
  });

  // E2Eから移管：詳細UIテスト
  describe('Detailed UI State Tests (from E2E)', () => {
    test('should display chat layout with sidebar and header', () => {
      render(
        <ChatLayout
          header={(props) => <TestHeader {...props} />}
          sidebar={<TestSidebar />}
        >
          <TestContent />
        </ChatLayout>
      );

      // サイドバー内容の確認
      expect(screen.getByTestId('test-sidebar')).toBeInTheDocument();
      expect(screen.getByText('Test Sidebar Content')).toBeVisible();
      
      // メインエリアの確認
      expect(screen.getByTestId('test-content')).toBeInTheDocument();
      expect(screen.getByText('Test Main Content')).toBeVisible();
      
      // ヘッダーの確認
      expect(screen.getByTestId('test-header')).toBeInTheDocument();
    });

    test('should toggle sidebar using hamburger menu simulation', () => {
      const { container } = render(
        <ChatLayout
          header={(props) => <TestHeader {...props} />}
          sidebar={<TestSidebar />}
        >
          <TestContent />
        </ChatLayout>
      );

      // 初期状態でサイドバーが表示されていることを確認
      const sidebarElement = container.querySelector('.fixed.inset-y-0.left-0');
      expect(sidebarElement).toHaveClass('translate-x-0');

      // ハンバーガーメニュー（トグルボタン）をクリック
      const toggleButton = screen.getByText('Close Sidebar');
      fireEvent.click(toggleButton);

      // サイドバーが非表示になることを確認
      expect(sidebarElement).toHaveClass('-translate-x-full');
      expect(screen.getByText('Open Sidebar')).toBeInTheDocument();
    });

    test('should show overlay when sidebar is open', () => {
      const { container } = render(
        <ChatLayout
          header={(props) => <TestHeader {...props} />}
          sidebar={<TestSidebar />}
        >
          <TestContent />
        </ChatLayout>
      );

      // サイドバーが開いているときはオーバーレイが表示される
      const overlay = container.querySelector('.fixed.inset-0.z-40.bg-black.bg-opacity-50.lg\\:hidden');
      expect(overlay).toBeInTheDocument();
    });

    test('should close sidebar when clicking overlay', () => {
      const { container } = render(
        <ChatLayout
          header={(props) => <TestHeader {...props} />}
          sidebar={<TestSidebar />}
        >
          <TestContent />
        </ChatLayout>
      );

      // 初期状態：サイドバーが開いている
      expect(screen.getByText('Close Sidebar')).toBeInTheDocument();

      // オーバーレイをクリックしてサイドバーを閉じる
      const overlay = container.querySelector('.fixed.inset-0.z-40.bg-black.bg-opacity-50.lg\\:hidden');
      fireEvent.click(overlay!);

      // サイドバーが閉じられることを確認
      expect(screen.getByText('Open Sidebar')).toBeInTheDocument();
    });

    test('should be responsive on different screen sizes (simulation)', () => {
      const { container } = render(
        <ChatLayout
          header={(props) => <TestHeader {...props} />}
          sidebar={<TestSidebar />}
        >
          <TestContent />
        </ChatLayout>
      );

      // デスクトップビューのシミュレーション - サイドバーが常に表示
      const sidebarElement = container.querySelector('.fixed.inset-y-0.left-0');
      expect(sidebarElement).toHaveClass('translate-x-0'); // デフォルト状態

      // モバイルビューの動作をシミュレート - ハンバーガーメニューが表示される想定
      const toggleButton = screen.getByText('Close Sidebar');
      expect(toggleButton).toBeInTheDocument();

      // モバイルでのサイドバー制御テスト
      fireEvent.click(toggleButton);
      expect(sidebarElement).toHaveClass('-translate-x-full');
    });

    test('should display appropriate content when no specific state is selected', () => {
      render(
        <ChatLayout
          header={(props) => <TestHeader {...props} />}
          sidebar={<TestSidebar />}
        >
          <div data-testid="welcome-message">Welcome Message</div>
          <div>左のサイドバーからチャットルームを選択するか、</div>
        </ChatLayout>
      );

      // プレースホルダーコンテンツが適切に表示されることを確認
      expect(screen.getByTestId('welcome-message')).toBeVisible();
      expect(screen.getByText('左のサイドバーからチャットルームを選択するか、')).toBeVisible();
    });

    test('should handle authentication state properly in layout', () => {
      // 未認証状態のシミュレーション
      render(
        <ChatLayout>
          <div data-testid="auth-required">認証が必要です</div>
        </ChatLayout>
      );

      // レイアウトが認証状態に応じて適切にレンダリングされることを確認
      expect(screen.getByTestId('auth-required')).toBeInTheDocument();
      expect(screen.getByText('認証が必要です')).toBeVisible();
      
      // サイドバーやヘッダーが表示されないことを確認（認証が必要な場合）
      expect(screen.queryByTestId('test-sidebar')).not.toBeInTheDocument();
      expect(screen.queryByTestId('test-header')).not.toBeInTheDocument();
    });

    test('should maintain layout integrity across different content types', () => {
      const { rerender } = render(
        <ChatLayout
          header={(props) => <TestHeader {...props} />}
          sidebar={<TestSidebar />}
        >
          <div data-testid="chat-content">Chat Messages</div>
        </ChatLayout>
      );

      // チャットコンテンツが表示されることを確認
      expect(screen.getByTestId('chat-content')).toBeInTheDocument();
      expect(screen.getByText('Chat Messages')).toBeVisible();

      // 異なるコンテンツタイプに変更
      rerender(
        <ChatLayout
          header={(props) => <TestHeader {...props} />}
          sidebar={<TestSidebar />}
        >
          <div data-testid="dashboard-content">Dashboard</div>
        </ChatLayout>
      );

      // 新しいコンテンツが表示され、レイアウトが維持されることを確認
      expect(screen.getByTestId('dashboard-content')).toBeInTheDocument();
      expect(screen.getByText('Dashboard')).toBeVisible();
      expect(screen.getByTestId('test-sidebar')).toBeInTheDocument();
      expect(screen.getByTestId('test-header')).toBeInTheDocument();
    });
  });
});