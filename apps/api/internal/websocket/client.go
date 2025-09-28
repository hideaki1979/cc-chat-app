package websocket

import (
	"encoding/json"
	"log"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/gorilla/websocket"
	"github.com/labstack/echo/v4"
)

const (
	// ピアにメッセージを書き込むために許可される時間
	writeWait = 10 * time.Second

	// ピアから次のpongメッセージを読み取るために許可される時間
	pongWait = 60 * time.Second

	// この期間でピアにpingを送信する。pongWaitより短くする必要がある
	pingPeriod = (pongWait * 9) / 10

	// ピアから許可される最大メッセージサイズ
	maxMessageSize = 512
)

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin: func(r *http.Request) bool {
		// 開発環境では全てのOriginを許可
		if os.Getenv("GO_ENV") == "development" {
			return true
		}

		// 本番環境ではFRONTEND_URLのみ許可
		allowed := strings.Split(os.Getenv("FRONTEND_URL"), ",")
		origin := r.Header.Get("Origin")
		for _, a := range allowed {
			if strings.TrimSpace(a) != "" && strings.EqualFold(strings.TrimSpace(a), origin) {
				return true
			}
		}
		return false
	},
}

// Message WebSocketの受信メッセージを表す
type Message struct {
	Type string          `json:"type"`
	Data json.RawMessage `json:"data"`
}

// ChatMessage チャットメッセージのデータを表す
type ChatMessage struct {
	Content string `json:"content"`
	RoomID  string `json:"room_id"`
}

// JoinRoomMessage ルーム参加メッセージのデータを表す
type JoinRoomMessage struct {
	RoomID string `json:"room_id"`
}

// readPump WebSocket接続からハブにメッセージを送信する
func (c *Client) readPump() {
	defer func() {
		c.Hub.unregister <- c
		c.Conn.Close()
	}()

	c.Conn.SetReadLimit(maxMessageSize)
	c.Conn.SetReadDeadline(time.Now().Add(pongWait))
	c.Conn.SetPongHandler(func(string) error {
		c.Conn.SetReadDeadline(time.Now().Add(pongWait))
		return nil
	})

	for {
		var msg Message
		err := c.Conn.ReadJSON(&msg)
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				log.Printf("WebSocketエラー: %v", err)
			}
			break
		}

		// メッセージタイプに応じて処理
		c.handleMessage(&msg)
	}
}

// writePump ハブからWebSocket接続にメッセージを送信する
func (c *Client) writePump() {
	ticker := time.NewTicker(pingPeriod)
	defer func() {
		ticker.Stop()
		c.Conn.Close()
	}()

	for {
		select {
		case message, ok := <-c.Send:
			c.Conn.SetWriteDeadline(time.Now().Add(writeWait))
			if !ok {
				// ハブがチャネルを閉じた
				c.Conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}

			w, err := c.Conn.NextWriter(websocket.TextMessage)
			if err != nil {
				return
			}
			w.Write(message)

			if err := w.Close(); err != nil {
				return
			}

		case <-ticker.C:
			c.Conn.SetWriteDeadline(time.Now().Add(writeWait))
			if err := c.Conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}
	}
}

// handleMessage 受信したWebSocketメッセージを処理する
func (c *Client) handleMessage(msg *Message) {
	switch msg.Type {
	case "send_message":
		// 新仕様: send_message を正式採用
		c.handleChatMessage((msg.Data))
	case "chat_message":
		c.handleChatMessage(msg.Data)
	case "join_room":
		c.handleJoinRoom(msg.Data)
	case "leave_room":
		c.handleLeaveRoom()
	case "typing_start":
		c.handleTypingStart(msg.Data)
	case "typing_stop":
		c.handleTypingStop(msg.Data)
	default:
		log.Printf("不明なメッセージタイプ: %s", msg.Type)
	}
}

// handleChatMessage チャットメッセージを処理する
func (c *Client) handleChatMessage(data json.RawMessage) {
	var chatMsg ChatMessage
	if err := json.Unmarshal(data, &chatMsg); err != nil {
		log.Printf("チャットメッセージのアンマーシャルエラー: %v", err)
		return
	}

	// ルーム検証：参加中ルームのみ許可
	if c.RoomID == "" {
		log.Printf("未参加ルームへの送信拒否: user=%s", c.ID)
		return
	}
	if chatMsg.RoomID != "" && chatMsg.RoomID != c.RoomID {
		log.Printf("不正なroom_id指定: user=%s payload=%s current=%s", c.ID, chatMsg.RoomID, c.RoomID)
		return
	}

	// 送信先は必ず現在のルーム
	roomID := c.RoomID

	// データベースにメッセージを保存してからブロードキャスト
	if c.Hub.MessageSaver != nil {
		messageResponse, err := c.Hub.MessageSaver.SaveWebSocketMessage(c.ctx, roomID, c.ID, chatMsg.Content)
		if err != nil {
			log.Printf("WebSocketメッセージのDB保存エラー: %v", err)
			// エラーメッセージを送信者に返す
			errorData := map[string]interface{}{
				"content":    "メッセージの送信に失敗しました。再試行してください。",
				"room_id":    roomID,
				"user_id":    "system",
				"timestamp":  time.Now().Unix(),
				"message_id": generateMessageID(),
				"error":      true,
			}
			errorBytes, err := json.Marshal(map[string]interface{}{
				"type": "new_message",
				"data": errorData,
			})
			if err != nil {
				log.Printf("エラーメッセージのマーシャルに失敗: %v", err)
				return
			}
			select {
			case c.Send <- errorBytes:
			default:
				log.Printf("エラーメッセージ送信失敗: user=%s", c.ID)
			}
			return
		}

		// 保存されたメッセージ情報でブロードキャスト
		messageData := map[string]interface{}{
			"content":    messageResponse.Content,
			"room_id":    roomID,
			"user_id":    messageResponse.UserID,
			"timestamp":  messageResponse.CreatedAt.Unix(),
			"message_id": messageResponse.ID,
			"file_url":   messageResponse.FileURL,
		}

		c.Hub.BroadcastToRoom(roomID, "new_message", messageData, c) // 送信者を除外してブロードキャスト
	} else {
		// MessageSaverが未設定の場合は従来通りブロードキャストのみ（後方互換性）
		log.Printf("MessageSaver未設定: DB保存をスキップしてブロードキャストのみ実行")
		messageData := map[string]interface{}{
			"content":    chatMsg.Content,
			"room_id":    roomID,
			"user_id":    c.ID,
			"timestamp":  time.Now().Unix(),
			"message_id": generateMessageID(),
		}

		c.Hub.BroadcastToRoom(roomID, "new_message", messageData, c)
	}
}

