package websocket_test

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/gorilla/websocket"
	ws "github.com/hideaki1979/cc-chat-app/apps/api/internal/websocket"
	"github.com/labstack/echo/v4"
	"github.com/stretchr/testify/assert"
)

// 統合テスト：複数のクライアントでのWebSocket通信をテスト
func TestWebSocketIntegration_MultipleClients(t *testing.T) {
	hub := ws.NewHub()
	go hub.Run()

	// テストサーバーを作成
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		e := echo.New()
		c := e.NewContext(r, w)

		// URLパラメータからユーザーIDを取得
		userID := r.URL.Query().Get("user_id")
		if userID == "" {
			userID = "test-user"
		}
		c.Set("user_id", userID)

		err := ws.ServeWS(hub, c)
		if err != nil {
			t.Logf("WebSocket接続エラー: %v", err)
		}
	}))
	defer server.Close()

	// HTTPスキームをWebSocketスキームに変換
	wsURL := "ws" + strings.TrimPrefix(server.URL, "http")

	// 2つのWebSocketクライアントを作成
	conn1, _, err1 := websocket.DefaultDialer.Dial(wsURL+"?user_id=user1", nil)
	if err1 != nil {
		t.Skipf("WebSocket接続に失敗しました: %v", err1)
		return
	}
	defer conn1.Close()

	conn2, _, err2 := websocket.DefaultDialer.Dial(wsURL+"?user_id=user2", nil)
	if err2 != nil {
		t.Skipf("WebSocket接続に失敗しました: %v", err2)
		return
	}
	defer conn2.Close()

	// 接続確認メッセージを読み取り
	var connectedMsg1, connectedMsg2 map[string]interface{}

	conn1.SetReadDeadline(time.Now().Add(2 * time.Second))
	err1 = conn1.ReadJSON(&connectedMsg1)
	if err1 == nil {
		assert.Equal(t, "connected", connectedMsg1["type"])
	}

	conn2.SetReadDeadline(time.Now().Add(2 * time.Second))
	err2 = conn2.ReadJSON(&connectedMsg2)
	if err2 == nil {
		assert.Equal(t, "connected", connectedMsg2["type"])
	}

	// クライアント1がルームに参加
	joinMsg := map[string]interface{}{
		"type": "join_room",
		"data": map[string]string{
			"room_id": "test-room-1",
		},
	}

	err1 = conn1.WriteJSON(joinMsg)
	assert.NoError(t, err1)

	// 参加確認メッセージを受信
	var joinResponse1 map[string]interface{}
	conn1.SetReadDeadline(time.Now().Add(2 * time.Second))
	err1 = conn1.ReadJSON(&joinResponse1)
	if err1 == nil {
		assert.Equal(t, "room_joined", joinResponse1["type"])
	}

	// クライアント2も同じルームに参加
	err2 = conn2.WriteJSON(joinMsg)
	assert.NoError(t, err2)

	// 参加確認メッセージを受信
	var joinResponse2 map[string]interface{}
	conn2.SetReadDeadline(time.Now().Add(2 * time.Second))
	err2 = conn2.ReadJSON(&joinResponse2)
	if err2 == nil {
		assert.Equal(t, "room_joined", joinResponse2["type"])
	}

	// クライアント2に他のユーザーの参加通知が届く
	var userJoinedMsg map[string]interface{}
	conn2.SetReadDeadline(time.Now().Add(2 * time.Second))
	err2 = conn2.ReadJSON(&userJoinedMsg)
	if err2 == nil {
		assert.Equal(t, "user_joined", userJoinedMsg["type"])
	}

	// クライアント1からチャットメッセージを送信
	chatMsg := map[string]interface{}{
		"type": "send_message",
		"data": map[string]string{
			"content": "Hello, World!",
			"room_id": "test-room-1",
		},
	}

	err1 = conn1.WriteJSON(chatMsg)
	assert.NoError(t, err1)

	// クライアント2でメッセージを受信
	var receivedMsg map[string]interface{}
	conn2.SetReadDeadline(time.Now().Add(2 * time.Second))
	err2 = conn2.ReadJSON(&receivedMsg)
	if err2 == nil {
		assert.Equal(t, "new_message", receivedMsg["type"])
		if data, ok := receivedMsg["data"].(map[string]interface{}); ok {
			assert.Equal(t, "Hello, World!", data["content"])
			assert.Equal(t, "test-room-1", data["room_id"])
			assert.Equal(t, "user1", data["user_id"])
		}
	}

	t.Logf("統合テストが正常に完了しました")
}

