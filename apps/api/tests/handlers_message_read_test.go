package tests

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/hideaki1979/cc-chat-app/apps/api/ent"
	"github.com/hideaki1979/cc-chat-app/apps/api/ent/enttest"
	"github.com/hideaki1979/cc-chat-app/apps/api/internal/handlers"
	"github.com/hideaki1979/cc-chat-app/apps/api/internal/models"
	"github.com/hideaki1979/cc-chat-app/apps/api/internal/websocket"
	"github.com/labstack/echo/v4"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	_ "github.com/mattn/go-sqlite3"
)

func setupMessageReadTest(t *testing.T) (*ent.Client, *handlers.MessageHandler, func()) {
	client := enttest.Open(t, "sqlite3", "file:ent?mode=memory&cache=shared&_fk=1")

	// テスト用のWebSocketハブ
	hub := websocket.NewHub()

	handler := handlers.NewMessageHandler(client, hub)

	cleanup := func() {
		client.Close()
	}

	return client, handler, cleanup
}

func createTestData(t *testing.T, client *ent.Client) (uuid.UUID, uuid.UUID, uuid.UUID, uuid.UUID) {
	ctx := context.Background()

	// テストユーザー作成
	user1, err := client.User.Create().
		SetName("Test User 1").
		SetEmail("test1@example.com").
		SetPasswordHash([]byte("password")).
		Save(ctx)
	require.NoError(t, err)

	user2, err := client.User.Create().
		SetName("Test User 2").
		SetEmail("test2@example.com").
		SetPasswordHash([]byte("password")).
		Save(ctx)
	require.NoError(t, err)

	// テストチャットルーム作成
	room, err := client.ChatRoom.Create().
		SetName("Test Room").
		SetIsGroupChat(true).
		Save(ctx)
	require.NoError(t, err)

	// ルームメンバー追加
	_, err = client.RoomMember.Create().
		SetRoomID(room.ID).
		SetUserID(user1.ID).
		Save(ctx)
	require.NoError(t, err)

	_, err = client.RoomMember.Create().
		SetRoomID(room.ID).
		SetUserID(user2.ID).
		Save(ctx)
	require.NoError(t, err)

	// テストメッセージ作成
	message, err := client.Message.Create().
		SetRoomID(room.ID).
		SetUserID(user1.ID).
		SetContent("Test message").
		Save(ctx)
	require.NoError(t, err)

	return user1.ID, user2.ID, room.ID, message.ID
}

func TestMarkAsRead_Success(t *testing.T) {
	client, handler, cleanup := setupMessageReadTest(t)
	defer cleanup()

	_, user2ID, _, messageID := createTestData(t, client)

	// Setup Echo
	e := echo.New()
	req := httptest.NewRequest(http.MethodPost, fmt.Sprintf("/api/messages/%s/read", messageID), nil)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)
	c.SetParamNames("id")
	c.SetParamValues(messageID.String())
	c.Set("user_id", user2ID.String())

	// Execute
	err := handler.MarkAsRead(c)

	// Assert
	require.NoError(t, err)
	assert.Equal(t, http.StatusOK, rec.Code)

	var response models.MessageReadResponse
	err = json.Unmarshal(rec.Body.Bytes(), &response)
	require.NoError(t, err)

	assert.Equal(t, messageID, response.MessageID)
	assert.Equal(t, user2ID, response.UserID)
	assert.WithinDuration(t, time.Now(), response.ReadAt, 5*time.Second)
}

func TestMarkAsRead_AlreadyRead(t *testing.T) {
	client, handler, cleanup := setupMessageReadTest(t)
	defer cleanup()

	_, user2ID, _, messageID := createTestData(t, client)

	// 既読を事前に作成
	ctx := context.Background()
	existingRead, err := client.MessageRead.Create().
		SetMessageID(messageID).
		SetUserID(user2ID).
		SetReadAt(time.Now().Add(-1 * time.Hour)).
		Save(ctx)
	require.NoError(t, err)

	// Setup Echo
	e := echo.New()
	req := httptest.NewRequest(http.MethodPost, fmt.Sprintf("/api/messages/%s/read", messageID), nil)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)
	c.SetParamNames("id")
	c.SetParamValues(messageID.String())
	c.Set("user_id", user2ID.String())

	// Execute
	err = handler.MarkAsRead(c)

	// Assert
	require.NoError(t, err)
	assert.Equal(t, http.StatusOK, rec.Code)

	var response models.MessageReadResponse
	err = json.Unmarshal(rec.Body.Bytes(), &response)
	require.NoError(t, err)

	assert.Equal(t, existingRead.ID, response.ID)
	assert.Equal(t, messageID, response.MessageID)
	assert.Equal(t, user2ID, response.UserID)
}

