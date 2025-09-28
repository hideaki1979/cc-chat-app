package handlers

import (
	"context"
	"net/http"
	"strconv"
	"time"

	"github.com/google/uuid"
	"github.com/hideaki1979/cc-chat-app/apps/api/ent"
	"github.com/hideaki1979/cc-chat-app/apps/api/ent/message"
	"github.com/hideaki1979/cc-chat-app/apps/api/ent/messagereaction"
	"github.com/hideaki1979/cc-chat-app/apps/api/ent/messageread"
	"github.com/hideaki1979/cc-chat-app/apps/api/ent/roommember"
	"github.com/hideaki1979/cc-chat-app/apps/api/internal/constants"
	"github.com/hideaki1979/cc-chat-app/apps/api/internal/models"
	"github.com/hideaki1979/cc-chat-app/apps/api/internal/websocket"
	"github.com/labstack/echo/v4"
)

// MessageHandler メッセージ関連のハンドラー
type MessageHandler struct {
	client *ent.Client
	hub    *websocket.Hub
}

// NewMessageHandler MessageHandlerのコンストラクタ
func NewMessageHandler(client *ent.Client, hub *websocket.Hub) *MessageHandler {
	return &MessageHandler{
		client: client,
		hub:    hub,
	}
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

	// EchoのValidatorが未登録の場合はスキップ（テストでは未登録ケースあり）
	if c.Echo() != nil && c.Echo().Validator != nil {
		if c.Echo() != nil && c.Echo().Validator != nil {
			if c.Echo() != nil && c.Echo().Validator != nil {
				if c.Echo() != nil && c.Echo().Validator != nil {
					if err := c.Validate(&req); err != nil {
						return echo.NewHTTPError(http.StatusBadRequest, err.Error())
					}
				}
			}
		}
	}

	userUUID, err := getUserUUID(c)
	if err != nil {
		return err
	}

	ctx := c.Request().Context()

	// ユーザーがそのルームのメンバーかチェック
	member, err := h.client.RoomMember.Query().
		Where(
			roommember.RoomID(roomUUID),
			roommember.UserID(userUUID),
		).
		WithRoom(). // CharRoomを読み込む
		First(ctx)  // Existの代わりにFirstを使用

	if err != nil {
		if ent.IsNotFound(err) {
			return echo.NewHTTPError(http.StatusForbidden, "You are not a member of this room")
		}
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to check membership")
	}

	// メッセージ作成
	messageBuilder := h.client.Message.Create().
		SetRoomID(roomUUID).
		SetUserID(userUUID).
		SetRoom(member.Edges.Room). // 取得したChatRoomを設定
		SetSenderID(userUUID).      // Senderエッジを設定
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

	// WebSocketでリアルタイムブロードキャスト
	if h.hub != nil {
		broadcastData := map[string]any{
			"content":    messageWithSender.Content,
			"room_id":    roomID,
			"user_id":    messageWithSender.Edges.Sender.ID.String(),
			"message_id": messageWithSender.ID.String(),
			"timestamp":  messageWithSender.CreatedAt.Unix(),
			"file_url":   messageWithSender.FileURL,
		}
		h.hub.BroadcastToRoom(roomID, "new_message", broadcastData, nil)
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

	userUUID, err := getUserUUID(c)
	if err != nil {
		return err
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

	ctx := c.Request().Context()

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

	return c.JSON(http.StatusOK, map[string]any{
		"messages": responses,
		"pagination": map[string]any{
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

	userUUID, err := getUserUUID(c)
	if err != nil {
		return err
	}

	ctx := c.Request().Context()

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

	userUUID, err := getUserUUID(c)
	if err != nil {
		return err
	}

	ctx := c.Request().Context()

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
	if time.Since(msg.CreatedAt) > constants.MessageEditTimeLimit {
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

	userUUID, err := getUserUUID(c)
	if err != nil {
		return err
	}

	ctx := c.Request().Context()

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

// MarkAsRead メッセージ既読マーク
// POST /api/messages/:id/read
func (h *MessageHandler) MarkAsRead(c echo.Context) error {
	messageID := c.Param("id")
	messageUUID, err := uuid.Parse(messageID)
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "Invalid message ID")
	}

	userUUID, err := getUserUUID(c)
	if err != nil {
		return err
	}

	ctx := c.Request().Context()

	// メッセージ存在チェック
	msg, err := h.client.Message.Query().
		Where(
			message.ID(messageUUID),
			message.DeletedAtIsNil(),
		).
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

	// 既に既読済みかチェック
	existingRead, err := h.client.MessageRead.Query().
		Where(
			messageread.MessageID(messageUUID),
			messageread.UserID(userUUID),
		).
		Only(ctx)

	var readResponse *models.MessageReadResponse

	if ent.IsNotFound(err) {
		// 新規既読作成
		newRead, err := h.client.MessageRead.Create().
			SetMessageID(messageUUID).
			SetUserID(userUUID).
			SetReadAt(time.Now()).
			Save(ctx)
		if err != nil {
			if ent.IsConstraintError(err) {
				// 競合: 既に作成済み → 既存を返す
				existingRead, err2 := h.client.MessageRead.Query().
					Where(messageread.MessageID(messageUUID), messageread.UserID(userUUID)).
					Only(ctx)
				if err2 == nil {
					readResponse = &models.MessageReadResponse{
						ID: existingRead.ID, MessageID: existingRead.MessageID, UserID: existingRead.UserID, ReadAt: existingRead.ReadAt,
					}
				} else {
					return echo.NewHTTPError(http.StatusInternalServerError, "Failed to mark message as read")
				}
			} else {
				return echo.NewHTTPError(http.StatusInternalServerError, "Failed to mark message as read")
			}
		} else {
			readResponse = &models.MessageReadResponse{
				ID: newRead.ID, MessageID: newRead.MessageID, UserID: newRead.UserID, ReadAt: newRead.ReadAt,
			}
		}
	} else if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to check read status")
	} else {
		// 既存の既読情報を返す
		readResponse = &models.MessageReadResponse{
			ID:        existingRead.ID,
			MessageID: existingRead.MessageID,
			UserID:    existingRead.UserID,
			ReadAt:    existingRead.ReadAt,
		}
	}

	// WebSocketでリアルタイムブロードキャスト
	if h.hub != nil {
		broadcastData := map[string]any{
			"message_id": messageID,
			"user_id":    userUUID.String(),
			"read_at":    readResponse.ReadAt.Unix(),
		}
		h.hub.BroadcastToRoom(msg.RoomID.String(), "message_read", broadcastData, nil)
	}

	return c.JSON(http.StatusOK, readResponse)
}

// GetMessageReads メッセージ既読一覧取得
// GET /api/messages/:id/reads
func (h *MessageHandler) GetMessageReads(c echo.Context) error {
	messageID := c.Param("id")
	messageUUID, err := uuid.Parse(messageID)
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "Invalid message ID")
	}

	userUUID, err := getUserUUID(c)
	if err != nil {
		return err
	}

	ctx := c.Request().Context()

	// メッセージ存在チェック
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

	// 既読一覧取得
	reads, err := h.client.MessageRead.Query().
		Where(messageread.MessageID(messageUUID)).
		WithUser().
		Order(ent.Asc(messageread.FieldReadAt)).
		All(ctx)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to get reads")
	}

	// レスポンス作成
	readResponses := make([]models.MessageReadResponse, len(reads))
	for i, read := range reads {
		readResponses[i] = models.MessageReadResponse{
			ID:        read.ID,
			MessageID: read.MessageID,
			UserID:    read.UserID,
			ReadAt:    read.ReadAt,
		}
	}

	response := models.MessageReadListResponse{
		MessageID: messageUUID,
		Reads:     readResponses,
	}

	return c.JSON(http.StatusOK, response)
}

// AddReaction メッセージリアクション追加
// POST /api/messages/:id/reactions
func (h *MessageHandler) AddReaction(c echo.Context) error {
	messageID := c.Param("id")
	messageUUID, err := uuid.Parse(messageID)
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "Invalid message ID")
	}

	userUUID, err := getUserUUID(c)
	if err != nil {
		return err
	}

	ctx := c.Request().Context()

	// メッセージ存在チェック
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

	// 以降、ボディのバインドと任意のバリデーション
	var req models.MessageReactionRequest
	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "Invalid request body")
	}
	if c.Echo() != nil && c.Echo().Validator != nil {
		if err := c.Validate(&req); err != nil {
			return echo.NewHTTPError(http.StatusBadRequest, err.Error())
		}
	}
	if req.MessageID != uuid.Nil && req.MessageID != messageUUID {
		return echo.NewHTTPError(http.StatusBadRequest, "message_id mismatch")
	}

	// 既存のリアクションをチェック（同じユーザー、メッセージ、絵文字の組み合わせ）
	existingReaction, err := h.client.MessageReaction.Query().
		Where(
			messagereaction.MessageID(messageUUID),
			messagereaction.UserID(userUUID),
			messagereaction.Emoji(req.Emoji),
		).
		Only(ctx)

	var reactionResponse *models.MessageReactionResponse
	httpStatus := http.StatusOK

	if ent.IsNotFound(err) {
		// 新規リアクション作成
		newReaction, err := h.client.MessageReaction.Create().
			SetMessageID(messageUUID).
			SetUserID(userUUID).
			SetEmoji(req.Emoji).
			Save(ctx)
		if err != nil {
			// 同時実行でユニーク制約に当たった場合は既存を返す
			if ent.IsConstraintError(err) {
				existingReaction, err2 := h.client.MessageReaction.Query().
					Where(
						messagereaction.MessageID(messageUUID),
						messagereaction.UserID(userUUID),
						messagereaction.Emoji(req.Emoji),
					).
					Only(ctx)
				if err2 != nil {
					return echo.NewHTTPError(http.StatusInternalServerError, "Failed to add reaction")
				}
				reactionResponse = &models.MessageReactionResponse{
					ID:        existingReaction.ID,
					MessageID: existingReaction.MessageID,
					UserID:    existingReaction.UserID,
					Emoji:     existingReaction.Emoji,
					CreatedAt: existingReaction.CreatedAt,
				}
				httpStatus = http.StatusOK
			} else {
				return echo.NewHTTPError(http.StatusInternalServerError, "Failed to add reaction")
			}
		}

		if reactionResponse == nil { // 正常に作成できた場合
			reactionResponse = &models.MessageReactionResponse{
				ID:        newReaction.ID,
				MessageID: newReaction.MessageID,
				UserID:    newReaction.UserID,
				Emoji:     newReaction.Emoji,
				CreatedAt: newReaction.CreatedAt,
			}
			httpStatus = http.StatusCreated
		}
	} else if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to check existing reaction")
	} else {
		// 既存のリアクションを返す
		reactionResponse = &models.MessageReactionResponse{
			ID:        existingReaction.ID,
			MessageID: existingReaction.MessageID,
			UserID:    existingReaction.UserID,
			Emoji:     existingReaction.Emoji,
			CreatedAt: existingReaction.CreatedAt,
		}
		httpStatus = http.StatusOK
	}

	// WebSocketでリアルタイムブロードキャスト（新規作成時のみ）
	if h.hub != nil && httpStatus == http.StatusCreated {
		broadcastData := map[string]any{
			"message_id": messageID,
			"user_id":    userUUID.String(),
			"emoji":      req.Emoji,
			"created_at": reactionResponse.CreatedAt.Unix(),
		}
		h.hub.BroadcastToRoom(msg.RoomID.String(), "message_reaction_added", broadcastData, nil)
	}

	return c.JSON(httpStatus, reactionResponse)
}

