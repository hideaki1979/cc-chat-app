'use client';

import React, { useState, useEffect } from 'react';

interface HeaderProps {
  onToggleSidebar: () => void;
  isSidebarOpen: boolean;
}

interface ChatLayoutProps {
  children: React.ReactNode;
  sidebar?: React.ReactNode;
  header?: (props: HeaderProps) => React.ReactNode;
}

export const ChatLayout: React.FC<ChatLayoutProps> = ({
  children,
  sidebar,
  header,
}) => {
  // 画面幅に応じてサイドバーの初期状態を決定
  const [isSidebarOpen, setIsSidebarOpen] = useState(() => {
    // SSRでは常にfalse、クライアントでは画面サイズで判定
    if (typeof window === 'undefined') return false;
    return window.innerWidth >= 1024;
  });
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
    const checkSize = () => {
      // デスクトップ（lg以上）では表示、モバイルでは非表示
      setIsSidebarOpen(window.innerWidth >= 1024);
    };

    checkSize();
    // リサイズイベントも監視
    window.addEventListener('resize', checkSize);
    return () => window.removeEventListener('resize', checkSize);
  }, []);


  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen);
  };

  // 初期読み込み時の処理を削除し、常に通常のレンダリングを行う

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900 overflow-hidden">
      {/* サイドバー */}
      <div
        className={`
          fixed inset-y-0 left-0 z-50 w-80 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 shadow-lg
          transform transition-transform duration-300 ease-in-out
          lg:relative lg:translate-x-0 lg:shadow-none
          ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
      >
        {sidebar}
      </div>

      {/* オーバーレイ（モバイル時） */}
      {isClient && isSidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black bg-opacity-50 lg:hidden"
          onClick={toggleSidebar}
          aria-hidden="true"
          data-testid="sidebar-overlay"
        />
      )}

      {/* メインコンテンツエリア */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* ヘッダー */}
        {header && (
          <div className="flex-shrink-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 shadow-sm">
            {header({ onToggleSidebar: toggleSidebar, isSidebarOpen })}
          </div>
        )}

        {/* メインチャットエリア */}
        <div className="flex-1 overflow-hidden bg-white dark:bg-gray-800">
          {children}
        </div>
      </div>
    </div>
  );
};