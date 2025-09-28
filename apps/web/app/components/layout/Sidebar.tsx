'use client';

import React, { useState } from 'react';
import dynamic from 'next/dynamic';
import { Button } from '@repo/ui/button';
import type { ChatRoom } from '../../types/chat';

// UserSearchを動的インポート化（検索機能は使用時のみロード）
const UserSearch = dynamic(() =>
  import('../chat/UserSearch').then(mod => ({ default: mod.UserSearch })),
  {
    loading: () => (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6">
          <div className="flex items-center space-x-2 text-gray-500 dark:text-gray-400">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-500"></div>
            <span>検索機能を読み込み中...</span>
          </div>
        </div>
      </div>
    ),
    ssr: false // ユーザー検索はクライアント側でのみ動作
  }
);

interface SidebarProps {
  rooms?: ChatRoom[];
  currentRoomId?: string;
  onRoomSelect?: (roomId: string) => void;
  onCreateRoom?: () => void;
  user?: {
    id: string;
    name: string;
    email: string;
  };
  onLogout?: () => void;
  onCloseSidebar?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  rooms = [],
  currentRoomId,
  onRoomSelect,
  onCreateRoom,
  user,
  onLogout,
  onCloseSidebar,
}) => {
  const [isUserSearchOpen, setIsUserSearchOpen] = useState(false);
  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));

    if (hours < 1) {
      const minutes = Math.floor(diff / (1000 * 60));
      return `${minutes}分前`;
    } else if (hours < 24) {
      return `${hours}時間前`;
    } else {
      return date.toLocaleDateString('ja-JP', {
        month: 'short',
        day: 'numeric',
      });
    }
  };

  return (
    <div
      className="flex flex-col h-full bg-white dark:bg-gray-800"
      data-testid="test-sidebar"
    >
      {/* ヘッダー部分 */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">
            CC Chat
          </h1>
          <div className="flex space-x-2">
            {/* モバイル用サイドバー閉じるボタン */}
            <button
              className="lg:hidden p-1 rounded-md text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-gray-700 transition-colors"
              aria-label="サイドバーを閉じる"
              title="サイドバーを閉じる"
              onClick={onCloseSidebar}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <Button
              onClick={() => setIsUserSearchOpen(true)}
              size="sm"
              variant="secondary"
              className="text-sm"
              title="ユーザーを検索してDMを開始"
            >
              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              DM
            </Button>
            <Button
              onClick={onCreateRoom}
              size="sm"
              variant="primary"
              className="text-sm"
            >
              ルーム
            </Button>
          </div>
        </div>

        {/* ユーザー情報 */}
        {user && (
          <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
            <div className="flex items-center space-x-3 flex-1 min-w-0">
              <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center flex-shrink-0">
                <span className="text-white text-sm font-bold">
                  {user.name.charAt(0).toUpperCase()}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                  {user.name}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                  {user.email}
                </p>
              </div>
            </div>
            <button
              onClick={onLogout}
              className="flex-shrink-0 ml-2 p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-md transition-colors"
              title="ログアウト"
              data-testid="logout-button"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          </div>
        )}
      </div>

      {/* ルーム一覧 */}
      <div className="flex-1 overflow-y-auto">
        {rooms.length === 0 ? (
          <div className="p-4 text-center" data-testid="empty-rooms-message">
            <div className="text-gray-500 dark:text-gray-400 text-sm">
              <p className="mb-2">チャットルームがありません</p>
              <p>新規ルームを作成してチャットを開始しましょう</p>
            </div>
          </div>
        ) : (
          <div className="space-y-1 p-2">
            {rooms.map((room) => (
              <button
                key={room.id}
                onClick={() => onRoomSelect?.(room.id)}
                className={`
                  w-full text-left p-3 rounded-lg transition-colors duration-200
                  hover:bg-gray-100 dark:hover:bg-gray-700
                  ${currentRoomId === room.id
                    ? 'bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-500'
                    : ''
                  }
                `}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-2 mb-1">
                      <h3 className="text-sm font-medium text-gray-900 dark:text-white truncate">
                        {room.name}
                      </h3>
                      {room.is_group_chat && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                          グループ
                        </span>
                      )}
                    </div>

                    {room.last_message ? (
                      <p className="text-xs text-gray-600 dark:text-gray-400 truncate">
                        {room.last_message.sender_name}: {room.last_message.content}
                      </p>
                    ) : (
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        メッセージはまだありません
                      </p>
                    )}
                  </div>

                  <div className="flex flex-col items-end ml-2">
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      {formatTime(room.updated_at)}
                    </span>
                    {room.member_count && room.is_group_chat && (
                      <span className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        {room.member_count}人
                      </span>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* フッター */}
      <div className="p-4 border-t border-gray-200 dark:border-gray-700">
        <div className="text-xs text-gray-500 dark:text-gray-400 text-center">
          CC Chat App v1.0
        </div>
      </div>

      {/* ユーザー検索モーダル */}
      <UserSearch
        isOpen={isUserSearchOpen}
        onClose={() => setIsUserSearchOpen(false)}
        currentUserId={user?.id}
        onUserSelect={(user) => {
          // ユーザー選択時の処理（必要に応じてコールバックを追加）
          console.log('Selected user for DM:', user);
        }}
      />
    </div>
  );
};