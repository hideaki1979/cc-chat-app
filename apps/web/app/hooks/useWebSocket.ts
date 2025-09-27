'use client';

import { useEffect, useCallback } from 'react';
import { useWebSocketStore } from '../stores/websocket';
import { useAuthStore } from '../stores/auth';

export function useWebSocket() {
  const {
    client,
    isConnected,
    isConnecting,
    connectionError,
    reconnectAttempts,
    currentRoomId,
    messages,
    typingUsers,
    connect,
    disconnect,
    joinRoom,
    leaveRoom,
    sendMessage,
    startTyping,
    stopTyping,
    clearMessages,
  } = useWebSocketStore();

  const { user, accessToken } = useAuthStore();
  const isLoggedIn = !!user;
  const userId = user?.id; // 安定した参照を作成

  // 認証状態に基づいてWebSocket接続を管理
  useEffect(() => {
    console.log('🔍 WebSocket接続状態チェック:', {
      isLoggedIn,
      hasClient: !!client,
      isConnecting,
      isConnected,
      hasAccessToken: !!accessToken,
      userId
    });

    if (isLoggedIn && !client && !isConnecting) {
      // ログイン済みでまだ接続していないかつ接続中でもない場合は接続
      console.log('🔌 WebSocket自動接続を開始');
      connect(); // トークンは引数を渡さずCookieから自動取得
    } else if (!isLoggedIn && client) {
      // ログアウトした場合は切断
      console.log('🔌 ログアウトによりWebSocket切断');
      disconnect();
    }
  }, [isLoggedIn, client, isConnecting, isConnected, connect, disconnect, accessToken, userId]);

  // コンポーネントのアンマウント時に切断
  useEffect(() => {
    return () => {
      if (client) {
        disconnect();
      }
    };
  }, [client, disconnect]);

  // WebSocket接続を手動で開始
  const handleConnect = useCallback(() => {
    console.log('🔌 手動WebSocket接続開始:', { isLoggedIn });
    if (isLoggedIn) {
      connect(); // Cookieから自動取得
    }
  }, [isLoggedIn, connect]);

  // WebSocket接続を手動で切断
  const handleDisconnect = useCallback(() => {
    disconnect();
  }, [disconnect]);

  // ルームに参加
  const handleJoinRoom = useCallback((roomId: string) => {
    if (isConnected) {
      joinRoom(roomId);
    }
  }, [isConnected, joinRoom]);

  // ルームから退出
  const handleLeaveRoom = useCallback(() => {
    if (isConnected) {
      leaveRoom();
    }
  }, [isConnected, leaveRoom]);

  // メッセージを送信
  const handleSendMessage = useCallback((content: string, roomId: string) => {
    if (isConnected && content.trim()) {
      sendMessage(content, roomId, userId);
    }
  }, [isConnected, sendMessage, userId]);

  // タイピング状態を開始
  const handleStartTyping = useCallback((roomId: string) => {
    if (isConnected) {
      startTyping(roomId);
    }
  }, [isConnected, startTyping]);

  // タイピング状態を停止
  const handleStopTyping = useCallback((roomId: string) => {
    if (isConnected) {
      stopTyping(roomId);
    }
  }, [isConnected, stopTyping]);

  // メッセージをクリア
  const handleClearMessages = useCallback(() => {
    clearMessages();
  }, [clearMessages]);

  // 接続状態の説明テキストを取得
  const getConnectionStatusText = useCallback(() => {
    if (isConnecting) {
      return reconnectAttempts > 0
        ? `再接続中... (${reconnectAttempts}回目)`
        : '接続中...';
    }
    if (isConnected) {
      return '接続済み';
    }
    if (connectionError) {
      return `接続エラー: ${connectionError}`;
    }
    return '未接続';
  }, [isConnecting, isConnected, connectionError, reconnectAttempts]);

  // タイピング中のユーザー一覧を取得（自分以外）
  const getTypingUsersList = useCallback(() => {
    // 実際のユーザー情報取得は別途実装が必要
    return Array.from(typingUsers);
  }, [typingUsers]);

  return {
    // 状態
    isConnected,
    isConnecting,
    connectionError,
    reconnectAttempts,
    currentRoomId,
    messages,
    typingUsers: getTypingUsersList(),

    // アクション
    connect: handleConnect,
    disconnect: handleDisconnect,
    joinRoom: handleJoinRoom,
    leaveRoom: handleLeaveRoom,
    sendMessage: handleSendMessage,
    startTyping: handleStartTyping,
    stopTyping: handleStopTyping,
    clearMessages: handleClearMessages,

    // ユーティリティ
    getConnectionStatusText,
  };
}