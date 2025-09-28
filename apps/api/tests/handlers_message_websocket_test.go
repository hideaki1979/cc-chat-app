package tests

import (
	"context"
	"database/sql"
	"testing"
	"time"

	"entgo.io/ent/dialect"
	entsql "entgo.io/ent/dialect/sql"
	"github.com/google/uuid"
	"github.com/hideaki1979/cc-chat-app/apps/api/ent"
	"github.com/hideaki1979/cc-chat-app/apps/api/ent/message"
	"github.com/hideaki1979/cc-chat-app/apps/api/internal/handlers"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	_ "github.com/hideaki1979/cc-chat-app/apps/api/ent/runtime"
	_ "github.com/lib/pq"
	_ "github.com/mattn/go-sqlite3"
)

// createTestClient テスト用のEntクライアントを作成（インメモリSQLiteを使用）
func createTestClient(t *testing.T) *ent.Client {
	// インメモリSQLiteデータベースを使用（外部キー制約を有効化）
	db, err := sql.Open("sqlite3", ":memory:?_fk=1")
	require.NoError(t, err)

	drv := entsql.OpenDB(dialect.SQLite, db)
	client := ent.NewClient(ent.Driver(drv))

	// スキーマ作成
	err = client.Schema.Create(context.Background())
	require.NoError(t, err)

	return client
}

func TestMessageHandler_SaveWebSocketMessage(t *testing.T) {
	// テスト用のクライアントを作成
	client := createTestClient(t)
	defer client.Close()

	// テストデータの準備
	ctx := context.Background()

	// ユーザー作成
	testUser, err := client.User.Create().
		SetEmail("test@example.com").
		SetName("Test User").
		SetPasswordHash([]byte("password_hash")).
		Save(ctx)
	require.NoError(t, err)

	// チャットルーム作成
	testRoom, err := client.ChatRoom.Create().
		SetName("Test Room").
		SetIsGroupChat(true).
		Save(ctx)
	require.NoError(t, err)

	// ルームメンバー追加
	_, err = client.RoomMember.Create().
		SetRoomID(testRoom.ID).
		SetUserID(testUser.ID).
		SetRoom(testRoom).
		Save(ctx)
	require.NoError(t, err)

	// MessageHandlerを作成
	messageHandler := handlers.NewMessageHandler(client, nil)

	tests := []struct {
		name     string
		roomID   string
		userID   string
		content  string
		wantErr  bool
	}{
		{
			name:    "正常なメッセージ保存",
			roomID:  testRoom.ID.String(),
			userID:  testUser.ID.String(),
			content: "Hello, World!",
			wantErr: false,
		},
		{
			name:    "存在しないルーム",
			roomID:  uuid.New().String(),
			userID:  testUser.ID.String(),
			content: "Hello, World!",
			wantErr: true,
		},
		{
			name:    "存在しないユーザー",
			roomID:  testRoom.ID.String(),
			userID:  uuid.New().String(),
			content: "Hello, World!",
			wantErr: true,
		},
		{
			name:    "無効なルームID",
			roomID:  "invalid-uuid",
			userID:  testUser.ID.String(),
			content: "Hello, World!",
			wantErr: true,
		},
		{
			name:    "無効なユーザーID",
			roomID:  testRoom.ID.String(),
			userID:  "invalid-uuid",
			content: "Hello, World!",
			wantErr: true,
		},
		{
			name:    "空のコンテンツ",
			roomID:  testRoom.ID.String(),
			userID:  testUser.ID.String(),
			content: "",
			wantErr: false, // 空のコンテンツも許可される
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			response, err := messageHandler.SaveWebSocketMessage(tt.roomID, tt.userID, tt.content)

			if tt.wantErr {
				assert.Error(t, err)
				assert.Nil(t, response)
			} else {
				assert.NoError(t, err)
				assert.NotNil(t, response)
				assert.Equal(t, tt.content, response.Content)
				assert.Equal(t, tt.userID, response.UserID)
				assert.Equal(t, tt.roomID, response.RoomID)
				assert.NotEmpty(t, response.ID)
				assert.WithinDuration(t, time.Now(), response.CreatedAt, time.Second*5)
			}
		})
	}
}

func TestMessageHandler_SaveWebSocketMessage_DatabaseConsistency(t *testing.T) {
	// データベースの整合性をテスト
	client := createTestClient(t)
	defer client.Close()

	ctx := context.Background()

	// テストデータ準備
	testUser, err := client.User.Create().
		SetEmail("consistency@example.com").
		SetName("Consistency User").
		SetPasswordHash([]byte("password_hash")).
		Save(ctx)
	require.NoError(t, err)

	testRoom, err := client.ChatRoom.Create().
		SetName("Consistency Room").
		SetIsGroupChat(true).
		Save(ctx)
	require.NoError(t, err)

	_, err = client.RoomMember.Create().
		SetRoomID(testRoom.ID).
		SetUserID(testUser.ID).
		SetRoom(testRoom).
		Save(ctx)
	require.NoError(t, err)

	messageHandler := handlers.NewMessageHandler(client, nil)

	// メッセージを保存
	content := "Database consistency test message"
	response, err := messageHandler.SaveWebSocketMessage(
		testRoom.ID.String(),
		testUser.ID.String(),
		content,
	)
	require.NoError(t, err)
	require.NotNil(t, response)

	// データベースから直接確認
	messageUUID, err := uuid.Parse(response.ID)
	require.NoError(t, err)

	savedMessage, err := client.Message.Query().
		Where(message.ID(messageUUID)).
		WithSender().
		Only(ctx)
	require.NoError(t, err)

	// レスポンスとデータベースの内容が一致することを確認
	assert.Equal(t, content, savedMessage.Content)
	assert.Equal(t, testUser.ID, savedMessage.UserID)
	assert.Equal(t, testRoom.ID, savedMessage.RoomID)
	assert.Equal(t, testUser.ID, savedMessage.Edges.Sender.ID)
}