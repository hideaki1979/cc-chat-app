'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '../stores/auth';
import { ChatLayout, Sidebar, ChatHeader, type ChatRoom } from '../components/layout';
import { ChatArea, type Message } from '../components/chat';

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

// テスト用のダミーメッセージデータ
const getDummyMessages = (roomId: string): Message[] => {
  const baseMessages: Record<string, Message[]> = {
    '1': [ // 一般チャット
      {
        id: 'msg_1_1',
        content: 'おはようございます！今日もよろしくお願いします。',
        sender_id: 'user_tanaka',
        sender_name: '田中さん',
        room_id: '1',
        created_at: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
        message_type: 'text',
      },
      {
        id: 'msg_1_2',
        content: 'おはようございます！今日は会議が多いですね。',
        sender_id: 'user_sato',
        sender_name: '佐藤さん',
        room_id: '1',
        created_at: new Date(Date.now() - 2.5 * 60 * 60 * 1000).toISOString(),
        message_type: 'text',
      },
      {
        id: 'msg_1_3',
        content: 'そうですね。午後の企画会議、準備はいかがですか？',
        sender_id: 'current_user',
        sender_name: 'あなた',
        room_id: '1',
        created_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
        message_type: 'text',
      },
      {
        id: 'msg_1_4',
        content: '資料の準備は完了しています！\n皆さんもお疲れ様です。',
        sender_id: 'user_tanaka',
        sender_name: '田中さん',
        room_id: '1',
        created_at: new Date(Date.now() - 1.5 * 60 * 60 * 1000).toISOString(),
        message_type: 'text',
      },
      {
        id: 'msg_1_5',
        content: 'ありがとうございます！よろしくお願いします。',
        sender_id: 'user_yamamoto',
        sender_name: '山本さん',
        room_id: '1',
        created_at: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
        message_type: 'text',
      },
    ],
    '2': [ // 山田太郎との個人チャット
      {
        id: 'msg_2_1',
        content: 'お疲れ様です。明日の会議の件でご相談があります。',
        sender_id: 'user_yamada',
        sender_name: '山田太郎',
        room_id: '2',
        created_at: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
        message_type: 'text',
      },
      {
        id: 'msg_2_2',
        content: 'お疲れ様です！どのような件でしょうか？',
        sender_id: 'current_user',
        sender_name: 'あなた',
        room_id: '2',
        created_at: new Date(Date.now() - 2.8 * 60 * 60 * 1000).toISOString(),
        message_type: 'text',
      },
      {
        id: 'msg_2_3',
        content: '資料の共有方法についてなのですが、事前に送付した方がよろしいでしょうか？',
        sender_id: 'user_yamada',
        sender_name: '山田太郎',
        room_id: '2',
        created_at: new Date(Date.now() - 2.5 * 60 * 60 * 1000).toISOString(),
        message_type: 'text',
      },
      {
        id: 'msg_2_4',
        content: 'そうですね。事前共有があると議論がスムーズになりそうです。\nSlackかメールでお送りいただけますでしょうか？',
        sender_id: 'current_user',
        sender_name: 'あなた',
        room_id: '2',
        created_at: new Date(Date.now() - 2.3 * 60 * 60 * 1000).toISOString(),
        message_type: 'text',
      },
      {
        id: 'msg_2_5',
        content: '承知いたしました。Slackで共有いたします。ありがとうございました！',
        sender_id: 'user_yamada',
        sender_name: '山田太郎',
        room_id: '2',
        created_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
        message_type: 'text',
      },
    ],
    '3': [ // プロジェクトA
      {
        id: 'msg_3_1',
        content: 'プロジェクトAの進捗共有です。\n現在、開発フェーズの80%が完了しています。',
        sender_id: 'user_project_lead',
        sender_name: 'プロジェクトリーダー',
        room_id: '3',
        created_at: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
        message_type: 'text',
      },
      {
        id: 'msg_3_2',
        content: '順調な進捗ですね！テスト工程の準備はいかがでしょうか？',
        sender_id: 'current_user',
        sender_name: 'あなた',
        room_id: '3',
        created_at: new Date(Date.now() - 5.8 * 60 * 60 * 1000).toISOString(),
        message_type: 'text',
      },
      {
        id: 'msg_3_3',
        content: 'テストケースの作成は来週月曜日から開始予定です。',
        sender_id: 'user_sato',
        sender_name: '佐藤さん',
        room_id: '3',
        created_at: new Date(Date.now() - 5.5 * 60 * 60 * 1000).toISOString(),
        message_type: 'text',
      },
      {
        id: 'msg_3_4',
        content: 'レビューお疲れ様でした。指摘事項についても対応完了しています。',
        sender_id: 'user_sato',
        sender_name: '佐藤さん',
        room_id: '3',
        created_at: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
        message_type: 'text',
      },
    ],
  };

  return baseMessages[roomId] || [];
};

export default function ChatPage() {
  const router = useRouter();
  const { user, isLoading, isInitialized, logout, initializeAuth } = useAuthStore();
  const [selectedRoomId, setSelectedRoomId] = useState<string | undefined>();
  const [selectedRoom, setSelectedRoom] = useState<ChatRoom | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
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
    // ルーム選択時にメッセージを読み込み
    setMessages(getDummyMessages(roomId));
  };

  const handleSendMessage = async (content: string) => {
    if (!selectedRoomId || !user) return;

    // より安全なID生成（UUIDライブラリの使用を推奨）
    const messageId = `msg_${selectedRoomId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // 新しいメッセージを作成
    const newMessage: Message = {
      id: messageId,
      content,
      sender_id: user.id,
      sender_name: user.name,
      room_id: selectedRoomId,
      created_at: new Date().toISOString(),
      message_type: 'text',
    };

    // メッセージをローカル状態に追加
    setMessages(prev => [...prev, newMessage]);

    // TODO: 実際のAPIコールでメッセージを送信
    try {
      // await api.sendMessage(selectedRoomId, content);
    } catch (error) {
      // API失敗時はメッセージを削除
      setMessages(prev => prev.filter(msg => msg.id !== messageId));
      console.error('Failed to send message:', error);
    }
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
      {/* チャットメインエリア */}
      <ChatArea
        roomId={selectedRoomId}
        roomName={selectedRoom?.name}
        messages={messages}
        currentUserId={user?.id}
        onSendMessage={handleSendMessage}
      />
    </ChatLayout>
  );
}