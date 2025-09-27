'use client';

import { useEffect } from 'react';
import { useWebSocketStore } from '../../stores/websocket';
import { useChatStore } from '../../stores/chat';

/**
 * WebSocketとChatStoreの統合を初期化するコンポーネント
 * アプリケーションの起動時に一度だけ実行される
 */
export function WebSocketIntegration() {
  const { setChatStoreIntegration } = useWebSocketStore();
  const { upsertMessage } = useChatStore();

  useEffect(() => {
    // WebSocketStoreにChatStoreのupsertMessage関数を設定
    setChatStoreIntegration(upsertMessage);
    console.log('🔗 WebSocket-ChatStore integration initialized');

    // クリーンアップは不要（アプリ全体で一度だけ設定）
  }, [setChatStoreIntegration, upsertMessage]);

  // このコンポーネントは何もレンダリングしない
  return null;
}