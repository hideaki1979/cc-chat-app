package tests

import (
	"bytes"
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
	_ "github.com/mattn/go-sqlite3"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func setupMessageReactionTest(t *testing.T) (*ent.Client, *handlers.MessageHandler, func()) {
	client := enttest.Open(t, "sqlite3", "file:ent?mode=memory&cache=shared&_fk=1")

	// テスト用のWebSocketハブ
	hub := websocket.NewHub()

	handler := handlers.NewMessageHandler(client, hub)

	cleanup := func() {
		client.Close()
	}

	return client, handler, cleanup
}

func createTestDataForReaction(t *testing.T, client *ent.Client) (uuid.UUID, uuid.UUID, uuid.UUID, uuid.UUID) {
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

func TestAddReaction_Success(t *testing.T) {
	client, handler, cleanup := setupMessageReactionTest(t)
	defer cleanup()

	_, user2ID, _, messageID := createTestDataForReaction(t, client)

	// リクエストボディ作成
	requestBody := models.MessageReactionRequest{
		MessageID: messageID,
		Emoji:     "👍",
	}
	bodyBytes, _ := json.Marshal(requestBody)

	// Setup Echo
	e := echo.New()
	e.Validator = &CustomValidator{}
	req := httptest.NewRequest(http.MethodPost, fmt.Sprintf("/api/messages/%s/reactions", messageID), bytes.NewReader(bodyBytes))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)
	c.SetParamNames("id")
	c.SetParamValues(messageID.String())
	c.Set("user_id", user2ID.String())

	// Execute
	err := handler.AddReaction(c)

	// Assert
	require.NoError(t, err)
	assert.Equal(t, http.StatusCreated, rec.Code)

	var response models.MessageReactionResponse
	err = json.Unmarshal(rec.Body.Bytes(), &response)
	require.NoError(t, err)

	assert.Equal(t, messageID, response.MessageID)
	assert.Equal(t, user2ID, response.UserID)
	assert.Equal(t, "👍", response.Emoji)
	assert.WithinDuration(t, time.Now(), response.CreatedAt, 5*time.Second)
}

func TestAddReaction_DuplicateReaction(t *testing.T) {
	client, handler, cleanup := setupMessageReactionTest(t)
	defer cleanup()

	_, user2ID, _, messageID := createTestDataForReaction(t, client)

	// 事前にリアクションを作成
	ctx := context.Background()
	existingReaction, err := client.MessageReaction.Create().
		SetMessageID(messageID).
		SetUserID(user2ID).
		SetEmoji("👍").
		Save(ctx)
	require.NoError(t, err)

	// リクエストボディ作成
	requestBody := models.MessageReactionRequest{
		MessageID: messageID,
		Emoji:     "👍",
	}
	bodyBytes, _ := json.Marshal(requestBody)

	// Setup Echo
	e := echo.New()
	e.Validator = &CustomValidator{}
	req := httptest.NewRequest(http.MethodPost, fmt.Sprintf("/api/messages/%s/reactions", messageID), bytes.NewReader(bodyBytes))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)
	c.SetParamNames("id")
	c.SetParamValues(messageID.String())
	c.Set("user_id", user2ID.String())

	// Execute
	err = handler.AddReaction(c)

	// Assert
	require.NoError(t, err)
	assert.Equal(t, http.StatusOK, rec.Code)

	var response models.MessageReactionResponse
	err = json.Unmarshal(rec.Body.Bytes(), &response)
	require.NoError(t, err)

	// 既存のリアクションが返される
	assert.Equal(t, existingReaction.ID, response.ID)
	assert.Equal(t, messageID, response.MessageID)
	assert.Equal(t, user2ID, response.UserID)
	assert.Equal(t, "👍", response.Emoji)
}

func TestAddReaction_InvalidEmoji(t *testing.T) {
	client, handler, cleanup := setupMessageReactionTest(t)
	defer cleanup()

	_, user2ID, _, messageID := createTestDataForReaction(t, client)

	// 無効な絵文字でリクエスト
	requestBody := models.MessageReactionRequest{
		MessageID: messageID,
		Emoji:     "", // 空文字
	}
	bodyBytes, _ := json.Marshal(requestBody)

	// Setup Echo with validator
	e := echo.New()
	e.Validator = &CustomValidator{}
	req := httptest.NewRequest(http.MethodPost, fmt.Sprintf("/api/messages/%s/reactions", messageID), bytes.NewReader(bodyBytes))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)
	c.SetParamNames("id")
	c.SetParamValues(messageID.String())
	c.Set("user_id", user2ID.String())

	// Execute
	err := handler.AddReaction(c)

	// Assert
	require.Error(t, err)
	httpError, ok := err.(*echo.HTTPError)
	require.True(t, ok)
	assert.Equal(t, http.StatusBadRequest, httpError.Code)
}

