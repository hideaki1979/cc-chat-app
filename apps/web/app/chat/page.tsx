'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '../stores/auth';
import { ChatLayout, Sidebar, ChatHeader, type ChatRoom } from '../components/layout';

// テスト用のダミーデータ
const dummyRooms: ChatRoom[] = [
  {
    id: '1',
    name: '一般チャット',
    is_group_chat: true,
    member_count: 15,
    last_message: {
      content: 'おはようございます！',
      sender_name: '田中さん',
      created_at: new Date(Date.now() - 30 * 60 * 1000).toISOString(), // 30分前
    },
    updated_at: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
  },
  {
    id: '2',
    name: '山田太郎',
    is_group_chat: false,
    last_message: {
      content: '明日の会議の件ですが...',
      sender_name: '山田太郎',
      created_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2時間前
    },
    updated_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: '3',
    name: 'プロジェクトA',
    is_group_chat: true,
    member_count: 8,
    last_message: {
      content: 'レビューお疲れ様でした',
      sender_name: '佐藤さん',
      created_at: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(), // 5時間前
    },
    updated_at: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
  },
];

export default function ChatPage() {
  const router = useRouter();
  const { user, isLoading, isInitialized, logout, initializeAuth } = useAuthStore();
  const [selectedRoomId, setSelectedRoomId] = useState<string | undefined>();
  const [selectedRoom, setSelectedRoom] = useState<ChatRoom | null>(null);
  const [initStarted, setInitStarted] = useState(false);

  // 初期化処理（一度だけ実行）
  React.useEffect(() => {
    if (!isInitialized && !initStarted) {
      setInitStarted(true);
      initializeAuth();
    }
  }, [isInitialized, initStarted, initializeAuth]);

  const handleRoomSelect = (roomId: string) => {
    setSelectedRoomId(roomId);
    const room = dummyRooms.find(r => r.id === roomId) || null;
    setSelectedRoom(room);
  };

  const handleCreateRoom = () => {
    // TODO: ルーム作成モーダルを開く
    alert('ルーム作成機能は今後実装予定です');
  };

  const handleLogout = async () => {
    await logout();
    router.push('/login');
  };

  const handleRoomSettings = () => {
    alert('ルーム設定機能は今後実装予定です');
  };

  const handleVideoCall = () => {
    alert('ビデオ通話機能は今後実装予定です');
  };

  const handleVoiceCall = () => {
    alert('音声通話機能は今後実装予定です');
  };

  // 初期化中はローディング表示
  if (isLoading || !isInitialized) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>ユーザー情報を読み込み中...</p>
      </div>
    );
  }

  // middlewareで認証チェック済みのため、userがnullの場合は初期化エラー
  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 mb-4">認証エラーが発生しました</p>
          <button 
            onClick={() => router.push('/login')} 
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            ログイン画面に戻る
          </button>
        </div>
      </div>
    );
  }

  return (
    <ChatLayout
      sidebar={
        <Sidebar
          rooms={dummyRooms}
          currentRoomId={selectedRoomId}
          onRoomSelect={handleRoomSelect}
          onCreateRoom={handleCreateRoom}
          user={user}
          onLogout={handleLogout}
        />
      }
      header={(props) => (
        <ChatHeader
          {...props}
          roomName={selectedRoom?.name}
          isGroupChat={selectedRoom?.is_group_chat}
          memberCount={selectedRoom?.member_count}
          onlineCount={selectedRoom?.is_group_chat ? 5 : selectedRoom ? 1 : 0} // ダミーデータ
          onRoomSettings={handleRoomSettings}
          onVideoCall={handleVideoCall}
          onVoiceCall={handleVoiceCall}
        />
      )}
    >
      {/* メインチャットエリア */}
      <div className="flex-1 flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        {selectedRoom ? (
          <div className="text-center p-8">
            <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
              <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path d="M2 5a2 2 0 012-2h7a2 2 0 012 2v4a2 2 0 01-2 2H9l-3 3v-3H4a2 2 0 01-2-2V5z" />
                <path d="M15 7v2a4 4 0 01-4 4H9.828l-1.766 1.767c.28.149.599.233.938.233h2l3 3v-3h2a2 2 0 002-2V9a2 2 0 00-2-2h-1z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              {selectedRoom.name}
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              {selectedRoom.is_group_chat
                ? `${selectedRoom.member_count}人のメンバー`
                : 'ダイレクトメッセージ'
              }
            </p>
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <p className="text-blue-700 dark:text-blue-400">
                メッセージ機能は次のフェーズで実装予定です。<br />
                現在はレイアウトコンポーネントのテスト表示中です。
              </p>
            </div>
          </div>
        ) : (
          <div className="text-center p-8">
            <div className="w-16 h-16 mx-auto mb-4 bg-gray-300 dark:bg-gray-600 rounded-full flex items-center justify-center">
              <svg className="w-8 h-8 text-gray-500" fill="currentColor" viewBox="0 0 20 20">
                <path d="M2 5a2 2 0 012-2h7a2 2 0 012 2v4a2 2 0 01-2 2H9l-3 3v-3H4a2 2 0 01-2-2V5z" />
                <path d="M15 7v2a4 4 0 01-4 4H9.828l-1.766 1.767c.28.149.599.233.938.233h2l3 3v-3h2a2 2 0 002-2V9a2 2 0 00-2-2h-1z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              チャットルームを選択してください
            </h3>
            <p className="text-gray-600 dark:text-gray-400">
              左のサイドバーからチャットルームを選択するか、<br />
              新規ルームを作成してチャットを開始しましょう。
            </p>
          </div>
        )}
      </div>
    </ChatLayout>
  );
}