// handleJoinRoom ルーム参加リクエストを処理する
func (c *Client) handleJoinRoom(data json.RawMessage) {
	var joinMsg JoinRoomMessage
	if err := json.Unmarshal(data, &joinMsg); err != nil {
		log.Printf("ルーム参加メッセージのアンマーシャルエラー: %v", err)
		return
	}

	// ルームに参加
	c.Hub.JoinRoom(c, joinMsg.RoomID)

	// 参加確認メッセージを送信
	response := map[string]interface{}{
		"room_id": joinMsg.RoomID,
		"user_id": c.ID,
		"message": "ルームに正常に参加しました",
	}

	responseBytes, err := json.Marshal(map[string]interface{}{
		"type": "room_joined",
		"data": response,
	})

	if err != nil {
		log.Printf("ルーム参加確認メッセージのマーシャルエラー： %v", err)
		return
	}

	select {
	case c.Send <- responseBytes:
	default:
		log.Printf("クライアント %s へのルーム参加確認の送信に失敗しました", c.ID)
	}

	// 他のクライアントに参加通知
	notificationData := map[string]interface{}{
		"user_id": c.ID,
		"message": "ユーザーがルームに参加しました",
	}
	c.Hub.BroadcastToRoom(joinMsg.RoomID, "user_joined", notificationData, c)
}

// handleLeaveRoom ルーム退出リクエストを処理する
func (c *Client) handleLeaveRoom() {
	oldRoomID := c.RoomID
	c.Hub.LeaveRoom(c)

	// 退出確認メッセージを送信
	response := map[string]interface{}{
		"room_id": oldRoomID,
		"user_id": c.ID,
		"message": "ルームから正常に退出しました",
	}

	responseBytes, err := json.Marshal(map[string]interface{}{
		"type": "room_left",
		"data": response,
	})

	if err != nil {
		log.Printf("ルーム退出確認メッセージのマーシャルエラー：%v", err)
	}

	select {
	case c.Send <- responseBytes:
	default:
		log.Printf("クライアント %s へのルーム退出確認の送信に失敗しました", c.ID)
	}

	// 他のクライアントに退出通知
	if oldRoomID != "" {
		notificationData := map[string]interface{}{
			"user_id": c.ID,
			"message": "ユーザーがルームから退出しました",
		}
		c.Hub.BroadcastToRoom(oldRoomID, "user_left", notificationData, c)
	}
}

// handleTypingStart 入力開始通知を処理する
func (c *Client) handleTypingStart(data json.RawMessage) {
	var roomData map[string]string
	if err := json.Unmarshal(data, &roomData); err != nil {
		log.Printf("入力開始データのアンマーシャルエラー: %v", err)
		return
	}

	if c.RoomID == "" {
		return
	}
	roomID := c.RoomID

	typingData := map[string]interface{}{
		"user_id": c.ID,
		"room_id": roomID,
	}

	c.Hub.BroadcastToRoom(roomID, "typing_start", typingData, c)
}

// handleTypingStop 入力停止通知を処理する
func (c *Client) handleTypingStop(data json.RawMessage) {
	var roomData map[string]string
	if err := json.Unmarshal(data, &roomData); err != nil {
		log.Printf("入力停止データのアンマーシャルエラー: %v", err)
		return
	}

	if c.RoomID == "" {
		return
	}
	roomID := c.RoomID

	typingData := map[string]interface{}{
		"user_id": c.ID,
		"room_id": roomID,
	}

	c.Hub.BroadcastToRoom(roomID, "typing_stop", typingData, c)
}

// generateMessageID 一意のメッセージIDを生成する（プレースホルダー実装）
func generateMessageID() string {
	// 実際の実装では、UUIDやタイムスタンプベースのIDを生成
	return uuid.New().String()
}

// ServeWS ピアからのWebSocketリクエストを処理する
func ServeWS(hub *Hub, c echo.Context) error {
	// JWTトークンからユーザーIDを取得
	userID, ok := c.Get("user_id").(string)
	if !ok {
		return echo.NewHTTPError(http.StatusUnauthorized, "トークンにユーザーIDが見つかりません")
	}

	// WebSocket接続にアップグレード
	conn, err := upgrader.Upgrade(c.Response().Writer, c.Request(), nil)
	if err != nil {
		log.Printf("WebSocketアップグレードエラー: %v", err)
		return err
	}

	// クライアント作成
	client := &Client{
		ID:     userID,
		Conn:   conn,
		Send:   make(chan []byte, 256),
		RoomID: "", // 初期は未参加
		Hub:    hub,
	}

	// Hubに登録
	client.Hub.register <- client

	// クライアント処理を並行実行
	go client.writePump()
	go client.readPump()

	return nil
}