func TestAddReaction_MessageIDMismatch(t *testing.T) {
	client, handler, cleanup := setupMessageReactionTest(t)
	defer cleanup()

	_, user2ID, _, messageID := createTestDataForReaction(t, client)

	// パスとは異なるmessage_idをボディに設定
	wrongID := uuid.New()
	requestBody := models.MessageReactionRequest{
		MessageID: wrongID,
		Emoji:     "👍",
	}
	bodyBytes, _ := json.Marshal(requestBody)

	// Setup Echo
	e := echo.New()
	e.Validator = &CustomValidator{}
	req := httptest.NewRequest(http.MethodPost, fmt.Sprintf("/api/messages/%s/reactions", messageID), bytes.NewReader(bodyBytes))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)
	c.SetParamNames("id")
	c.SetParamValues(messageID.String())
	c.Set("user_id", user2ID.String())

	// Execute
	err := handler.AddReaction(c)

	// Assert
	require.Error(t, err)
	httpError, ok := err.(*echo.HTTPError)
	require.True(t, ok)
	assert.Equal(t, http.StatusBadRequest, httpError.Code)
}

func TestRemoveReaction_Success(t *testing.T) {
	client, handler, cleanup := setupMessageReactionTest(t)
	defer cleanup()

	_, user2ID, _, messageID := createTestDataForReaction(t, client)

	// 事前にリアクションを作成
	ctx := context.Background()
	_, err := client.MessageReaction.Create().
		SetMessageID(messageID).
		SetUserID(user2ID).
		SetEmoji("👍").
		Save(ctx)
	require.NoError(t, err)

	// Setup Echo
	e := echo.New()
	req := httptest.NewRequest(http.MethodDelete, fmt.Sprintf("/api/messages/%s/reactions/%s", messageID, "👍"), nil)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)
	c.SetParamNames("id", "emoji")
	c.SetParamValues(messageID.String(), "👍")
	c.Set("user_id", user2ID.String())

	// Execute
	err = handler.RemoveReaction(c)

	// Assert
	require.NoError(t, err)
	assert.Equal(t, http.StatusOK, rec.Code)
}

func TestRemoveReaction_NotFound(t *testing.T) {
	client, handler, cleanup := setupMessageReactionTest(t)
	defer cleanup()

	_, user2ID, _, messageID := createTestDataForReaction(t, client)

	// Setup Echo (存在しないリアクションを削除)
	e := echo.New()
	req := httptest.NewRequest(http.MethodDelete, fmt.Sprintf("/api/messages/%s/reactions/%s", messageID, "👍"), nil)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)
	c.SetParamNames("id", "emoji")
	c.SetParamValues(messageID.String(), "👍")
	c.Set("user_id", user2ID.String())

	// Execute
	err := handler.RemoveReaction(c)

	// Assert
	require.Error(t, err)
	httpError, ok := err.(*echo.HTTPError)
	require.True(t, ok)
	assert.Equal(t, http.StatusNotFound, httpError.Code)
}

func TestGetMessageReactions_Success(t *testing.T) {
	client, handler, cleanup := setupMessageReactionTest(t)
	defer cleanup()

	user1ID, user2ID, _, messageID := createTestDataForReaction(t, client)

	// 複数のリアクションを作成
	ctx := context.Background()
	reaction1, err := client.MessageReaction.Create().
		SetMessageID(messageID).
		SetUserID(user1ID).
		SetEmoji("👍").
		Save(ctx)
	require.NoError(t, err)

	reaction2, err := client.MessageReaction.Create().
		SetMessageID(messageID).
		SetUserID(user2ID).
		SetEmoji("❤️").
		Save(ctx)
	require.NoError(t, err)

	// Setup Echo
	e := echo.New()
	req := httptest.NewRequest(http.MethodGet, fmt.Sprintf("/api/messages/%s/reactions", messageID), nil)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)
	c.SetParamNames("id")
	c.SetParamValues(messageID.String())
	c.Set("user_id", user1ID.String())

	// Execute
	err = handler.GetMessageReactions(c)

	// Assert
	require.NoError(t, err)
	assert.Equal(t, http.StatusOK, rec.Code)

	var response models.MessageReactionListResponse
	err = json.Unmarshal(rec.Body.Bytes(), &response)
	require.NoError(t, err)

	assert.Equal(t, messageID, response.MessageID)
	assert.Len(t, response.Reactions, 2)

	// 時系列順にソートされているかチェック
	assert.Equal(t, reaction1.ID, response.Reactions[0].ID)
	assert.Equal(t, reaction2.ID, response.Reactions[1].ID)
}

