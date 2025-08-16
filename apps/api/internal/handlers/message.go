package handlers

import (
	"context"
	"net/http"
	"strconv"
	"time"

	"github.com/google/uuid"
	"github.com/hideaki1979/cc-chat-app/apps/api/ent"
	"github.com/hideaki1979/cc-chat-app/apps/api/ent/message"
	"github.com/hideaki1979/cc-chat-app/apps/api/ent/roommember"
	"github.com/hideaki1979/cc-chat-app/apps/api/internal/models"
	"github.com/labstack/echo/v4"
)

// MessageHandler メッセージ関連のハンドラー
type MessageHandler struct {
	client *ent.Client
}

// NewMessageHandler MessageHandlerのコンストラクタ
func NewMessageHandler(client *ent.Client) *MessageHandler {
	return &MessageHandler{client: client}
}

// SendMessage メッセージ送信
// POST /api/chatrooms/:room_id/messages
func (h *MessageHandler) SendMessage(c echo.Context) error {
	roomID := c.Param("room_id")
	roomUUID, err := uuid.Parse(roomID)
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "Invalid room ID")
	}

	var req models.SendMessageRequest
	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "Invalid request body")
	}

	if err := c.Validate(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, err.Error())
	}

	userID := c.Get("user_id").(string)
	userUUID, err := uuid.Parse(userID)
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "Invalid user ID")
	}

	ctx := context.Background()

	// ユーザーがそのルームのメンバーかチェック
	isMember, err := h.client.RoomMember.Query().
		Where(
			roommember.RoomID(roomUUID),
			roommember.UserID(userUUID),
		).
		Exist(ctx)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to check membership")
	}
	if !isMember {
		return echo.NewHTTPError(http.StatusForbidden, "You are not a member of this room")
	}

	// メッセージ作成
	messageBuilder := h.client.Message.Create().
		SetRoomID(roomUUID).
		SetUserID(userUUID).
		SetContent(req.Content)

	if req.FileURL != "" {
		messageBuilder = messageBuilder.SetFileURL(req.FileURL)
	}

	msg, err := messageBuilder.Save(ctx)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to send message")
	}

	// 送信者情報を含めてメッセージを再取得
	messageWithSender, err := h.client.Message.Query().
		Where(message.ID(msg.ID)).
		WithSender().
		Only(ctx)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to get sent message")
	}

	response := models.ConvertToMessageResponse(messageWithSender)
	return c.JSON(http.StatusCreated, response)
}

// GetMessages チャットルームのメッセージ一覧取得
// GET /api/chatrooms/:room_id/messages
func (h *MessageHandler) GetMessages(c echo.Context) error {
	roomID := c.Param("room_id")
	roomUUID, err := uuid.Parse(roomID)
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "Invalid room ID")
	}

	userID := c.Get("user_id").(string)
	userUUID, err := uuid.Parse(userID)
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "Invalid user ID")
	}

	// クエリパラメータ
	page, _ := strconv.Atoi(c.QueryParam("page"))
	if page <= 0 {
		page = 1
	}
	pageSize, _ := strconv.Atoi(c.QueryParam("page_size"))
	if pageSize <= 0 || pageSize > 100 {
		pageSize = 50
	}

	beforeStr := c.QueryParam("before")
	var beforeTime *time.Time
	if beforeStr != "" {
		if parsedTime, err := time.Parse(time.RFC3339, beforeStr); err == nil {
			beforeTime = &parsedTime
		}
	}

	ctx := context.Background()

	// ユーザーがそのルームのメンバーかチェック
	isMember, err := h.client.RoomMember.Query().
		Where(
			roommember.RoomID(roomUUID),
			roommember.UserID(userUUID),
		).
		Exist(ctx)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to check membership")
	}
	if !isMember {
		return echo.NewHTTPError(http.StatusForbidden, "You are not a member of this room")
	}

	// メッセージクエリ作成
	query := h.client.Message.Query().
		Where(
			message.RoomID(roomUUID),
			message.DeletedAtIsNil(), // 論理削除されていないメッセージのみ
		).
		WithSender()

	// before パラメータがある場合、その時刻より前のメッセージを取得
	if beforeTime != nil {
		query = query.Where(message.CreatedAtLT(*beforeTime))
	}

	// メッセージを取得（新しい順）
	messages, err := query.
		Order(ent.Desc(message.FieldCreatedAt)).
		Offset((page - 1) * pageSize).
		Limit(pageSize).
		All(ctx)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to get messages")
	}

	// レスポンス作成
	responses := make([]*models.MessageResponse, len(messages))
	for i, msg := range messages {
		responses[i] = models.ConvertToMessageResponse(msg)
	}

	return c.JSON(http.StatusOK, map[string]interface{}{
		"messages": responses,
		"pagination": map[string]interface{}{
			"page":      page,
			"page_size": pageSize,
			"total":     len(responses),
		},
	})
}

