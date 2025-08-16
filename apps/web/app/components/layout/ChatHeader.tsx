'use client';

import React from 'react';
import { Button } from '@repo/ui/button';

interface ChatHeaderProps {
  roomName?: string;
  isGroupChat?: boolean;
  memberCount?: number;
  onlineCount?: number;
  onToggleSidebar?: () => void;
  isSidebarOpen?: boolean;
  onRoomSettings?: () => void;
  onVideoCall?: () => void;
  onVoiceCall?: () => void;
}

export const ChatHeader: React.FC<ChatHeaderProps> = ({
  roomName = 'チャットルームを選択してください',
  isGroupChat = false,
  memberCount,
  onlineCount,
  onToggleSidebar,
  isSidebarOpen,
  onRoomSettings,
  onVideoCall,
  onVoiceCall,
}) => {
  return (
    <div className="flex items-center justify-between p-4 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
      {/* 左側：ハンバーガーメニュー＋ルーム情報 */}
      <div className="flex items-center space-x-4">
        {/* ハンバーガーメニュー（モバイル表示用） */}
        <button
          onClick={onToggleSidebar}
          className="lg:hidden p-2 rounded-md text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-gray-700 transition-colors"
          aria-label="サイドバーを開く"
        >
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>

        {/* ルーム情報 */}
        <div className="flex items-center space-x-3">
          {/* ルームアイコン */}
          <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center flex-shrink-0">
            {isGroupChat ? (
              <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3z" />
              </svg>
            ) : (
              <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
              </svg>
            )}
          </div>

          {/* ルーム名とメンバー情報 */}
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white truncate">
              {roomName}
            </h2>
            {memberCount !== undefined && (
              <div className="flex items-center space-x-2 text-sm text-gray-500 dark:text-gray-400">
                {isGroupChat && (
                  <>
                    <span>{memberCount}人のメンバー</span>
                    {onlineCount !== undefined && (
                      <>
                        <span>•</span>
                        <span className="flex items-center space-x-1">
                          <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                          <span>{onlineCount}人オンライン</span>
                        </span>
                      </>
                    )}
                  </>
                )}
                {!isGroupChat && onlineCount !== undefined && (
                  <span className="flex items-center space-x-1">
                    <div className={`w-2 h-2 rounded-full ${onlineCount > 0 ? 'bg-green-500' : 'bg-gray-400'}`}></div>
                    <span>{onlineCount > 0 ? 'オンライン' : 'オフライン'}</span>
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 右側：アクションボタン */}
      <div className="flex items-center space-x-2">
        {/* 音声通話ボタン */}
        <button
          onClick={onVoiceCall}
          className="p-2 rounded-md text-gray-500 hover:text-green-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-green-400 dark:hover:bg-gray-700 transition-colors"
          title="音声通話"
          disabled={!roomName || roomName === 'チャットルームを選択してください'}
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
          </svg>
        </button>

        {/* ビデオ通話ボタン */}
        <button
          onClick={onVideoCall}
          className="p-2 rounded-md text-gray-500 hover:text-blue-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-blue-400 dark:hover:bg-gray-700 transition-colors"
          title="ビデオ通話"
          disabled={!roomName || roomName === 'チャットルームを選択してください'}
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
        </button>

        {/* ルーム設定ボタン */}
        <button
          onClick={onRoomSettings}
          className="p-2 rounded-md text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-gray-700 transition-colors"
          title="ルーム設定"
          disabled={!roomName || roomName === 'チャットルームを選択してください'}
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
          </svg>
        </button>
      </div>
    </div>
  );
};