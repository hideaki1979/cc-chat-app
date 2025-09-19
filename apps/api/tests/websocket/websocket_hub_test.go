package websocket_test

import (
	"testing"

	"github.com/hideaki1979/cc-chat-app/apps/api/internal/websocket"
	"github.com/stretchr/testify/assert"
)

func TestNewHub(t *testing.T) {
	hub := websocket.NewHub()

	assert.NotNil(t, hub)
	assert.Equal(t, 0, hub.GetClientCount())
}

func TestHub_GetClientCount(t *testing.T) {
	hub := websocket.NewHub()

	// 初期状態では0
	assert.Equal(t, 0, hub.GetClientCount())
}

func TestHub_GetRoomClients(t *testing.T) {
	hub := websocket.NewHub()

	// 存在しないルーム
	assert.Equal(t, 0, hub.GetRoomClients("non-existent-room"))
}

func TestHub_BroadcastToRoom(t *testing.T) {
	hub := websocket.NewHub()
	go hub.Run()

	// メッセージのブロードキャストが正常に動作することを確認
	// (実際のクライアントがいない場合でもパニックしない)
	assert.NotPanics(t, func() {
		hub.BroadcastToRoom("test-room", "test_message", "Hello", nil)
	})
}

func TestHub_BroadcastToAll(t *testing.T) {
	hub := websocket.NewHub()
	go hub.Run()

	// 全体ブロードキャストが正常に動作することを確認
	assert.NotPanics(t, func() {
		hub.BroadcastToAll("global_message", "Hello Everyone!")
	})
}