// GetMessage メッセージ詳細取得
// GET /api/messages/:id
func (h *MessageHandler) GetMessage(c echo.Context) error {
	messageID := c.Param("id")
	messageUUID, err := uuid.Parse(messageID)
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "Invalid message ID")
	}

	userID := c.Get("user_id").(string)
	userUUID, err := uuid.Parse(userID)
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "Invalid user ID")
	}

	ctx := context.Background()

	// メッセージ取得
	msg, err := h.client.Message.Query().
		Where(
			message.ID(messageUUID),
			message.DeletedAtIsNil(),
		).
		WithSender().
		WithRoom().
		Only(ctx)
	if err != nil {
		if ent.IsNotFound(err) {
			return echo.NewHTTPError(http.StatusNotFound, "Message not found")
		}
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to get message")
	}

	// ユーザーがそのルームのメンバーかチェック
	isMember, err := h.client.RoomMember.Query().
		Where(
			roommember.RoomID(msg.RoomID),
			roommember.UserID(userUUID),
		).
		Exist(ctx)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to check membership")
	}
	if !isMember {
		return echo.NewHTTPError(http.StatusForbidden, "You are not a member of this room")
	}

	response := models.ConvertToMessageResponse(msg)
	return c.JSON(http.StatusOK, response)
}

// UpdateMessage メッセージ更新
// PUT /api/messages/:id
func (h *MessageHandler) UpdateMessage(c echo.Context) error {
	messageID := c.Param("id")
	messageUUID, err := uuid.Parse(messageID)
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "Invalid message ID")
	}

	var req models.UpdateMessageRequest
	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "Invalid request body")
	}

	if err := c.Validate(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, err.Error())
	}

	userID := c.Get("user_id").(string)
	userUUID, err := uuid.Parse(userID)
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "Invalid user ID")
	}

	ctx := context.Background()

	// メッセージ取得と送信者チェック
	msg, err := h.client.Message.Query().
		Where(
			message.ID(messageUUID),
			message.DeletedAtIsNil(),
		).
		Only(ctx)
	if err != nil {
		if ent.IsNotFound(err) {
			return echo.NewHTTPError(http.StatusNotFound, "Message not found")
		}
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to get message")
	}

	// 送信者本人かチェック
	if msg.UserID != userUUID {
		return echo.NewHTTPError(http.StatusForbidden, "You can only update your own messages")
	}

	// メッセージ更新（作成から5分以内のみ編集可能）
	if time.Since(msg.CreatedAt) > 5*time.Minute {
		return echo.NewHTTPError(http.StatusBadRequest, "Message can only be edited within 5 minutes")
	}

	updatedMsg, err := h.client.Message.UpdateOneID(messageUUID).
		SetContent(req.Content).
		Save(ctx)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to update message")
	}

	// 更新後のメッセージを送信者情報込みで取得
	updatedMsgWithSender, err := h.client.Message.Query().
		Where(message.ID(updatedMsg.ID)).
		WithSender().
		Only(ctx)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to get updated message")
	}

	response := models.ConvertToMessageResponse(updatedMsgWithSender)
	return c.JSON(http.StatusOK, response)
}

// DeleteMessage メッセージ削除（論理削除）
// DELETE /api/messages/:id
func (h *MessageHandler) DeleteMessage(c echo.Context) error {
	messageID := c.Param("id")
	messageUUID, err := uuid.Parse(messageID)
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "Invalid message ID")
	}

	userID := c.Get("user_id").(string)
	userUUID, err := uuid.Parse(userID)
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "Invalid user ID")
	}

	ctx := context.Background()

	// メッセージ取得と送信者チェック
	msg, err := h.client.Message.Query().
		Where(
			message.ID(messageUUID),
			message.DeletedAtIsNil(),
		).
		Only(ctx)
	if err != nil {
		if ent.IsNotFound(err) {
			return echo.NewHTTPError(http.StatusNotFound, "Message not found")
		}
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to get message")
	}

	// 送信者本人かチェック
	if msg.UserID != userUUID {
		return echo.NewHTTPError(http.StatusForbidden, "You can only delete your own messages")
	}

	// 論理削除
	now := time.Now()
	_, err = h.client.Message.UpdateOneID(messageUUID).
		SetDeletedAt(now).
		Save(ctx)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to delete message")
	}

	return c.JSON(http.StatusOK, map[string]string{
		"message": "Message deleted successfully",
	})
}