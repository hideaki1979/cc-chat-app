'use client';

import React, { useMemo, useEffect, useCallback } from 'react';
// import { Virtuoso } from 'react-virtuoso'; // 仮想スクロール実装は問題があるため無効化
import type { Message } from '../../types/chat';
// useAutoScrollは仮想スクロールでは不要（Virtuosoが自動管理）
import { useChatStore } from '../../stores/chat';
import { useWebSocket } from '../../hooks/useWebSocket';
import { useUserResolver } from '../../hooks/useUserResolver';

interface MessageListProps {
  messages?: Message[]; // オプショナルにして、undefinedの場合はstoreから取得
  currentUserId?: string;
  roomId?: string; // WebSocket用のルームID
  isLoading?: boolean;
  onLoadMore?: () => void;
  hasMore?: boolean;
}

const EMPTY_MESSAGES: Message[] = [];

export const MessageList: React.FC<MessageListProps> = ({
  messages: propMessages,
  currentUserId,
  roomId,
  isLoading = false,
  onLoadMore,
  hasMore = false,
}) => {

  // WebSocket機能
  const { messages: wsMessages, joinRoom, isConnected } = useWebSocket();

  // Zustand storeから現在のルームのメッセージを取得（propsがない場合のフォールバック）
  const storeMessages = useChatStore((s) =>
    s.currentRoomId ? (s.messages[s.currentRoomId] ?? EMPTY_MESSAGES) : EMPTY_MESSAGES
  );
  // WebSocketメッセージを従来のMessage型に変換
  const convertedWsMessages = useMemo(() => {
    if (!roomId) return EMPTY_MESSAGES;

    const filtered = wsMessages.filter(msg => msg.roomId === roomId);

    return filtered.map(msg => ({
      id: msg.id,
      content: msg.content,
      room_id: roomId,
      created_at: new Date(msg.timestamp).toISOString(),
      updated_at: new Date(msg.timestamp).toISOString(),
      sender_id: msg.userId,
      user_id: msg.userId,
      sender_name: msg.userId,  // 暫定的にuseｒIDを設定
      message_type: msg.type === 'system' ? 'system' : 'text',
      is_edited: false,
    } as Message));
  }, [wsMessages, roomId]);

  // 実際に使用するメッセージ（WebSocket > props > store の優先順位）
  const messages = useMemo(() => {
    const allMessages = [...(propMessages ?? storeMessages), ...convertedWsMessages];
    const uniqueMessages = Array.from(new Map(allMessages.map(msg =>
      [msg.id, msg])).values());

    const sortedMessages = uniqueMessages.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

    return sortedMessages;
  }, [propMessages, storeMessages, convertedWsMessages]);

  // メッセージからユーザーIDを抽出
  const userIds = useMemo(() => {
    return messages.map(msg => msg.sender?.id || msg.sender_id || msg.user_id).filter(Boolean);
  }, [messages]);

  // ユーザー名解決フック
  const { getUserName } = useUserResolver(userIds);


  // ルーム参加（WebSocket）
  useEffect(() => {
    if (isConnected && roomId) {
      joinRoom(roomId);
    }
  }, [isConnected, roomId, joinRoom]);

  // 仮想スクロールでは自動スクロールは不要（Virtuosoが管理）

  // 時間計算用定数
  const MILLISECONDS_PER_MINUTE = 1000 * 60;
  const MILLISECONDS_PER_HOUR = MILLISECONDS_PER_MINUTE * 60;
  const HOURS_PER_DAY = 24;

  const dateFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat('ja-JP', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }),
    []
  );

  const formatTime = useCallback((dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / MILLISECONDS_PER_HOUR);

    if (diffHours < 1) {
      const diffMinutes = Math.floor(diffMs / MILLISECONDS_PER_MINUTE);
      return diffMinutes < 1 ? '今' : `${diffMinutes}分前`;
    } else if (diffHours < HOURS_PER_DAY) {
      return `${diffHours}時間前`;
    } else {
      return dateFormatter.format(date);
    }
  }, [dateFormatter, MILLISECONDS_PER_HOUR, MILLISECONDS_PER_MINUTE, HOURS_PER_DAY]);

  const isMyMessage = useCallback((message: Message) => {
    return (message.sender?.id || message.sender_id || message.user_id) === currentUserId;
  }, [currentUserId]);

  // MessageItemコンポーネント（仮想スクロール用に独立）
  const MessageItem = useCallback(({ message, index }: { message: Message; index: number }) => {
    const isOwn = isMyMessage(message);
    const prevMessage = index > 0 ? messages[index - 1] : null;
    const getSenderId = (msg: Message) => msg.sender?.id || msg.sender_id || msg.user_id;
    const showSender = !prevMessage || getSenderId(prevMessage) !== getSenderId(message);
    const isSystemMessage = message.message_type === 'system';

    // ユーザー名の解決
    const senderName = message.sender?.name ||
      message.sender_name ||
      getUserName(getSenderId(message));

    if (isSystemMessage) {
      return (
        <div className="flex justify-center my-4">
          <div className="bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-sm px-4 py-2 rounded-full">
            {message.content}
          </div>
        </div>
      );
    }

    return (
      <div className={`flex mb-4 ${isOwn ? 'justify-end' : 'justify-start'}`}>
        <div
          className={`flex items-end space-x-2 max-w-xs lg:max-w-md ${isOwn ? 'flex-row-reverse space-x-reverse' : ''
            }`}
        >
          {/* アバター（自分のメッセージでない場合のみ表示） */}
          {!isOwn && showSender && (
            <div className="w-8 h-8 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
              {senderName.charAt(0).toUpperCase()}
            </div>
          )}
          {!isOwn && !showSender && <div className="w-8 h-8" />}

          {/* メッセージコンテンツ */}
          <div className={`flex flex-col ${isOwn ? 'items-end' : 'items-start'}`}>
            {/* 送信者名（自分のメッセージでない場合のみ表示） */}
            {!isOwn && showSender && (
              <div className="text-xs text-gray-500 dark:text-gray-400 mb-1 px-2">{senderName}</div>
            )}

            {/* メッセージバブル */}
            <div
              className={`px-4 py-2 rounded-2xl ${isOwn
                ? 'bg-blue-500 text-white'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white'
                } ${isOwn ? 'rounded-br-md' : 'rounded-bl-md'} max-w-full break-words`}
            >
              <p className="text-sm whitespace-pre-wrap">{message.content}</p>

              {/* 編集済みマーク */}
              {message.is_edited && (
                <div
                  className={`text-xs mt-1 ${isOwn ? 'text-blue-100' : 'text-gray-500 dark:text-gray-400'
                    }`}
                >
                  編集済み
                </div>
              )}
            </div>

            {/* タイムスタンプ */}
            <div
              className={`text-xs text-gray-500 dark:text-gray-400 mt-1 px-2 ${isOwn ? 'text-right' : 'text-left'
                }`}
            >
              {formatTime(message.created_at)}
            </div>
          </div>
        </div>
      </div>
    );
  }, [messages, getUserName, formatTime, isMyMessage]);

  // デバッグログは削除（必要時に再追加）

  return (
    <div className="flex-1 bg-gray-50 dark:bg-gray-900">
      {messages.length === 0 ? (
        // 空状態の表示
        <div className="flex items-center justify-center h-full">
          <div className="text-center text-gray-500 dark:text-gray-400">
            <svg
              className="w-12 h-12 mx-auto mb-4 opacity-50"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path d="M2 5a2 2 0 012-2h7a2 2 0 012 2v4a2 2 0 01-2 2H9l-3 3v-3H4a2 2 0 01-2-2V5z" />
              <path d="M15 7v2a4 4 0 01-4 4H9.828l-1.766 1.767c.28.149.599.233.938.233h2l3 3v-3h2a2 2 0 002-2V9a2 2 0 00-2-2h-1z" />
            </svg>
            <p className="text-sm">メッセージはまだありません</p>
            <p className="text-xs mt-1">最初のメッセージを送信してチャットを開始しましょう</p>
          </div>
        </div>
      ) : (
        // 【最終版】通常スクロール実装 - 安定性重視
        <div className="h-full overflow-y-auto">
          {/* 過去メッセージ読み込みボタン */}
          {hasMore && onLoadMore && (
            <div className="text-center py-4">
              <button
                onClick={onLoadMore}
                disabled={isLoading}
                className="px-4 py-2 text-sm text-blue-500 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors disabled:opacity-50"
              >
                {isLoading ? '読み込み中...' : '過去のメッセージを読み込む'}
              </button>
            </div>
          )}

          {/* メッセージリスト */}
          {messages.map((message, index) => (
            <div key={message.id} className="px-6 py-2">
              <MessageItem message={message} index={index} />
            </div>
          ))}
        </div>

        /*
        【仮想スクロール実装の問題】
        Virtuosoライブラリはメッセージリストでの使用において、
        以下の問題が発生することが判明：

        1. followOutput設定の競合問題
        2. data vs totalCount + itemContentの混在問題
        3. 初期表示での描画されない問題
        4. alignToBottomとinitialTopMostItemIndexの競合

        大量のメッセージがある場合は将来的にVirtuosoを再検討するが、
        現状では安定性を重視して通常スクロールを採用。
        */
      )}
    </div>
  );
};