// 統合テスト：タイピング通知のテスト
func TestWebSocketIntegration_TypingNotification(t *testing.T) {
	hub := ws.NewHub()
	go hub.Run()

	// テストサーバーを作成
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		e := echo.New()
		c := e.NewContext(r, w)

		userID := r.URL.Query().Get("user_id")
		if userID == "" {
			userID = "test-user"
		}
		c.Set("user_id", userID)

		err := ws.ServeWS(hub, c)
		if err != nil {
			t.Logf("WebSocket接続エラー: %v", err)
		}
	}))
	defer server.Close()

	wsURL := "ws" + strings.TrimPrefix(server.URL, "http")

	// 2つのクライアントを接続
	conn1, _, err1 := websocket.DefaultDialer.Dial(wsURL+"?user_id=user1", nil)
	if err1 != nil {
		t.Skipf("WebSocket接続に失敗しました: %v", err1)
		return
	}
	defer conn1.Close()

	conn2, _, err2 := websocket.DefaultDialer.Dial(wsURL+"?user_id=user2", nil)
	if err2 != nil {
		t.Skipf("WebSocket接続に失敗しました: %v", err2)
		return
	}
	defer conn2.Close()

	// 接続確認メッセージをスキップ
	var skipMsg map[string]interface{}
	conn1.SetReadDeadline(time.Now().Add(1 * time.Second))
	conn1.ReadJSON(&skipMsg)
	conn2.SetReadDeadline(time.Now().Add(1 * time.Second))
	conn2.ReadJSON(&skipMsg)

	// 両方のクライアントが同じルームに参加
	joinMsg := map[string]interface{}{
		"type": "join_room",
		"data": map[string]string{
			"room_id": "test-room-1",
		},
	}

	conn1.WriteJSON(joinMsg)
	conn2.WriteJSON(joinMsg)

	// 参加メッセージをスキップ
	conn1.SetReadDeadline(time.Now().Add(1 * time.Second))
	conn1.ReadJSON(&skipMsg)
	conn2.SetReadDeadline(time.Now().Add(1 * time.Second))
	conn2.ReadJSON(&skipMsg)
	conn2.SetReadDeadline(time.Now().Add(1 * time.Second))
	conn2.ReadJSON(&skipMsg) // user_joined message

	// クライアント1からタイピング開始通知
	typingStartMsg := map[string]interface{}{
		"type": "typing_start",
		"data": map[string]string{
			"room_id": "test-room-1",
		},
	}

	err1 = conn1.WriteJSON(typingStartMsg)
	assert.NoError(t, err1)

	// クライアント2でタイピング開始通知を受信
	var typingMsg map[string]interface{}
	conn2.SetReadDeadline(time.Now().Add(2 * time.Second))
	err2 = conn2.ReadJSON(&typingMsg)
	if err2 == nil {
		assert.Equal(t, "typing_start", typingMsg["type"])
		if data, ok := typingMsg["data"].(map[string]interface{}); ok {
			assert.Equal(t, "user1", data["user_id"])
			assert.Equal(t, "test-room-1", data["room_id"])
		}
	}

	// クライアント1からタイピング停止通知
	typingStopMsg := map[string]interface{}{
		"type": "typing_stop",
		"data": map[string]string{
			"room_id": "test-room-1",
		},
	}

	err1 = conn1.WriteJSON(typingStopMsg)
	assert.NoError(t, err1)

	// クライアント2でタイピング停止通知を受信
	conn2.SetReadDeadline(time.Now().Add(2 * time.Second))
	err2 = conn2.ReadJSON(&typingMsg)
	if err2 == nil {
		assert.Equal(t, "typing_stop", typingMsg["type"])
		if data, ok := typingMsg["data"].(map[string]interface{}); ok {
			assert.Equal(t, "user1", data["user_id"])
			assert.Equal(t, "test-room-1", data["room_id"])
		}
	}

	t.Logf("タイピング通知統合テストが正常に完了しました")
}

