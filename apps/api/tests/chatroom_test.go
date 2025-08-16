package tests

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/hideaki1979/cc-chat-app/apps/api/ent/enttest"
	"github.com/hideaki1979/cc-chat-app/apps/api/internal/auth"
	"github.com/hideaki1979/cc-chat-app/apps/api/internal/handlers"
	"github.com/hideaki1979/cc-chat-app/apps/api/internal/middleware"
	"github.com/hideaki1979/cc-chat-app/apps/api/internal/models"
	"github.com/labstack/echo/v4"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	_ "github.com/lib/pq"
)

func TestChatRoomHandlers(t *testing.T) {
	// テスト用のPostgreSQLテストDBを使用
	testDBURL := "postgres://ccuser:ccpassword@localhost:5433/ccdb_test?sslmode=disable"
	client := enttest.Open(t, "postgres", testDBURL)
	defer client.Close()

	// テスト前にデータをクリーンアップ
	ctx := context.Background()
	client.RoomMember.Delete().ExecX(ctx)
	client.Message.Delete().ExecX(ctx)
	client.ChatRoom.Delete().ExecX(ctx)
	client.User.Delete().ExecX(ctx)

	// Echoインスタンス作成
	e := echo.New()
	e.Validator = middleware.NewValidator()

	// テスト用ユーザー作成
	hashedPassword, _ := auth.HashPassword("testpassword123")
	user1, err := client.User.Create().
		SetName("Test User 1").
		SetEmail("test1@example.com").
		SetPasswordHash(hashedPassword).
		Save(ctx)
	require.NoError(t, err)

	user2, err := client.User.Create().
		SetName("Test User 2").
		SetEmail("test2@example.com").
		SetPasswordHash(hashedPassword).
		Save(ctx)
	require.NoError(t, err)

	// ハンドラー初期化
	chatRoomHandler := handlers.NewChatRoomHandler(client)

	t.Run("CreateChatRoom", func(t *testing.T) {
		req := models.CreateChatRoomRequest{
			Name:        "Test Room",
			IsGroupChat: true,
			MemberIDs:   []string{user2.ID.String()},
		}

		reqBody, _ := json.Marshal(req)
		request := httptest.NewRequest(http.MethodPost, "/api/chatrooms", bytes.NewReader(reqBody))
		request.Header.Set("Content-Type", "application/json")
		recorder := httptest.NewRecorder()

		c := e.NewContext(request, recorder)
		c.Set("user_id", user1.ID.String())
		c.Set("db", client)

		err := chatRoomHandler.CreateChatRoom(c)
		assert.NoError(t, err)
		assert.Equal(t, http.StatusCreated, recorder.Code)

		var response models.ChatRoomResponse
		err = json.Unmarshal(recorder.Body.Bytes(), &response)
		assert.NoError(t, err)
		assert.Equal(t, "Test Room", response.Name)
		assert.True(t, response.IsGroupChat)
		assert.Len(t, response.Members, 2) // user1とuser2
	})

	t.Run("GetChatRooms", func(t *testing.T) {
		request := httptest.NewRequest(http.MethodGet, "/api/chatrooms", nil)
		recorder := httptest.NewRecorder()

		c := e.NewContext(request, recorder)
		c.Set("user_id", user1.ID.String())
		c.Set("db", client)

		err := chatRoomHandler.GetChatRooms(c)
		assert.NoError(t, err)
		assert.Equal(t, http.StatusOK, recorder.Code)

		var response map[string]interface{}
		err = json.Unmarshal(recorder.Body.Bytes(), &response)
		assert.NoError(t, err)
		assert.Contains(t, response, "rooms")
		assert.Contains(t, response, "pagination")
	})
}

func TestMessageHandlers(t *testing.T) {
	// テスト用のPostgreSQLテストDBを使用
	testDBURL := "postgres://ccuser:ccpassword@localhost:5433/ccdb_test?sslmode=disable"
	client := enttest.Open(t, "postgres", testDBURL)
	defer client.Close()

	// テスト前にデータをクリーンアップ
	ctx := context.Background()
	client.RoomMember.Delete().ExecX(ctx)
	client.Message.Delete().ExecX(ctx)
	client.ChatRoom.Delete().ExecX(ctx)
	client.User.Delete().ExecX(ctx)

	// Echoインスタンス作成
	e := echo.New()
	e.Validator = middleware.NewValidator()

	// テスト用ユーザー作成
	hashedPassword, _ := auth.HashPassword("testpassword123")
	user1, err := client.User.Create().
		SetName("Message Test User 1").
		SetEmail("message_test1@example.com").
		SetPasswordHash(hashedPassword).
		Save(ctx)
	require.NoError(t, err)

	// テスト用チャットルーム作成
	chatRoom, err := client.ChatRoom.Create().
		SetName("Test Room").
		SetIsGroupChat(false).
		Save(ctx)
	require.NoError(t, err)

	// ルームメンバー追加
	_, err = client.RoomMember.Create().
		SetRoomID(chatRoom.ID).
		SetUserID(user1.ID).
		Save(ctx)
	require.NoError(t, err)

	// ハンドラー初期化
	messageHandler := handlers.NewMessageHandler(client)

	t.Run("SendMessage", func(t *testing.T) {
		req := models.SendMessageRequest{
			Content: "Hello, World!",
		}

		reqBody, _ := json.Marshal(req)
		request := httptest.NewRequest(http.MethodPost, "/api/chatrooms/"+chatRoom.ID.String()+"/messages", bytes.NewReader(reqBody))
		request.Header.Set("Content-Type", "application/json")
		recorder := httptest.NewRecorder()

		c := e.NewContext(request, recorder)
		c.SetParamNames("room_id")
		c.SetParamValues(chatRoom.ID.String())
		c.Set("user_id", user1.ID.String())
		c.Set("db", client)

		err := messageHandler.SendMessage(c)
		assert.NoError(t, err)
		assert.Equal(t, http.StatusCreated, recorder.Code)

		var response models.MessageResponse
		err = json.Unmarshal(recorder.Body.Bytes(), &response)
		assert.NoError(t, err)
		assert.Equal(t, "Hello, World!", response.Content)
		assert.Equal(t, user1.ID.String(), response.UserID)
		assert.Equal(t, chatRoom.ID.String(), response.RoomID)
	})

	t.Run("GetMessages", func(t *testing.T) {
		request := httptest.NewRequest(http.MethodGet, "/api/chatrooms/"+chatRoom.ID.String()+"/messages", nil)
		recorder := httptest.NewRecorder()

		c := e.NewContext(request, recorder)
		c.SetParamNames("room_id")
		c.SetParamValues(chatRoom.ID.String())
		c.Set("user_id", user1.ID.String())
		c.Set("db", client)

		err := messageHandler.GetMessages(c)
		assert.NoError(t, err)
		assert.Equal(t, http.StatusOK, recorder.Code)

		var response map[string]interface{}
		err = json.Unmarshal(recorder.Body.Bytes(), &response)
		assert.NoError(t, err)
		assert.Contains(t, response, "messages")
		assert.Contains(t, response, "pagination")
	})
}