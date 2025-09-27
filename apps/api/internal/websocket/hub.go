package websocket

import (
	"encoding/json"
	"log"
	"sync"
	"time"

	"github.com/gorilla/websocket"
)

// MessageSaverResponse WebSocketメッセージをデータベースに保存した結果を表す
type MessageSaverResponse struct {
	ID        string    `json:"id"`
	Content   string    `json:"content"`
	UserID    string    `json:"user_id"`
	RoomID    string    `json:"room_id"`
	CreatedAt time.Time `json:"created_at"`
	FileURL   *string   `json:"file_url,omitempty"`
}

// MessageSaver WebSocketメッセージをデータベースに保存するためのインターフェース
type MessageSaver interface {
	SaveWebSocketMessage(roomID, userID, content string) (*MessageSaverResponse, error)
}

// Client 接続されたクライアントを表す
type Client struct {
	ID     string          // クライアントID（ユーザーID）
	Conn   *websocket.Conn // WebSocket接続
	Send   chan []byte     // メッセージ送信チャネル
	RoomID string          // 現在のチャットルームID
	Hub    *Hub            // Hubへの参照
}

// Hub アクティブなクライアントのセットを維持し、メッセージをブロードキャストする
type Hub struct {
	// 登録されたクライアント
	clients map[*Client]bool

	// ルームごとのクライアント管理
	rooms map[string]map[*Client]bool

	// クライアントからのメッセージ
	broadcast chan *BroadcastMessage

	// クライアントの登録リクエスト
	register chan *Client

	// クライアントの登録解除リクエスト
	unregister chan *Client

	// WebSocketメッセージをデータベースに保存するためのサービス（オプショナル）
	MessageSaver MessageSaver

	// 並行安全性のためのmutex
	mu sync.RWMutex
}

// BroadcastMessage ブロードキャストされるメッセージを表す
type BroadcastMessage struct {
	Type    string      `json:"type"`
	Data    interface{} `json:"data"`
	RoomID  string      `json:"room_id,omitempty"`
	UserID  string      `json:"user_id,omitempty"`
	Exclude *Client     `json:"-"` // 送信対象から除外するクライアント
}

// NewHub 新しいHubを作成する
func NewHub() *Hub {
	return &Hub{
		clients:    make(map[*Client]bool),
		rooms:      make(map[string]map[*Client]bool),
		broadcast:  make(chan *BroadcastMessage, 1024),
		register:   make(chan *Client),
		unregister: make(chan *Client),
	}
}

// NewHubWithMessageSaver MessageSaver付きで新しいHubを作成する
func NewHubWithMessageSaver(messageSaver MessageSaver) *Hub {
	hub := NewHub()
	hub.MessageSaver = messageSaver
	return hub
}

// Run ハブを開始する
func (h *Hub) Run() {
	for {
		select {
		case client := <-h.register:
			h.registerClient(client)

		case client := <-h.unregister:
			h.unregisterClient(client)

		case message := <-h.broadcast:
			h.broadcastMessage(message)
		}
	}
}

// registerClient 新しいクライアントを登録する
func (h *Hub) registerClient(client *Client) {
	h.mu.Lock()

	h.clients[client] = true

	// ルームに参加
	if client.RoomID != "" {
		if h.rooms[client.RoomID] == nil {
			h.rooms[client.RoomID] = make(map[*Client]bool)
		}
		h.rooms[client.RoomID][client] = true
	}

	log.Printf("Client %s connected to room %s", client.ID, client.RoomID)
	sendCh := client.Send
	h.mu.Unlock()

	// 接続確認メッセージを送信
	sendCh <- []byte(`{"type":"connected","data":{"message":"WebSocket connected"}}`)
}

// unregisterClient クライアントの登録を解除する
func (h *Hub) unregisterClient(client *Client) {
	h.mu.Lock()
	defer h.mu.Unlock()

	if _, ok := h.clients[client]; ok {
		delete(h.clients, client)
		close(client.Send)

		// ルームから削除
		if client.RoomID != "" && h.rooms[client.RoomID] != nil {
			delete(h.rooms[client.RoomID], client)
			if len(h.rooms[client.RoomID]) == 0 {
				delete(h.rooms, client.RoomID)
			}
		}

		log.Printf("Client %s disconnected from room %s", client.ID, client.RoomID)
	}
}

