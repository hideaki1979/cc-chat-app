package handlers

import (
	"context"
	"net/http"
	"strconv"
	"time"

	"github.com/google/uuid"
	"github.com/hideaki1979/cc-chat-app/apps/api/ent"
	"github.com/hideaki1979/cc-chat-app/apps/api/ent/chatroom"
	"github.com/hideaki1979/cc-chat-app/apps/api/ent/roommember"
	"github.com/hideaki1979/cc-chat-app/apps/api/ent/user"
	"github.com/hideaki1979/cc-chat-app/apps/api/internal/models"
	"github.com/labstack/echo/v4"
)

// ChatRoomHandler チャットルーム関連のハンドラー
type ChatRoomHandler struct {
	client *ent.Client
}

// NewChatRoomHandler ChatRoomHandlerのコンストラクタ
func NewChatRoomHandler(client *ent.Client) *ChatRoomHandler {
	return &ChatRoomHandler{client: client}
}

// CreateChatRoom チャットルーム作成
// POST /api/chatrooms
func (h *ChatRoomHandler) CreateChatRoom(c echo.Context) error {
	var req models.CreateChatRoomRequest
	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "Invalid request body")
	}

	if err := c.Validate(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, err.Error())
	}

	// UUID検証
	if err := models.ValidateUUIDs(req.MemberIDs); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "Invalid UUID format in member_ids")
	}

	// 現在のユーザーIDを取得（JWTミドルウェアから）
	userID := c.Get("user_id").(string)
	currentUserUUID, err := uuid.Parse(userID)
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "Invalid user ID")
	}

	ctx := context.Background()

	// トランザクション開始
	tx, err := h.client.Tx(ctx)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to start transaction")
	}
	defer tx.Rollback()

	// メンバーのユーザーIDリストにログインユーザーを追加
	memberSet := make(map[uuid.UUID]struct{})
	memberSet[currentUserUUID] = struct{}{}
	for _, memberID := range req.MemberIDs {
		memberUUID, _ := uuid.Parse(memberID)	// バリデーション済のため、エラーは無視
		memberSet[memberUUID] = struct{}{}
	}

	memberUUIDs := make([]uuid.UUID, 0, len(memberSet))
	
	for u := range memberSet {
		memberUUIDs = append(memberUUIDs, u)
	}

	// メンバーの存在チェック
	existingUsers, err := tx.User.Query().
		Where(user.IDIn(memberUUIDs...)).
		All(ctx)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to check users")
	}

	if len(existingUsers) != len(memberUUIDs) {
		return echo.NewHTTPError(http.StatusBadRequest, "Some users do not exist")
	}

	// チャットルーム作成
	room, err := tx.ChatRoom.Create().
		SetName(req.Name).
		SetIsGroupChat(req.IsGroupChat).
		Save(ctx)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to create chat room")
	}

	// メンバー追加
	for _, memberUUID := range memberUUIDs {
		_, err := tx.RoomMember.Create().
			SetRoomID(room.ID).
			SetUserID(memberUUID).
			SetJoinedAt(time.Now()).
			Save(ctx)
		if err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to add room member")
		}
	}

	// コミット
	if err := tx.Commit(); err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to commit transaction")
	}

	// レスポンス用にデータを再取得
	roomWithMembers, err := h.client.ChatRoom.Query().
		Where(chatroom.ID(room.ID)).
		WithRoomMembers(func(q *ent.RoomMemberQuery) {
			q.WithUser()
		}).
		Only(ctx)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to get created room")
	}

	response := models.ConvertToChatRoomResponse(roomWithMembers)
	return c.JSON(http.StatusCreated, response)
}

// GetChatRooms ユーザーが参加しているチャットルーム一覧取得
// GET /api/chatrooms
func (h *ChatRoomHandler) GetChatRooms(c echo.Context) error {
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
		pageSize = 20
	}

	ctx := context.Background()

	// ユーザーが参加しているルームを取得
	rooms, err := h.client.ChatRoom.Query().
		Where(chatroom.HasRoomMembersWith(roommember.UserID(userUUID))).
		WithMessages(func(q *ent.MessageQuery) {
			q.WithSender().
				Order(ent.Desc("created_at")).
				Limit(1) // 最新メッセージのみ
		}).
		WithRoomMembers().
		Order(ent.Desc(chatroom.FieldUpdatedAt)).
		Offset((page - 1) * pageSize).
		Limit(pageSize).
		All(ctx)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to get chat rooms")
	}

	// レスポンス作成
	responses := make([]*models.ChatRoomListResponse, len(rooms))
	for i, room := range rooms {
		// メンバー数を取得
		memberCount := len(room.Edges.RoomMembers)
		responses[i] = models.ConvertToChatRoomListResponse(room, memberCount)
	}

	return c.JSON(http.StatusOK, map[string]interface{}{
		"rooms": responses,
		"pagination": map[string]interface{}{
			"page":      page,
			"page_size": pageSize,
			"total":     len(responses),
		},
	})
}