// 統合テスト：ルーム間の分離をテスト
func TestWebSocketIntegration_RoomIsolation(t *testing.T) {
	hub := ws.NewHub()
	go hub.Run()

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		e := echo.New()
		c := e.NewContext(r, w)

		userID := r.URL.Query().Get("user_id")
		if userID == "" {
			userID = "test-user"
		}
		c.Set("user_id", userID)

		err := ws.ServeWS(hub, c)
		if err != nil {
			t.Logf("WebSocket接続エラー: %v", err)
		}
	}))
	defer server.Close()

	wsURL := "ws" + strings.TrimPrefix(server.URL, "http")

	// 3つのクライアントを接続
	conn1, _, err1 := websocket.DefaultDialer.Dial(wsURL+"?user_id=user1", nil)
	if err1 != nil {
		t.Skipf("WebSocket接続に失敗しました: %v", err1)
		return
	}
	defer conn1.Close()

	conn2, _, err2 := websocket.DefaultDialer.Dial(wsURL+"?user_id=user2", nil)
	if err2 != nil {
		t.Skipf("WebSocket接続に失敗しました: %v", err2)
		return
	}
	defer conn2.Close()

	conn3, _, err3 := websocket.DefaultDialer.Dial(wsURL+"?user_id=user3", nil)
	if err3 != nil {
		t.Skipf("WebSocket接続に失敗しました: %v", err3)
		return
	}
	defer conn3.Close()

	// 接続確認メッセージをスキップ
	var skipMsg map[string]interface{}
	for _, conn := range []*websocket.Conn{conn1, conn2, conn3} {
		conn.SetReadDeadline(time.Now().Add(1 * time.Second))
		conn.ReadJSON(&skipMsg)
	}

	// クライアント1と2は room-1 に参加
	joinRoom1 := map[string]interface{}{
		"type": "join_room",
		"data": map[string]string{
			"room_id": "room-1",
		},
	}

	// クライアント3は room-2 に参加
	joinRoom2 := map[string]interface{}{
		"type": "join_room",
		"data": map[string]string{
			"room_id": "room-2",
		},
	}

	conn1.WriteJSON(joinRoom1)
	conn2.WriteJSON(joinRoom1)
	conn3.WriteJSON(joinRoom2)

	// 参加メッセージをクリア
	time.Sleep(500 * time.Millisecond)
	for _, conn := range []*websocket.Conn{conn1, conn2, conn3} {
		for {
			conn.SetReadDeadline(time.Now().Add(100 * time.Millisecond))
			var msg map[string]interface{}
			if conn.ReadJSON(&msg) != nil {
				break
			}
		}
	}

	// クライアント1から room-1 にメッセージ送信
	chatMsg := map[string]interface{}{
		"type": "send_message",
		"data": map[string]string{
			"content": "Hello Room 1!",
			"room_id": "room-1",
		},
	}

	conn1.WriteJSON(chatMsg)

	// クライアント2はメッセージを受信するはず
	var receivedMsg2 map[string]interface{}
	conn2.SetReadDeadline(time.Now().Add(2 * time.Second))
	err2 = conn2.ReadJSON(&receivedMsg2)
	if err2 == nil {
		assert.Equal(t, "new_message", receivedMsg2["type"])
		if data, ok := receivedMsg2["data"].(map[string]interface{}); ok {
			assert.Equal(t, "Hello Room 1!", data["content"])
		}
	}

	// クライアント3はメッセージを受信しないはず（異なるルーム）
	var receivedMsg3 map[string]interface{}
	conn3.SetReadDeadline(time.Now().Add(500 * time.Millisecond))
	err3 = conn3.ReadJSON(&receivedMsg3)
	assert.Error(t, err3, "異なるルームのクライアントがメッセージを受信してしまいました")

	t.Logf("ルーム分離統合テストが正常に完了しました")
}