// RemoveReaction メッセージリアクション削除
// DELETE /api/messages/:id/reactions/:emoji
func (h *MessageHandler) RemoveReaction(c echo.Context) error {
	messageID := c.Param("id")
	messageUUID, err := uuid.Parse(messageID)
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "Invalid message ID")
	}

	emoji := c.Param("emoji")
	if emoji == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "Emoji is required")
	}

	userUUID, err := getUserUUID(c)
	if err != nil {
		return err
	}

	ctx := c.Request().Context()

	// メッセージ存在チェック
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

	// リアクション削除
	deletedCount, err := h.client.MessageReaction.Delete().
		Where(
			messagereaction.MessageID(messageUUID),
			messagereaction.UserID(userUUID),
			messagereaction.Emoji(emoji),
		).
		Exec(ctx)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to remove reaction")
	}

	if deletedCount == 0 {
		return echo.NewHTTPError(http.StatusNotFound, "Reaction not found")
	}

	// WebSocketでリアルタイムブロードキャスト
	if h.hub != nil {
		broadcastData := map[string]any{
			"message_id": messageID,
			"user_id":    userUUID.String(),
			"emoji":      emoji,
		}
		h.hub.BroadcastToRoom(msg.RoomID.String(), "message_reaction_removed", broadcastData, nil)
	}

	return c.JSON(http.StatusOK, map[string]string{
		"message": "Reaction removed successfully",
	})
}