// broadcastMessage 適切なクライアントにメッセージをブロードキャストする
func (h *Hub) broadcastMessage(message *BroadcastMessage) {
	h.mu.Lock()
	defer h.mu.Unlock()

	var targetClients map[*Client]bool

	if message.RoomID != "" {
		// 特定のルームにブロードキャスト
		targetClients = h.rooms[message.RoomID]
	} else {
		// 全クライアントにブロードキャスト
		targetClients = h.clients
	}

	if targetClients == nil {
		return
	}

	// メッセージをJSONエンコード
	messageBytes, err := json.Marshal(message)
	if err != nil {
		log.Printf("Error marshaling message: %v", err)
		return
	}

	for client := range targetClients {
		// 除外対象チェック
		if message.Exclude != nil && client == message.Exclude {
			continue
		}

		select {
		case client.Send <- messageBytes:
		default:
			// 送信できない場合はクライアントを削除
			if _, ok := h.clients[client]; ok {
				delete(h.clients, client)
				close(client.Send)
			}
			if client.RoomID != "" && h.rooms[client.RoomID] != nil {
				delete(h.rooms[client.RoomID], client)
			}
		}
	}
}

// BroadcastToRoom 特定のルームにメッセージをブロードキャストする
func (h *Hub) BroadcastToRoom(roomID string, messageType string, data any, exclude *Client) {
	message := &BroadcastMessage{
		Type:    messageType,
		Data:    data,
		RoomID:  roomID,
		Exclude: exclude,
	}

	h.broadcast <- message
}

// BroadcastToAll 接続されている全クライアントにメッセージをブロードキャストする
func (h *Hub) BroadcastToAll(messageType string, data interface{}) {
	message := &BroadcastMessage{
		Type: messageType,
		Data: data,
	}

	h.broadcast <- message
}

// GetRoomClients ルーム内のクライアント数を返す
func (h *Hub) GetRoomClients(roomID string) int {
	h.mu.RLock()
	defer h.mu.RUnlock()

	if room, exists := h.rooms[roomID]; exists {
		return len(room)
	}
	return 0
}

// GetClientCount 接続されているクライアントの総数を返す
func (h *Hub) GetClientCount() int {
	h.mu.RLock()
	defer h.mu.RUnlock()

	return len(h.clients)
}

// JoinRoom クライアントをルームに追加する
func (h *Hub) JoinRoom(client *Client, roomID string) {
	h.mu.Lock()
	defer h.mu.Unlock()

	// 既存のルームから削除
	if client.RoomID != "" && h.rooms[client.RoomID] != nil {
		delete(h.rooms[client.RoomID], client)
		if len(h.rooms[client.RoomID]) == 0 {
			delete(h.rooms, client.RoomID)
		}
	}

	// 新しいルームに参加
	client.RoomID = roomID
	if h.rooms[roomID] == nil {
		h.rooms[roomID] = make(map[*Client]bool)
	}
	h.rooms[roomID][client] = true

	log.Printf("Client %s joined room %s", client.ID, roomID)
}

// LeaveRoom クライアントを現在のルームから削除する
func (h *Hub) LeaveRoom(client *Client) {
	h.mu.Lock()
	defer h.mu.Unlock()

	if client.RoomID != "" && h.rooms[client.RoomID] != nil {
		delete(h.rooms[client.RoomID], client)
		if len(h.rooms[client.RoomID]) == 0 {
			delete(h.rooms, client.RoomID)
		}
		log.Printf("Client %s left room %s", client.ID, client.RoomID)
		client.RoomID = ""
	}
}

// SetMessageSaver MessageSaverを後から設定する
func (h *Hub) SetMessageSaver(messageSaver MessageSaver) {
	h.mu.Lock()
	defer h.mu.Unlock()
	h.MessageSaver = messageSaver
}
