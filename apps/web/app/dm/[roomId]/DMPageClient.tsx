'use client';

import { ChatArea } from '../../components/chat';
import { Button } from '@repo/ui/button';
import { useDMPageLogic } from '../../hooks/useDMPageLogic';

interface Props {
  roomId: string;
}

export function DMPageClient({ roomId }: Props) {
  const {
    currentRoom,
    isDM,
    otherUserName,
    isLoading,
    isAuthenticated,
    user,
    router
  } = useDMPageLogic(roomId);

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>読み込み中...</p>
      </div>
    );
  }

  if (!currentRoom) {
    if (isLoading) {
      return (
        <div className="min-h-screen flex items-center justify-center">
          <p>読み込み中...</p>
        </div>
      );
    }
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center p-8">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
            チャットルームが見つかりません
          </h2>
          <Button
            variant="primary"
            onClick={() => router.push('/chat')}
          >
            チャット一覧に戻る
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-white dark:bg-gray-900 overflow-hidden">
      {/* DM専用ヘッダー */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 sticky top-0 z-10">
        {/* 左側：戻るボタンとユーザー情報 */}
        <div className="flex items-center space-x-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push('/chat')}
            className="p-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </Button>

          {/* ユーザーアバター */}
          <div className="w-10 h-10 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center">
            <span className="text-white text-sm font-bold">
              {otherUserName.charAt(0).toUpperCase()}
            </span>
          </div>

          {/* ユーザー名とステータス */}
          <div className="flex-1">
            <h1 className="text-lg font-semibold text-gray-900 dark:text-white">
              {otherUserName}
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {isDM ? 'ダイレクトメッセージ' : 'チャットルーム'}
            </p>
          </div>
        </div>

        {/* 右側：アクションボタン */}
        <div className="flex items-center space-x-2">
          <Button
            variant="ghost"
            size="sm"
            className="p-2"
            disabled // 将来の音声通話機能用
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
            </svg>
          </Button>

          <Button
            variant="ghost"
            size="sm"
            className="p-2"
            disabled // 将来のビデオ通話機能用
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          </Button>

          <Button
            variant="ghost"
            size="sm"
            className="p-2"
            disabled // 将来の詳細情報機能用
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </Button>

          <Button
            variant="ghost"
            size="sm"
            className="p-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h.01M12 12h.01M19 12h.01M6 12a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0z" />
            </svg>
          </Button>
        </div>
      </div>

      {/* メインチャットエリア */}
      <div className="flex-1 flex flex-col min-h-0">
        <ChatArea
          roomId={roomId}
          roomName={currentRoom.name}
          currentUserId={user.id}
        />
      </div>
    </div>
  );
}