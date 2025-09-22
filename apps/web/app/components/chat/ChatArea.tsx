'use client';

import React, { useState, useCallback, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { MessageInput } from './MessageInput';
import { useChat } from '../../hooks/useChat';
import { getUserFriendlyMessage, normalizeError } from '../../lib/services/errorService';
import type { Message } from '../../types/chat';
import { useWebSocketStore } from '../../stores/websocket';

// MessageListを動的インポート化（メッセージ表示は重いため、必要時のみロード）
const MessageList = dynamic(() =>
  import('./MessageList').then(mod => ({ default: mod.MessageList })),
  {
    loading: () => (
      <div className="flex-1 flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="flex items-center space-x-2 text-gray-500 dark:text-gray-400">
          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-500"></div>
          <span>メッセージを読み込み中...</span>
        </div>
      </div>
    ),
    ssr: false // メッセージリストはクライアント側でのみ動作
  }
);

export { MessageInput };
export type { Message };

interface ChatAreaProps {
  roomId?: string;
  roomName?: string;
  messages?: Message[];
  currentUserId?: string;
  onSendMessage?: (content: string) => void | Promise<void>;
  isLoading?: boolean;
  onLoadMore?: () => void;
  hasMore?: boolean;
  disabled?: boolean;
}

export const ChatArea: React.FC<ChatAreaProps> = ({
  roomId,
  roomName,
  messages: propMessages,
  currentUserId,
  onSendMessage,
  isLoading: propIsLoading = false,
  onLoadMore,
  hasMore = false,
  disabled = false,
}) => {
  const [isSending, setIsSending] = useState(false);
  const { fetchMessages, sendMessage: sendMessageViaHook, isLoading, currentRoomMessages } = useChat();
  const { startTyping, stopTyping, joinRoom } = useWebSocketStore()

  // roomIdが変更された時にメッセージを取得
  useEffect(() => {
    if (roomId) {
      fetchMessages(roomId).catch((error) => {
        console.error("Failed to fetch messages in component:", error);
      });
    }
  }, [roomId, fetchMessages]);

  useEffect(() => {
    if (roomId) joinRoom(roomId);
  }, [roomId, joinRoom]);

  const handleTypingStartWS = useCallback(() => {
    if (roomId) startTyping(roomId);
  }, [roomId, startTyping]);

  const handleTypingStopWS = useCallback(() => {
    if (roomId) stopTyping(roomId);
  }, [roomId, stopTyping]);

  // 実際に使用するメッセージとローディング状態
  const actualMessages = onSendMessage ? (propMessages ?? currentRoomMessages) : currentRoomMessages;
  const actualIsLoading = propIsLoading || isLoading;

  // メッセージ送信関数
  const handleSendMessage = useCallback(async (content: string) => {
    if (!roomId || isSending || disabled) return;

    setIsSending(true);
    try {
      // カスタムのonSendMessageがある場合はそれを使用、なければ自前のsendMessageを使用
      if (onSendMessage) {
        await onSendMessage(content);
      } else {
        await sendMessageViaHook(roomId, content);
      }
    } catch (error) {
      const appError = normalizeError(error, 'メッセージ送信');
      const userMessage = getUserFriendlyMessage(appError);
      console.error('メッセージ送信エラー:', userMessage);
      // TODO: エラートーストを表示
    } finally {
      setIsSending(false);
    }
  }, [roomId, onSendMessage, sendMessageViaHook, isSending, disabled]);

  // ルームが選択されていない場合の表示
  if (!roomId) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-50 dark:bg-gray-900">
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
      </div>
    );
  }

  return (
    <div className="relative flex-1 flex flex-col h-full min-h-0">
      {/* メッセージリスト（flex-1で残り空間を全て使用） */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        <MessageList
          messages={actualMessages}
          currentUserId={currentUserId}
          roomId={roomId}
          isLoading={actualIsLoading}
          onLoadMore={onLoadMore}
          hasMore={hasMore}
        />
      </div>

      {/* メッセージ入力（下部固定） */}
      <div className="flex-shrink-0 sticky bottom-0 bg-white/80 dark:bg-gray-800/80 backdrop-blur supports-[backdrop-filter]:bg-white/60 supports-[backdrop-filter]:dark:bg-gray-800/60">
        <MessageInput
          onSendMessage={handleSendMessage}
          disabled={disabled || isSending}
          placeholder={
            isSending
              ? '送信中...'
              : roomName
                ? `${roomName}にメッセージを送信...`
                : 'メッセージを入力してください...'
          }
          onTypingStart={handleTypingStartWS}
          onTypingStop={handleTypingStopWS}
        />
      </div>

      {/* 送信中のローディング表示 */}
      {isSending && (
        <div className="absolute bottom-20 right-4 bg-blue-500 text-white px-3 py-1 rounded-full text-sm flex items-center space-x-2">
          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
          <span>送信中...</span>
        </div>
      )}
    </div>
  );
};