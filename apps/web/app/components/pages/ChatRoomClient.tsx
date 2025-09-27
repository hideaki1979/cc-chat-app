'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '../../stores/auth';
import { useWebSocketStore } from '../../stores/websocket';
import { ChatLayout, Sidebar, ChatHeader } from '../layout';
import { MessageList } from '../chat/MessageList';
import { MessageInput } from '../chat/MessageInput';
import type { ChatRoom, Message } from '../../types/chat';
import type { UploadedFile } from '../../hooks/useFileUpload';
import { useMemo } from 'react';

interface ChatRoomClientProps {
  roomId: string;
}

/**
 * チャットルーム固有のClient Component
 * - WebSocket接続管理
 * - リアルタイムメッセージ表示・送信
 * - ルーム参加・退出処理
 */
export function ChatRoomClient({ roomId }: ChatRoomClientProps) {
  const router = useRouter();
  const { user, logout, accessToken } = useAuthStore();
  const {
    connect,
    disconnect,
    isConnected,
    isConnecting,
    connectionError,
    joinRoom,
    sendMessage,
    startTyping,
    stopTyping,
    messages,
    currentRoomId,
  } = useWebSocketStore();

  // ルーム関連のローカル状態（将来のAPI接続を想定）
  const [rooms] = useState<ChatRoom[]>([]);

  // WebSocketメッセージをMessage型に変換
  const convertedMessages = useMemo(() => {
    const filtered = messages.filter(msg => msg.roomId === roomId);
    const converted = filtered.map((msg): Message => ({
      id: msg.id,
      content: msg.content,
      room_id: msg.roomId,
      user_id: msg.userId,
      created_at: new Date(msg.timestamp).toISOString(),
      updated_at: new Date(msg.timestamp).toISOString(),
      sender_id: msg.userId,
      sender_name: msg.userId, // 暫定的にuserIdを設定
      message_type: msg.type === 'system' ? 'system' : 'text',
      is_edited: false,
    }));


    return converted;
  }, [messages, roomId]);

  const handleLogout = async () => {
    disconnect();
    await logout();
    router.push('/login');
  };

  // WebSocket接続初期化
  useEffect(() => {
    if (accessToken && !isConnected && !isConnecting) {
      connect(accessToken);
    }

    return () => {
      // コンポーネントアンマウント時は切断
      disconnect();
    };
  }, [accessToken, isConnected, isConnecting, connect, disconnect]);

  // ルーム参加処理
  useEffect(() => {
    if (isConnected && roomId && currentRoomId !== roomId) {
      joinRoom(roomId);
    }
  }, [isConnected, roomId, currentRoomId, joinRoom]);

  // メッセージ送信処理
  const handleSendMessage = async (content: string, attachments?: UploadedFile[]) => {
    console.log('🎯 ChatRoomClient handleSendMessage:', { content, roomId, userId: user?.id });

    if (!content.trim() || !roomId) {
      console.log('❌ Message send blocked:', { hasContent: !!content.trim(), hasRoomId: !!roomId });
      return;
    }

    console.log('✅ Calling WebSocketStore sendMessage');
    sendMessage(content, roomId, user?.id);

    // 添付ファイルがある場合の処理（今後実装）
    if (attachments && attachments.length > 0) {
      // 将来の実装用
    }
  };

  // タイピング通知処理
  const handleTypingStart = () => {
    if (roomId) {
      startTyping(roomId);
    }
  };

  const handleTypingStop = () => {
    if (roomId) {
      stopTyping(roomId);
    }
  };

  return (
    <ChatLayout
      sidebar={
        <Sidebar
          rooms={rooms}
          currentRoomId={roomId}
          onCreateRoom={() => { }}
          onRoomSelect={(selectedRoomId) => router.push(`/chat/${selectedRoomId}`)}
          user={user ? { id: user.id, name: user.name, email: user.email } : undefined}
          onLogout={handleLogout}
          onCloseSidebar={() => {
            const event = new CustomEvent('toggleSidebar');
            document.dispatchEvent(event);
          }}
        />
      }
      header={({ onToggleSidebar, isSidebarOpen }) => (
        <ChatHeader
          onToggleSidebar={onToggleSidebar}
          isSidebarOpen={isSidebarOpen}
          roomName={`ルーム ${roomId}`}
        />
      )}
    >
      {/* WebSocket接続状態表示 */}
      {connectionError && (
        <div className="bg-red-50 dark:bg-red-900/20 border-l-4 border-red-400 p-4 mb-4">
          <div className="flex">
            <div className="ml-3">
              <p className="text-sm text-red-700 dark:text-red-300">
                接続エラー: {connectionError}
              </p>
              <button
                onClick={() => accessToken && connect(accessToken)}
                className="mt-2 text-sm text-red-600 dark:text-red-400 underline hover:text-red-800 dark:hover:text-red-200"
                disabled={!accessToken}
              >
                再接続を試す
              </button>
            </div>
          </div>
        </div>
      )}

      {isConnecting && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-400 p-4 mb-4">
          <div className="flex items-center">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-500 mr-3"></div>
            <p className="text-sm text-blue-700 dark:text-blue-300">
              WebSocketに接続中...
            </p>
          </div>
        </div>
      )}

      {/* メインチャットエリア */}
      <div className="flex flex-col h-full">
        <MessageList
          messages={convertedMessages}
          currentUserId={user?.id}
          roomId={roomId}
        />

        <MessageInput
          onSendMessage={handleSendMessage}
          onTypingStart={handleTypingStart}
          onTypingStop={handleTypingStop}
          disabled={!isConnected}
          placeholder={isConnected ? "メッセージを入力してください..." : "WebSocket接続待機中..."}
        />
      </div>
    </ChatLayout>
  );
}