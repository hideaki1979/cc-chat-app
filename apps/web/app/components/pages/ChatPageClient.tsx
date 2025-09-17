'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '../../stores/auth';
import { ChatLayout, Sidebar, ChatHeader } from '../layout';
import type { ChatRoom } from '../../types/chat';

/**
 * チャットページのClient Component部分（useEffect最適化版）
 * - 認証チェックはmiddleware.tsに委譲（Next.js App Routerベストプラクティス）
 * - useEffectによる無限ループリスクを排除
 * - シンプルな状態管理でパフォーマンス向上
 */
export function ChatPageClient() {
  const router = useRouter();
  const { user, logout } = useAuthStore();

  // ルーム関連のローカル状態（将来のAPI接続を想定しつつプレースホルダー）
  const [rooms] = useState<ChatRoom[]>([]);
  const [currentRoomId] = useState<string | undefined>(undefined);

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  return (
    <ChatLayout
      sidebar={
        <Sidebar
          rooms={rooms}
          currentRoomId={currentRoomId}
          onCreateRoom={() => { }}
          onRoomSelect={() => { }}
          user={user ? { id: user.id, name: user.name, email: user.email } : undefined}
          onLogout={handleLogout}
        />
      }
      header={({ onToggleSidebar, isSidebarOpen }) => (
        <ChatHeader
          onToggleSidebar={onToggleSidebar}
          isSidebarOpen={isSidebarOpen}
        />
      )}
    >
      {/* メインチャットエリア（未選択時プレースホルダー） */}
      <div className="flex h-full items-center justify-center" data-testid="chat-placeholder">
        <div className="text-center text-gray-600 dark:text-gray-300">
          <div className="mb-4">
            <svg className="w-16 h-16 mx-auto text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            <h3 data-testid="welcome-message">左のサイドバーからチャットルームを選択するか、</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">新しいルームを作成してチャットを開始しましょう</p>
          </div>
          <button
            onClick={() => router.push('/dashboard')}
            className="mt-4 px-4 py-2 rounded-md bg-gray-100 hover:bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
            data-testid="back-to-dashboard-button"
          >
            ダッシュボードに戻る
          </button>
        </div>
      </div>
    </ChatLayout>
  );
}