func TestMarkAsRead_MessageNotFound(t *testing.T) {
	_, handler, cleanup := setupMessageReadTest(t)
	defer cleanup()

	nonExistentMessageID := uuid.New()

	// Setup Echo
	e := echo.New()
	req := httptest.NewRequest(http.MethodPost, fmt.Sprintf("/api/messages/%s/read", nonExistentMessageID), nil)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)
	c.SetParamNames("id")
	c.SetParamValues(nonExistentMessageID.String())
	c.Set("user_id", uuid.New().String())

	// Execute
	err := handler.MarkAsRead(c)

	// Assert
	require.Error(t, err)
	httpError, ok := err.(*echo.HTTPError)
	require.True(t, ok)
	assert.Equal(t, http.StatusNotFound, httpError.Code)
}

func TestMarkAsRead_UserNotMember(t *testing.T) {
	client, handler, cleanup := setupMessageReadTest(t)
	defer cleanup()

	_, _, _, messageID := createTestData(t, client)

	// 非メンバーユーザー作成
	ctx := context.Background()
	nonMemberUser, err := client.User.Create().
		SetName("Non Member User").
		SetEmail("nonmember@example.com").
		SetPasswordHash([]byte("password")).
		Save(ctx)
	require.NoError(t, err)

	// Setup Echo
	e := echo.New()
	req := httptest.NewRequest(http.MethodPost, fmt.Sprintf("/api/messages/%s/read", messageID), nil)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)
	c.SetParamNames("id")
	c.SetParamValues(messageID.String())
	c.Set("user_id", nonMemberUser.ID.String())

	// Execute
	err = handler.MarkAsRead(c)

	// Assert
	require.Error(t, err)
	httpError, ok := err.(*echo.HTTPError)
	require.True(t, ok)
	assert.Equal(t, http.StatusForbidden, httpError.Code)
}

func TestGetMessageReads_Success(t *testing.T) {
	client, handler, cleanup := setupMessageReadTest(t)
	defer cleanup()

	user1ID, user2ID, _, messageID := createTestData(t, client)

	// 複数の既読を作成
	ctx := context.Background()
	read1, err := client.MessageRead.Create().
		SetMessageID(messageID).
		SetUserID(user1ID).
		SetReadAt(time.Now().Add(-2 * time.Hour)).
		Save(ctx)
	require.NoError(t, err)

	read2, err := client.MessageRead.Create().
		SetMessageID(messageID).
		SetUserID(user2ID).
		SetReadAt(time.Now().Add(-1 * time.Hour)).
		Save(ctx)
	require.NoError(t, err)

	// Setup Echo
	e := echo.New()
	req := httptest.NewRequest(http.MethodGet, fmt.Sprintf("/api/messages/%s/reads", messageID), nil)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)
	c.SetParamNames("id")
	c.SetParamValues(messageID.String())
	c.Set("user_id", user1ID.String())

	// Execute
	err = handler.GetMessageReads(c)

	// Assert
	require.NoError(t, err)
	assert.Equal(t, http.StatusOK, rec.Code)

	var response models.MessageReadListResponse
	err = json.Unmarshal(rec.Body.Bytes(), &response)
	require.NoError(t, err)

	assert.Equal(t, messageID, response.MessageID)
	assert.Len(t, response.Reads, 2)

	// 時系列順にソートされているかチェック
	assert.Equal(t, read1.ID, response.Reads[0].ID)
	assert.Equal(t, read2.ID, response.Reads[1].ID)
}

func TestGetMessageReads_EmptyResult(t *testing.T) {
	client, handler, cleanup := setupMessageReadTest(t)
	defer cleanup()

	user1ID, _, _, messageID := createTestData(t, client)

	// Setup Echo
	e := echo.New()
	req := httptest.NewRequest(http.MethodGet, fmt.Sprintf("/api/messages/%s/reads", messageID), nil)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)
	c.SetParamNames("id")
	c.SetParamValues(messageID.String())
	c.Set("user_id", user1ID.String())

	// Execute
	err := handler.GetMessageReads(c)

	// Assert
	require.NoError(t, err)
	assert.Equal(t, http.StatusOK, rec.Code)

	var response models.MessageReadListResponse
	err = json.Unmarshal(rec.Body.Bytes(), &response)
	require.NoError(t, err)

	assert.Equal(t, messageID, response.MessageID)
	assert.Len(t, response.Reads, 0)
}

func TestMarkAsRead_InvalidUUID(t *testing.T) {
	_, handler, cleanup := setupMessageReadTest(t)
	defer cleanup()

	// Setup Echo
	e := echo.New()
	req := httptest.NewRequest(http.MethodPost, "/api/messages/invalid-uuid/read", nil)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)
	c.SetParamNames("id")
	c.SetParamValues("invalid-uuid")
	c.Set("user_id", uuid.New().String())

	// Execute
	err := handler.MarkAsRead(c)

	// Assert
	require.Error(t, err)
	httpError, ok := err.(*echo.HTTPError)
	require.True(t, ok)
	assert.Equal(t, http.StatusBadRequest, httpError.Code)
}