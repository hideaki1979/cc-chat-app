'use client';

import React, { useState, useCallback } from 'react';
import { MessageInput } from './MessageInput';
import { MessageList } from './MessageList';
import type { Message } from '../../types/chat';

export { MessageInput, MessageList };
export type { Message };

interface ChatAreaProps {
  roomId?: string;
  roomName?: string;
  messages: Message[];
  currentUserId?: string;
  onSendMessage?: (content: string) => void;
  isLoading?: boolean;
  onLoadMore?: () => void;
  hasMore?: boolean;
  disabled?: boolean;
}

export const ChatArea: React.FC<ChatAreaProps> = ({
  roomId,
  roomName,
  messages,
  currentUserId,
  onSendMessage,
  isLoading = false,
  onLoadMore,
  hasMore = false,
  disabled = false,
}) => {
  const [isSending, setIsSending] = useState(false);

  const handleSendMessage = useCallback(async (content: string) => {
    if (!onSendMessage || isSending || disabled) return;

    setIsSending(true);
    try {
      await onSendMessage(content);
    } catch (error) {
      console.error('メッセージ送信エラー:', error);
      // TODO: エラートーストを表示
    } finally {
      setIsSending(false);
    }
  }, [onSendMessage, isSending, disabled]);

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
    <div className="relative flex-1 flex flex-col h-full">
      {/* メッセージリスト */}
      <MessageList
        messages={messages}
        currentUserId={currentUserId}
        isLoading={isLoading}
        onLoadMore={onLoadMore}
        hasMore={hasMore}
      />

      {/* メッセージ入力 */}
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
      />

      {/* 送信中のローディング表示 */}
      <div className="flex-1 flex flex-col h-full relative">

        {isSending && (
          <div className="absolute bottom-20 right-4 bg-blue-500 text-white px-3 py-1 rounded-full text-sm flex items-center space-x-2">
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            <span>送信中...</span>
          </div>
        )}
      </div>
    </div>
  );
};