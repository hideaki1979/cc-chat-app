// WebSocketイベントタイプ定義
export interface WebSocketMessage {
  type: string;
  data: unknown;
}

export interface ChatMessageData {
  content: string;
  room_id: string;
  user_id?: string;
  timestamp?: number;
  message_id?: string;
}

export interface JoinRoomData {
  room_id: string;
}

export interface TypingData {
  user_id: string;
  room_id: string;
}

export interface WebSocketConfig {
  url: string;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
}

export interface WebSocketCallbacks {
  onOpen?: (event: Event) => void;
  onClose?: (event: CloseEvent) => void;
  onError?: (event: Event) => void;
  onMessage?: (message: WebSocketMessage) => void;
  onReconnect?: (attempt: number) => void;
  onReconnectFailed?: () => void;
}

export class WebSocketClient {
  private ws: WebSocket | null = null;
  private config: Required<WebSocketConfig>;
  private callbacks: WebSocketCallbacks = {};
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private isManualClose = false;

  constructor(config: WebSocketConfig) {
    this.config = {
      reconnectInterval: 5000, // 5秒
      maxReconnectAttempts: 10,
      ...config,
    };
  }

  // コールバック設定
  setCallbacks(callbacks: WebSocketCallbacks): void {
    this.callbacks = { ...this.callbacks, ...callbacks };
  }

  // WebSocket接続
  connect(): void {
    if (typeof window === 'undefined' || typeof WebSocket === 'undefined') {
      console.warn('WebSocket未対応環境のため接続をスキップします');
      return;
    }
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      console.log('WebSocket already connected');
      return;
    }

    try {
      // WebSocket URL作成（HTTP -> WS, HTTPS -> WSS）
      const wsUrl = this.config.url.replace(/^http/, 'ws');
      console.log('WebSocket接続を開始:', wsUrl);

      this.ws = new WebSocket(wsUrl);
      this.setupEventListeners();
    } catch (error) {
      console.error('WebSocket接続エラー:', error);
      this.callbacks.onError?.(error as Event);
      this.scheduleReconnect();
    }
  }

  // WebSocket切断
  disconnect(): void {
    this.isManualClose = true;
    this.clearTimers();

    if (this.ws) {
      this.ws.close(1000, 'Manual disconnect');
      this.ws = null;
    }
  }

  // メッセージ送信
  send(type: string, data: unknown): boolean {
    if (this.ws?.readyState !== WebSocket.OPEN) {
      console.warn('WebSocket未接続のためメッセージを送信できません');
      return false;
    }

    try {
      const message: WebSocketMessage = { type, data };
      this.ws.send(JSON.stringify(message));
      return true;
    } catch (error) {
      console.error('メッセージ送信エラー:', error);
      return false;
    }
  }

  // チャットルーム参加
  joinRoom(roomId: string): boolean {
    const data: JoinRoomData = { room_id: roomId };
    return this.send('join_room', data);
  }

  // チャットルーム退出
  leaveRoom(): boolean {
    return this.send('leave_room', {});
  }

  // チャットメッセージ送信
  sendChatMessage(content: string, roomId: string): boolean {
    const data: ChatMessageData = { content, room_id: roomId };
    return this.send('chat_message', data);
  }

  // タイピング開始通知
  startTyping(roomId: string): boolean {
    return this.send('typing_start', { room_id: roomId });
  }

  // タイピング停止通知
  stopTyping(roomId: string): boolean {
    return this.send('typing_stop', { room_id: roomId });
  }

  // 接続状態取得
  getConnectionState(): number {
    const CLOSED = typeof WebSocket !== 'undefined' ? WebSocket.CLOSED : 3;
    return this.ws?.readyState ?? CLOSED;
  }

  // 接続中かどうか
  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  // イベントリスナー設定
  private setupEventListeners(): void {
    if (!this.ws) return;

    this.ws.onopen = (event) => {
      console.log('WebSocket接続成功');
      this.reconnectAttempts = 0;
      this.isManualClose = false;
      this.callbacks.onOpen?.(event);
    };

    this.ws.onclose = (event) => {
      console.log('WebSocket接続終了:', event.code, event.reason);
      this.clearTimers();
      this.callbacks.onClose?.(event);

      // 手動切断でない場合は再接続を試行
      if (!this.isManualClose && event.code !== 1000) {
        this.scheduleReconnect();
      }
    };

    this.ws.onerror = (event) => {
      console.error('WebSocketエラー:', event);
      this.callbacks.onError?.(event);
    };

    this.ws.onmessage = (event) => {
      try {
        const message: WebSocketMessage = JSON.parse(event.data);
        this.handleMessage(message);
      } catch (error) {
        console.error('メッセージパースエラー:', error);
      }
    };
  }

  // メッセージ処理
  private handleMessage(message: WebSocketMessage): void {
    console.log('WebSocketメッセージ受信:', message);

    // コールバック実行
    this.callbacks.onMessage?.(message);
  }

  // 再接続スケジュール
  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.config.maxReconnectAttempts) {
      console.error('最大再接続試行回数に達しました');
      this.callbacks.onReconnectFailed?.();
      return;
    }

    this.reconnectAttempts++;
    console.log(`${this.config.reconnectInterval}ms後に再接続を試行 (${this.reconnectAttempts}/${this.config.maxReconnectAttempts})`);

    this.reconnectTimer = setTimeout(() => {
      this.callbacks.onReconnect?.(this.reconnectAttempts);
      this.connect();
    }, this.config.reconnectInterval);
  }

  // タイマー削除
  private clearTimers(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }
}

// WebSocketインスタンス作成ファクトリ
export function createWebSocketClient(): WebSocketClient {
  const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3003/api/backend';
  const wsUrl = `${baseUrl}/ws`;

  return new WebSocketClient({
    url: wsUrl,
  });
}