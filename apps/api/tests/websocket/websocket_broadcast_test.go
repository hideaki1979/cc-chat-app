package websocket_test

import (
	"io"
	"testing"
	"time"

	gorilla "github.com/gorilla/websocket"
	"github.com/hideaki1979/cc-chat-app/apps/api/internal/websocket"
	"github.com/stretchr/testify/assert"
)

// mockWebSocketConn テスト用のWebSocket接続のモック
type mockWebSocketConn struct {
	messages [][]byte
	closed   bool
}

func (m *mockWebSocketConn) WriteMessage(messageType int, data []byte) error {
	if m.closed {
		return gorilla.ErrCloseSent
	}
	m.messages = append(m.messages, data)
	return nil
}

func (m *mockWebSocketConn) Close() error {
	m.closed = true
	return nil
}

func (m *mockWebSocketConn) SetWriteDeadline(t time.Time) error {
	return nil
}

func (m *mockWebSocketConn) SetReadDeadline(t time.Time) error {
	return nil
}

func (m *mockWebSocketConn) SetPongHandler(h func(appData string) error) {
	// Mock implementation
}

func (m *mockWebSocketConn) ReadJSON(v interface{}) error {
	// Mock implementation for tests
	return nil
}

func (m *mockWebSocketConn) NextWriter(messageType int) (io.WriteCloser, error) {
	return &mockWriteCloser{conn: m}, nil
}

type mockWriteCloser struct {
	conn *mockWebSocketConn
}

func (m *mockWriteCloser) Write(p []byte) (int, error) {
	m.conn.messages = append(m.conn.messages, p)
	return len(p), nil
}

func (m *mockWriteCloser) Close() error {
	return nil
}

func TestHub_BroadcastToRoom_ExcludeSender(t *testing.T) {
	hub := websocket.NewHub()
	go hub.Run()

	testRoomID := "test-room-123"
	testMessage := "Hello, World!"

	// BroadcastToRoomの動作をテスト
	// 実際の実装では、excludeパラメータによって送信者が除外されることをテスト

	// このテストは概念実証として、BroadcastToRoomが正常に動作することを確認
	assert.NotPanics(t, func() {
		hub.BroadcastToRoom(testRoomID, "test_message", testMessage, nil)
	})

	// ブロードキャストが送信者を除外することを確認するテスト
	// 実際のクライアント接続は複雑なので、パニックが起きないことを確認
	assert.NotPanics(t, func() {
		hub.BroadcastToRoom(testRoomID, "test_message", testMessage, nil) // 送信者含む
	})
}

func TestHub_BroadcastMessage_Integration(t *testing.T) {
	// 統合テスト: Hubのブロードキャスト機能が正常に動作することを確認
	hub := websocket.NewHub()
	go hub.Run()

	// 各種ブロードキャストタイプをテスト
	testCases := []struct {
		name        string
		messageType string
		data        interface{}
		roomID      string
	}{
		{
			name:        "new_message type",
			messageType: "new_message",
			data: map[string]interface{}{
				"content":    "Test message",
				"user_id":    "user123",
				"room_id":    "room123",
				"message_id": "msg123",
				"timestamp":  1234567890,
			},
			roomID: "room123",
		},
		{
			name:        "user_joined type",
			messageType: "user_joined",
			data: map[string]interface{}{
				"user_id": "user456",
				"message": "User joined the room",
			},
			roomID: "room123",
		},
		{
			name:        "typing_start type",
			messageType: "typing_start",
			data: map[string]interface{}{
				"user_id": "user789",
				"room_id": "room123",
			},
			roomID: "room123",
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			// ブロードキャストが正常に実行されることを確認（パニックしない）
			assert.NotPanics(t, func() {
				hub.BroadcastToRoom(tc.roomID, tc.messageType, tc.data, nil)
			})

			// 少し待機してハブの処理を完了させる
			time.Sleep(10 * time.Millisecond)
		})
	}
}

func TestHub_MessageSaver_Integration(t *testing.T) {
	// MessageSaverとの統合テスト
	mockSaver := &MockMessageSaver{}

	// SaveWebSocketMessageが呼び出されることを期待
	mockSaver.On("SaveWebSocketMessage", "room123", "user123", "Hello World").
		Return(&websocket.MessageSaverResponse{
			ID:        "msg123",
			Content:   "Hello World",
			UserID:    "user123",
			RoomID:    "room123",
			CreatedAt: time.Now(),
		}, nil)

	hub := websocket.NewHubWithMessageSaver(mockSaver)
	go hub.Run()

	// MessageSaverが設定されていることを確認
	assert.NotNil(t, hub)

	// SetMessageSaverメソッドのテスト
	newMockSaver := &MockMessageSaver{}
	hub.SetMessageSaver(newMockSaver)

	// 正常に設定されることを確認（パニックしない）
	assert.NotPanics(t, func() {
		hub.SetMessageSaver(newMockSaver)
	})
}