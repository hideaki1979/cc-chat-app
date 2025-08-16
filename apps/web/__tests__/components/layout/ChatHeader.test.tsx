import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { ChatHeader } from '../../../app/components/layout/ChatHeader';

describe('ChatHeader Component', () => {
  const defaultProps = {
    roomName: 'テストルーム',
    isGroupChat: true,
    memberCount: 10,
    onlineCount: 5,
    onToggleSidebar: jest.fn(),
    isSidebarOpen: false,
    onRoomSettings: jest.fn(),
    onVideoCall: jest.fn(),
    onVoiceCall: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Basic Rendering', () => {
    test('renders with default props', () => {
      render(<ChatHeader {...defaultProps} />);
      
      expect(screen.getByText('テストルーム')).toBeInTheDocument();
      expect(screen.getByText('10人のメンバー')).toBeInTheDocument();
      expect(screen.getByText('5人オンライン')).toBeInTheDocument();
    });

    test('renders default room name when not provided', () => {
      render(<ChatHeader {...defaultProps} roomName={undefined} />);
      
      expect(screen.getByText('チャットルームを選択してください')).toBeInTheDocument();
    });

    test('renders direct message mode correctly', () => {
      render(<ChatHeader {...defaultProps} isGroupChat={false} onlineCount={1} />);
      
      expect(screen.getByText('オンライン')).toBeInTheDocument();
      expect(screen.queryByText('人のメンバー')).not.toBeInTheDocument();
    });

    test('renders offline status for direct message', () => {
      render(<ChatHeader {...defaultProps} isGroupChat={false} onlineCount={0} />);
      
      expect(screen.getByText('オフライン')).toBeInTheDocument();
    });
  });

  describe('Sidebar Toggle Functionality', () => {
    test('renders hamburger icon when sidebar is closed', () => {
      render(<ChatHeader {...defaultProps} isSidebarOpen={false} />);
      
      const toggleButton = screen.getByRole('button', { name: 'サイドバーを開く' });
      expect(toggleButton).toBeInTheDocument();
      
      // Check for hamburger icon paths
      const svgElement = toggleButton.querySelector('svg');
      expect(svgElement).toBeInTheDocument();
      
      // Check for hamburger menu path (M4 6h16M4 12h16M4 18h16)
      const hamburgerPath = toggleButton.querySelector('path[d="M4 6h16M4 12h16M4 18h16"]');
      expect(hamburgerPath).toBeInTheDocument();
    });

    test('renders close icon when sidebar is open', () => {
      render(<ChatHeader {...defaultProps} isSidebarOpen={true} />);
      
      const toggleButton = screen.getByRole('button', { name: 'サイドバーを閉じる' });
      expect(toggleButton).toBeInTheDocument();
      
      // Check for close icon paths (X icon)
      const closeIconPath = toggleButton.querySelector('path[d="M6 18L18 6M6 6l12 12"]');
      expect(closeIconPath).toBeInTheDocument();
    });

    test('calls onToggleSidebar when clicked', () => {
      const mockToggle = jest.fn();
      render(<ChatHeader {...defaultProps} onToggleSidebar={mockToggle} />);
      
      const toggleButton = screen.getByRole('button', { name: 'サイドバーを開く' });
      fireEvent.click(toggleButton);
      
      expect(mockToggle).toHaveBeenCalledTimes(1);
    });

    test('toggles aria-label based on sidebar state', () => {
      const { rerender } = render(<ChatHeader {...defaultProps} isSidebarOpen={false} />);
      
      expect(screen.getByRole('button', { name: 'サイドバーを開く' })).toBeInTheDocument();
      
      rerender(<ChatHeader {...defaultProps} isSidebarOpen={true} />);
      
      expect(screen.getByRole('button', { name: 'サイドバーを閉じる' })).toBeInTheDocument();
    });
  });

  describe('Action Buttons', () => {
    test('renders and calls voice call handler', () => {
      const mockVoiceCall = jest.fn();
      render(<ChatHeader {...defaultProps} onVoiceCall={mockVoiceCall} />);
      
      const voiceButton = screen.getByRole('button', { name: '音声通話' });
      fireEvent.click(voiceButton);
      
      expect(mockVoiceCall).toHaveBeenCalledTimes(1);
    });

    test('renders and calls video call handler', () => {
      const mockVideoCall = jest.fn();
      render(<ChatHeader {...defaultProps} onVideoCall={mockVideoCall} />);
      
      const videoButton = screen.getByRole('button', { name: 'ビデオ通話' });
      fireEvent.click(videoButton);
      
      expect(mockVideoCall).toHaveBeenCalledTimes(1);
    });

    test('renders and calls room settings handler', () => {
      const mockRoomSettings = jest.fn();
      render(<ChatHeader {...defaultProps} onRoomSettings={mockRoomSettings} />);
      
      const settingsButton = screen.getByRole('button', { name: 'ルーム設定' });
      fireEvent.click(settingsButton);
      
      expect(mockRoomSettings).toHaveBeenCalledTimes(1);
    });

    test('disables action buttons when no room is selected', () => {
      render(<ChatHeader {...defaultProps} roomName="チャットルームを選択してください。" />);
      
      const voiceButton = screen.getByRole('button', { name: '音声通話' });
      const videoButton = screen.getByRole('button', { name: 'ビデオ通話' });
      const settingsButton = screen.getByRole('button', { name: 'ルーム設定' });
      
      expect(voiceButton).toBeDisabled();
      expect(videoButton).toBeDisabled();
      expect(settingsButton).toBeDisabled();
    });
  });

  describe('Group Chat vs Direct Message UI', () => {
    test('shows group icon for group chats', () => {
      render(<ChatHeader {...defaultProps} isGroupChat={true} />);
      
      // Find the group icon by looking for the specific path
      const groupIconPath = document.querySelector('path[d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3z"]');
      expect(groupIconPath).toBeInTheDocument();
    });

    test('shows user icon for direct messages', () => {
      render(<ChatHeader {...defaultProps} isGroupChat={false} />);
      
      // Find the user icon by looking for the specific path and fill-rule
      const userIconPath = document.querySelector('path[fill-rule="evenodd"][d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z"]');
      expect(userIconPath).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    test('has proper button roles and labels', () => {
      render(<ChatHeader {...defaultProps} />);
      
      expect(screen.getByRole('button', { name: 'サイドバーを開く' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: '音声通話' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'ビデオ通話' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'ルーム設定' })).toBeInTheDocument();
    });

    test('has proper heading structure', () => {
      render(<ChatHeader {...defaultProps} />);
      
      const heading = screen.getByRole('heading', { level: 2 });
      expect(heading).toHaveTextContent('テストルーム');
    });
  });

  describe('Edge Cases', () => {
    test('handles undefined member count gracefully', () => {
      render(<ChatHeader {...defaultProps} memberCount={undefined} />);
      
      expect(screen.queryByText(/人のメンバー/)).not.toBeInTheDocument();
    });

    test('handles undefined online count gracefully', () => {
      render(<ChatHeader {...defaultProps} onlineCount={undefined} />);
      
      expect(screen.queryByText(/人オンライン/)).not.toBeInTheDocument();
      expect(screen.queryByText(/オンライン|オフライン/)).not.toBeInTheDocument();
    });

    test('handles missing callback functions gracefully', () => {
      render(<ChatHeader {...defaultProps} onToggleSidebar={undefined} />);
      
      const toggleButton = screen.getByRole('button', { name: 'サイドバーを開く' });
      
      // Should not throw error when clicking
      expect(() => {
        fireEvent.click(toggleButton);
      }).not.toThrow();
    });
  });
});