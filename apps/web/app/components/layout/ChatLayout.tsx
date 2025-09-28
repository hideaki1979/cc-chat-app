'use client';

import React, { useEffect } from 'react';
import { useResponsive } from './hooks/useResponsive';
import { useSidebarStore } from '../../stores/sidebarStore';

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
  const { lg, isClient } = useResponsive();
  // useStateの代わりにZustandストアから状態とアクションを取得
  const { isSidebarOpen, setIsSidebarOpen, toggleSidebar } = useSidebarStore();

  // lg以上の画面サイズでサイドバーを自動開閉
  useEffect(() => {
    setIsSidebarOpen(lg);
  }, [lg, setIsSidebarOpen]);

  // カスタムイベントリスナーでサイドバーの切り替えをサポート
  // ここで直接ZustandのtoggleSidebarアクションを呼び出す
  useEffect(() => {
    const handleToggleSidebar = () => {
      toggleSidebar();
    };

    document.addEventListener('toggleSidebar', handleToggleSidebar);
    return () => {
      document.removeEventListener('toggleSidebar', handleToggleSidebar);
    };
  }, [toggleSidebar]);

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900">
      {/* サイドバー */}
      <aside
        className={`
          fixed inset-y-0 left-0 z-40 w-64 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 shadow-lg
          transform ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:static lg:inset-auto lg:w-64 lg:translate-x-0
          transition-transform duration-300 ease-in-out
        `}
      >
        {sidebar}
      </aside>

      {/* オーバーレイ（モバイル時） */}
      {isClient && isSidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black bg-opacity-50 lg:hidden"
          onClick={toggleSidebar} // オーバーレイクリックでサイドバーを閉じる
          aria-hidden="true"
          data-testid="sidebar-overlay"
        />
      )}

      {/* メインコンテンツエリア */}
      <div className="flex-1 flex flex-col overflow-hidden lg:ml-64">
        {/* ヘッダー */}
        {header && (
          <div className="flex-shrink-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 shadow-sm">
            {header({ onToggleSidebar: toggleSidebar, isSidebarOpen })} {/* ヘッダーにもZustandのtoggleSidebarを渡す */}
          </div>
        )}

        {/* メインチャットエリア */}
        <main className="flex-1 overflow-hidden overflow-x-hidden overflow-y-auto bg-white dark:bg-gray-800">
          {children}
        </main>
      </div>
    </div>
  );
};