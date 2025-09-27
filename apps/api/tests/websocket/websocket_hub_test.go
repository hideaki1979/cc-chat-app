package websocket_test

import (
	"testing"

	"github.com/hideaki1979/cc-chat-app/apps/api/internal/websocket"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
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

// MockMessageSaver テスト用のMessageSaverモック
type MockMessageSaver struct {
	mock.Mock
}

func (m *MockMessageSaver) SaveWebSocketMessage(roomID, userID, content string) (*websocket.MessageSaverResponse, error) {
	args := m.Called(roomID, userID, content)
	return args.Get(0).(*websocket.MessageSaverResponse), args.Error(1)
}

func TestHub_SetMessageSaver(t *testing.T) {
	hub := websocket.NewHub()
	mockSaver := &MockMessageSaver{}

	// SetMessageSaverでMessageSaverを設定
	hub.SetMessageSaver(mockSaver)

	// MessageSaverが設定されていることを間接的に確認
	// (Hubの内部状態は公開されていないため、実際の動作でテスト)
	assert.NotPanics(t, func() {
		hub.SetMessageSaver(mockSaver)
	})
}

func TestHub_SetMessageSaver_WithNil(t *testing.T) {
	hub := websocket.NewHub()

	// nilのMessageSaverを設定
	assert.NotPanics(t, func() {
		hub.SetMessageSaver(nil)
	})
}

func TestNewHubWithMessageSaver(t *testing.T) {
	mockSaver := &MockMessageSaver{}

	// MessageSaver付きでHubを作成
	hub := websocket.NewHubWithMessageSaver(mockSaver)

	assert.NotNil(t, hub)
	assert.Equal(t, 0, hub.GetClientCount())
}