// GetMessageReactions メッセージリアクション一覧取得
// GET /api/messages/:id/reactions
func (h *MessageHandler) GetMessageReactions(c echo.Context) error {
	messageID := c.Param("id")
	messageUUID, err := uuid.Parse(messageID)
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "Invalid message ID")
	}

	userUUID, err := getUserUUID(c)
	if err != nil {
		return err
	}

	ctx := c.Request().Context()

	// メッセージ存在チェック
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

	// リアクション一覧取得
	reactions, err := h.client.MessageReaction.Query().
		Where(messagereaction.MessageID(messageUUID)).
		WithUser().
		Order(ent.Asc(messagereaction.FieldCreatedAt)).
		All(ctx)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to get reactions")
	}

	// レスポンス作成
	reactionResponses := make([]models.MessageReactionResponse, len(reactions))
	for i, reaction := range reactions {
		reactionResponses[i] = models.MessageReactionResponse{
			ID:        reaction.ID,
			MessageID: reaction.MessageID,
			UserID:    reaction.UserID,
			Emoji:     reaction.Emoji,
			CreatedAt: reaction.CreatedAt,
		}
	}

	response := models.MessageReactionListResponse{
		MessageID: messageUUID,
		Reactions: reactionResponses,
	}

	return c.JSON(http.StatusOK, response)
}

