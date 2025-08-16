'use client';

import React from 'react';
import { Button } from '@repo/ui/button';

// チャットルーム型定義（将来のAPI連携用）
export interface ChatRoom {
  id: string;
  name: string;
  is_group_chat: boolean;
  member_count?: number;
  last_message?: {
    content: string;
    sender_name: string;
    created_at: string;
  };
  updated_at: string;
}

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
}

export const Sidebar: React.FC<SidebarProps> = ({
  rooms = [],
  currentRoomId,
  onRoomSelect,
  onCreateRoom,
  user,
  onLogout,
}) => {
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
    <div className="flex flex-col h-full bg-white dark:bg-gray-800">
      {/* ヘッダー部分 */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">
            CC Chat
          </h1>
          <Button
            onClick={onCreateRoom}
            size="sm"
            variant="primary"
            className="text-sm"
          >
            新規ルーム
          </Button>
        </div>
        
        {/* ユーザー情報 */}
        {user && (
          <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
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
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-sm"
              title="ログアウト"
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
          <div className="p-4 text-center">
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
                  ${
                    currentRoomId === room.id
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
                      <p className="text-xs text-gray-500 dark:text-gray-500">
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
    </div>
  );
};