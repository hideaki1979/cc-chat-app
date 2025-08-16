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
});