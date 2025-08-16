'use client';

import React, { useState } from 'react';

interface ChatLayoutProps {
  children: React.ReactNode;
  sidebar?: React.ReactNode;
  header?: React.ReactElement;
}

export const ChatLayout: React.FC<ChatLayoutProps> = ({
  children,
  sidebar,
  header,
}) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen);
  };

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900 overflow-hidden">
      {/* サイドバー */}
      <div
        className={`
          fixed inset-y-0 left-0 z-50 w-80 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 shadow-lg
          transform transition-transform duration-300 ease-in-out
          lg:relative lg:translate-x-0 lg:shadow-none
          ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        {sidebar}
      </div>

      {/* オーバーレイ（モバイル時） */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black bg-opacity-50 lg:hidden"
          onClick={toggleSidebar}
          aria-hidden="true"
        />
      )}

      {/* メインコンテンツエリア */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* ヘッダー */}
        {header && (
          <div className="flex-shrink-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 shadow-sm">
            {React.cloneElement(header, {
              onToggleSidebar: toggleSidebar,
              isSidebarOpen,
            } as React.Attributes)}
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