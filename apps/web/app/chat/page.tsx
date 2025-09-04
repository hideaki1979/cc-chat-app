'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '../stores/auth';
import { ChatLayout, Sidebar, ChatHeader } from '../components/layout';
// import { ChatArea } from '../components/chat';
import type { ChatRoom } from '../types/chat';

export default function ChatPage() {
  const router = useRouter();
  const { user, isLoading, isInitialized, logout } = useAuthStore();

  // ルーム関連のローカル状態（将来のAPI接続を想定しつつプレースホルダー）
  const [rooms] = useState<ChatRoom[]>([]);
  const [currentRoomId] = useState<string | undefined>(undefined);

  // 認証初期化完了後、未ログインならログインへ

  // 初期化完了後、未ログインならログインへ（元URLを保持）
  useEffect(() => {
    if (isInitialized && !user) {
      const redirectTo = encodeURIComponent('/chat');
      router.replace(`/login?redirect=${redirectTo}`);
    }
  }, [isInitialized, user, router]);

  const handleLogout = async () => {
    await logout();
    router.push('/login');
  };

  if (!isInitialized || isLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>ユーザー情報を読み込み中...</p>
      </div>
    );
  }

  return (
    <ChatLayout
      sidebar={
        <Sidebar
          rooms={rooms}
          currentRoomId={currentRoomId}
          onCreateRoom={() => { }}
          onRoomSelect={() => { }}
          user={{ id: user.id, name: user.name, email: user.email }}
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
      <div className="flex h-full items-center justify-center">
        <div className="text-center text-gray-600 dark:text-gray-300">
          <p>チャットルームを選択してください</p>
          <button
            onClick={() => router.push('/dashboard')}
            className="mt-4 px-4 py-2 rounded-md bg-gray-100 hover:bg-gray-200 text-gray-700"
          >
            ダッシュボードに戻る
          </button>
        </div>
      </div>
    </ChatLayout>
  );
}