func TestGetMessageReactionsSummary_Success(t *testing.T) {
	client, handler, cleanup := setupMessageReactionTest(t)
	defer cleanup()

	user1ID, user2ID, _, messageID := createTestDataForReaction(t, client)

	// 複数のリアクションを作成（同じ絵文字も含む）
	ctx := context.Background()
	_, err := client.MessageReaction.Create().
		SetMessageID(messageID).
		SetUserID(user1ID).
		SetEmoji("👍").
		Save(ctx)
	require.NoError(t, err)

	_, err = client.MessageReaction.Create().
		SetMessageID(messageID).
		SetUserID(user2ID).
		SetEmoji("👍").
		Save(ctx)
	require.NoError(t, err)

	_, err = client.MessageReaction.Create().
		SetMessageID(messageID).
		SetUserID(user1ID).
		SetEmoji("❤️").
		Save(ctx)
	require.NoError(t, err)

	// Setup Echo
	e := echo.New()
	req := httptest.NewRequest(http.MethodGet, fmt.Sprintf("/api/messages/%s/reactions/summary", messageID), nil)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)
	c.SetParamNames("id")
	c.SetParamValues(messageID.String())
	c.Set("user_id", user1ID.String())

	// Execute
	err = handler.GetMessageReactionsSummary(c)

	// Assert
	require.NoError(t, err)
	assert.Equal(t, http.StatusOK, rec.Code)

	var response models.MessageReactionSummaryResponse
	err = json.Unmarshal(rec.Body.Bytes(), &response)
	require.NoError(t, err)

	assert.Equal(t, messageID, response.MessageID)
	assert.Len(t, response.Summary, 2)

	// 絵文字ごとの集計をチェック
	for _, summary := range response.Summary {
		if summary.Emoji == "👍" {
			assert.Equal(t, 2, summary.Count)
			assert.Len(t, summary.Users, 2)
		} else if summary.Emoji == "❤️" {
			assert.Equal(t, 1, summary.Count)
			assert.Len(t, summary.Users, 1)
		}
	}
}

func TestAddReaction_MessageNotFound(t *testing.T) {
	_, handler, cleanup := setupMessageReactionTest(t)
	defer cleanup()

	nonExistentMessageID := uuid.New()

	// リクエストボディ作成
	requestBody := models.MessageReactionRequest{
		MessageID: nonExistentMessageID,
		Emoji:     "👍",
	}
	bodyBytes, _ := json.Marshal(requestBody)

	// Setup Echo
	e := echo.New()
	req := httptest.NewRequest(http.MethodPost, fmt.Sprintf("/api/messages/%s/reactions", nonExistentMessageID), bytes.NewReader(bodyBytes))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)
	c.SetParamNames("id")
	c.SetParamValues(nonExistentMessageID.String())
	c.Set("user_id", uuid.New().String())

	// Execute
	err := handler.AddReaction(c)

	// Assert
	require.Error(t, err)
	httpError, ok := err.(*echo.HTTPError)
	require.True(t, ok)
	assert.Equal(t, http.StatusNotFound, httpError.Code)
}

func TestAddReaction_UserNotMember(t *testing.T) {
	client, handler, cleanup := setupMessageReactionTest(t)
	defer cleanup()

	_, _, _, messageID := createTestDataForReaction(t, client)

	// 非メンバーユーザー作成
	ctx := context.Background()
	nonMemberUser, err := client.User.Create().
		SetName("Non Member User").
		SetEmail("nonmember@example.com").
		SetPasswordHash([]byte("password")).
		Save(ctx)
	require.NoError(t, err)

	// リクエストボディ作成
	requestBody := models.MessageReactionRequest{
		MessageID: messageID,
		Emoji:     "👍",
	}
	bodyBytes, _ := json.Marshal(requestBody)

	// Setup Echo
	e := echo.New()
	req := httptest.NewRequest(http.MethodPost, fmt.Sprintf("/api/messages/%s/reactions", messageID), bytes.NewReader(bodyBytes))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)
	c.SetParamNames("id")
	c.SetParamValues(messageID.String())
	c.Set("user_id", nonMemberUser.ID.String())

	// Execute
	err = handler.AddReaction(c)

	// Assert
	require.Error(t, err)
	httpError, ok := err.(*echo.HTTPError)
	require.True(t, ok)
	assert.Equal(t, http.StatusForbidden, httpError.Code)
}

// CustomValidator バリデーター実装
type CustomValidator struct{}

func (cv *CustomValidator) Validate(i interface{}) error {
	switch v := i.(type) {
	case *models.MessageReactionRequest:
		if v.Emoji == "" {
			return fmt.Errorf("emoji is required")
		}
		if len(v.Emoji) > 10 {
			return fmt.Errorf("emoji too long")
		}
	case models.MessageReactionRequest:
		if v.Emoji == "" {
			return fmt.Errorf("emoji is required")
		}
		if len(v.Emoji) > 10 {
			return fmt.Errorf("emoji too long")
		}
	}
	return nil
}