// GetMessageReactionsSummary メッセージリアクション集計取得
// GET /api/messages/:id/reactions/summary
func (h *MessageHandler) GetMessageReactionsSummary(c echo.Context) error {
	messageID := c.Param("id")
	messageUUID, err := uuid.Parse(messageID)
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "Invalid message ID")
	}

	userUUID, err := getUserUUID(c)
	if err != nil {
		return err
	}

	ctx := c.Request().Context()

	// メッセージ存在チェック
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

	// リアクション一覧取得（ユーザー情報込み）
	reactions, err := h.client.MessageReaction.Query().
		Where(messagereaction.MessageID(messageUUID)).
		WithUser().
		Order(ent.Asc(messagereaction.FieldCreatedAt)).
		All(ctx)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to get reactions")
	}

	// 絵文字ごとに集計
	emojiMap := make(map[string]*models.MessageReactionSummary)
	for _, reaction := range reactions {
		if summary, exists := emojiMap[reaction.Emoji]; exists {
			summary.Count++
			summary.Users = append(summary.Users, struct {
				UserID uuid.UUID `json:"user_id"`
				Name   string    `json:"name"`
			}{
				UserID: reaction.UserID,
				Name:   reaction.Edges.User.Name,
			})
		} else {
			emojiMap[reaction.Emoji] = &models.MessageReactionSummary{
				Emoji: reaction.Emoji,
				Count: 1,
				Users: []struct {
					UserID uuid.UUID `json:"user_id"`
					Name   string    `json:"name"`
				}{{
					UserID: reaction.UserID,
					Name:   reaction.Edges.User.Name,
				}},
			}
		}
	}

	// スライスに変換
	summaries := make([]models.MessageReactionSummary, 0, len(emojiMap))
	for _, summary := range emojiMap {
		summaries = append(summaries, *summary)
	}

	response := models.MessageReactionSummaryResponse{
		MessageID: messageUUID,
		Summary:   summaries,
	}

	return c.JSON(http.StatusOK, response)
}

// 安全に user_id を取り出し UUID へ変換するヘルパー関数
func getUserUUID(c echo.Context) (uuid.UUID, error) {
	v := c.Get("user_id")
	s, ok := v.(string)
	if !ok || s == "" {
		return uuid.Nil, echo.NewHTTPError(http.StatusUnauthorized, "Unauthorized")
	}

	u, err := uuid.Parse(s)
	if err != nil {
		return uuid.Nil, echo.NewHTTPError(http.StatusBadRequest, "Invalid user ID")
	}
	return u, nil
}

// SaveWebSocketMessage WebSocketメッセージをデータベースに保存する（websocket.MessageSaverインターフェースの実装）
func (h *MessageHandler) SaveWebSocketMessage(ctx context.Context, roomID, userID, content string) (*websocket.MessageSaverResponse, error) {
	// UUID変換
	roomUUID, err := uuid.Parse(roomID)
	if err != nil {
		return nil, err
	}

	userUUID, err := uuid.Parse(userID)
	if err != nil {
		return nil, err
	}

	// ユーザーがそのルームのメンバーかチェック
	member, err := h.client.RoomMember.Query().
		Where(
			roommember.RoomID(roomUUID),
			roommember.UserID(userUUID),
		).
		WithRoom().
		First(ctx)

	if err != nil {
		return nil, err
	}

	// メッセージ作成
	msg, err := h.client.Message.Create().
		SetRoomID(roomUUID).
		SetUserID(userUUID).
		SetRoom(member.Edges.Room).
		SetSenderID(userUUID).
		SetContent(content).
		Save(ctx)
	if err != nil {
		return nil, err
	}

	// 送信者情報を含めてメッセージを再取得
	messageWithSender, err := h.client.Message.Query().
		Where(message.ID(msg.ID)).
		WithSender().
		Only(ctx)
	if err != nil {
		return nil, err
	}

	// websocket.MessageSaverResponse形式で返却
	response := &websocket.MessageSaverResponse{
		ID:        messageWithSender.ID.String(),
		Content:   messageWithSender.Content,
		UserID:    messageWithSender.Edges.Sender.ID.String(),
		RoomID:    roomID,
		CreatedAt: messageWithSender.CreatedAt,
		FileURL:   messageWithSender.FileURL,
	}

	return response, nil
}