// GetChatRoom チャットルーム詳細取得
// GET /api/chatrooms/:id
func (h *ChatRoomHandler) GetChatRoom(c echo.Context) error {
	roomID := c.Param("id")
	roomUUID, err := uuid.Parse(roomID)
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "Invalid room ID")
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

	// チャットルーム詳細取得
	room, err := h.client.ChatRoom.Query().
		Where(chatroom.ID(roomUUID)).
		WithRoomMembers(func(q *ent.RoomMemberQuery) {
			q.WithUser()
		}).
		WithMessages(func(q *ent.MessageQuery) {
			q.WithSender().
				Order(ent.Desc("created_at")).
				Limit(1) // 最新メッセージのみ
		}).
		Only(ctx)
	if err != nil {
		if ent.IsNotFound(err) {
			return echo.NewHTTPError(http.StatusNotFound, "Chat room not found")
		}
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to get chat room")
	}

	response := models.ConvertToChatRoomResponse(room)
	return c.JSON(http.StatusOK, response)
}

// UpdateChatRoom チャットルーム更新
// PUT /api/chatrooms/:id
func (h *ChatRoomHandler) UpdateChatRoom(c echo.Context) error {
	roomID := c.Param("id")
	roomUUID, err := uuid.Parse(roomID)
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "Invalid room ID")
	}

	var req models.UpdateChatRoomRequest
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

	// 更新処理
	updateQuery := h.client.ChatRoom.UpdateOneID(roomUUID)
	if req.Name != nil {
		updateQuery = updateQuery.SetName(*req.Name)
	}

	room, err := updateQuery.Save(ctx)
	if err != nil {
		if ent.IsNotFound(err) {
			return echo.NewHTTPError(http.StatusNotFound, "Chat room not found")
		}
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to update chat room")
	}

	// 更新後の詳細データを取得
	updatedRoom, err := h.client.ChatRoom.Query().
		Where(chatroom.ID(room.ID)).
		WithRoomMembers(func(q *ent.RoomMemberQuery) {
			q.WithUser()
		}).
		WithMessages(func(q *ent.MessageQuery) {
			q.WithSender().
				Order(ent.Desc("created_at")).
				Limit(1)
		}).
		Only(ctx)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to get updated room")
	}

	response := models.ConvertToChatRoomResponse(updatedRoom)
	return c.JSON(http.StatusOK, response)
}

// AddMember チャットルームにメンバー追加
// POST /api/chatrooms/:id/members
func (h *ChatRoomHandler) AddMember(c echo.Context) error {
	roomID := c.Param("id")
	roomUUID, err := uuid.Parse(roomID)
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "Invalid room ID")
	}

	var req models.AddMemberRequest
	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "Invalid request body")
	}

	if err := c.Validate(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, err.Error())
	}

	newMemberUUID, err := uuid.Parse(req.UserID)
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "Invalid user ID")
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

	// 追加するユーザーの存在チェック
	exists, err := h.client.User.Query().
		Where(user.ID(newMemberUUID)).
		Exist(ctx)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to check user existence")
	}
	if !exists {
		return echo.NewHTTPError(http.StatusBadRequest, "User does not exist")
	}

	// 既にメンバーかチェック
	alreadyMember, err := h.client.RoomMember.Query().
		Where(
			roommember.RoomID(roomUUID),
			roommember.UserID(newMemberUUID),
		).
		Exist(ctx)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to check existing membership")
	}
	if alreadyMember {
		return echo.NewHTTPError(http.StatusConflict, "User is already a member")
	}

	// メンバー追加
	_, err = h.client.RoomMember.Create().
		SetRoomID(roomUUID).
		SetUserID(newMemberUUID).
		SetJoinedAt(time.Now()).
		Save(ctx)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to add member")
	}

	return c.JSON(http.StatusCreated, map[string]string{
		"message": "Member added successfully",
	})
}

// RemoveMember チャットルームからメンバー削除
// DELETE /api/chatrooms/:id/members/:user_id
func (h *ChatRoomHandler) RemoveMember(c echo.Context) error {
	roomID := c.Param("id")
	roomUUID, err := uuid.Parse(roomID)
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "Invalid room ID")
	}

	targetUserID := c.Param("user_id")
	targetUserUUID, err := uuid.Parse(targetUserID)
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "Invalid user ID")
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

	// 削除対象がメンバーかチェック
	targetMember, err := h.client.RoomMember.Query().
		Where(
			roommember.RoomID(roomUUID),
			roommember.UserID(targetUserUUID),
		).
		Only(ctx)
	if err != nil {
		if ent.IsNotFound(err) {
			return echo.NewHTTPError(http.StatusNotFound, "Member not found")
		}
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to find member")
	}

	// メンバー削除
	err = h.client.RoomMember.DeleteOne(targetMember).Exec(ctx)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to remove member")
	}

	return c.JSON(http.StatusOK, map[string]string{
		"message": "Member removed successfully",
	})
}