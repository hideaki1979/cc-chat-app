package models

import (
	"time"

	"github.com/google/uuid"
	"github.com/hideaki1979/cc-chat-app/apps/api/ent"
)

// CreateChatRoomRequest チャットルーム作成リクエスト
type CreateChatRoomRequest struct {
	Name        string    `json:"name" validate:"required,min=1,max=100"`
	IsGroupChat bool      `json:"is_group_chat"`
	MemberIDs   []string  `json:"member_ids" validate:"required,min=1"`
}

// UpdateChatRoomRequest チャットルーム更新リクエスト
type UpdateChatRoomRequest struct {
	Name *string `json:"name,omitempty" validate:"omitempty,min=1,max=100"`
}

// AddMemberRequest メンバー追加リクエスト
type AddMemberRequest struct {
	UserID string `json:"user_id" validate:"required,uuid"`
}

// ChatRoomResponse チャットルーム詳細レスポンス
type ChatRoomResponse struct {
	ID          string              `json:"id"`
	Name        string              `json:"name"`
	IsGroupChat bool                `json:"is_group_chat"`
	CreatedAt   time.Time           `json:"created_at"`
	UpdatedAt   time.Time           `json:"updated_at"`
	Members     []ChatRoomMember    `json:"members,omitempty"`
	LastMessage *LastMessageInfo   `json:"last_message,omitempty"`
}

// ChatRoomListResponse チャットルーム一覧レスポンス
type ChatRoomListResponse struct {
	ID          string            `json:"id"`
	Name        string            `json:"name"`
	IsGroupChat bool              `json:"is_group_chat"`
	CreatedAt   time.Time         `json:"created_at"`
	UpdatedAt   time.Time         `json:"updated_at"`
	LastMessage *LastMessageInfo  `json:"last_message,omitempty"`
	MemberCount int               `json:"member_count"`
}

// ChatRoomMember チャットルームメンバー情報
type ChatRoomMember struct {
	UserID   string    `json:"user_id"`
	Name     string    `json:"name"`
	Email    string    `json:"email"`
	JoinedAt time.Time `json:"joined_at"`
}

// LastMessageInfo 最新メッセージ情報
type LastMessageInfo struct {
	ID         string    `json:"id"`
	Content    string    `json:"content"`
	SenderID   string    `json:"sender_id"`
	SenderName string    `json:"sender_name"`
	CreatedAt  time.Time `json:"created_at"`
}

// ChatRoomListParams チャットルーム一覧取得パラメータ
type ChatRoomListParams struct {
	Page     int `query:"page" validate:"min=1"`
	PageSize int `query:"page_size" validate:"min=1,max=100"`
}

// ConvertToChatRoomResponse EntのChatRoomをレスポンス形式に変換
func ConvertToChatRoomResponse(room *ent.ChatRoom) *ChatRoomResponse {
	response := &ChatRoomResponse{
		ID:          room.ID.String(),
		Name:        room.Name,
		IsGroupChat: room.IsGroupChat,
		CreatedAt:   room.CreatedAt,
		UpdatedAt:   room.UpdatedAt,
	}

	// メンバー情報がロードされている場合
	if room.Edges.RoomMembers != nil {
		members := make([]ChatRoomMember, len(room.Edges.RoomMembers))
		for i, rm := range room.Edges.RoomMembers {
			member := ChatRoomMember{
				UserID:   rm.UserID.String(),
				JoinedAt: rm.JoinedAt,
			}
			// ユーザー情報がロードされている場合
			if rm.Edges.User != nil {
				member.Name = rm.Edges.User.Name
				member.Email = rm.Edges.User.Email
			}
			members[i] = member
		}
		response.Members = members
	}

	// 最新メッセージ情報がロードされている場合
	if len(room.Edges.Messages) > 0 {
		lastMsg := room.Edges.Messages[0] // 最新メッセージ（created_at DESC順でソート済み想定）
		response.LastMessage = &LastMessageInfo{
			ID:        lastMsg.ID.String(),
			Content:   lastMsg.Content,
			SenderID:  lastMsg.UserID.String(),
			CreatedAt: lastMsg.CreatedAt,
		}
		// 送信者情報がロードされている場合
		if lastMsg.Edges.Sender != nil {
			response.LastMessage.SenderName = lastMsg.Edges.Sender.Name
		}
	}

	return response
}

// ConvertToChatRoomListResponse EntのChatRoomをリスト用レスポンス形式に変換
func ConvertToChatRoomListResponse(room *ent.ChatRoom, memberCount int) *ChatRoomListResponse {
	response := &ChatRoomListResponse{
		ID:          room.ID.String(),
		Name:        room.Name,
		IsGroupChat: room.IsGroupChat,
		CreatedAt:   room.CreatedAt,
		UpdatedAt:   room.UpdatedAt,
		MemberCount: memberCount,
	}

	// 最新メッセージ情報がロードされている場合
	if len(room.Edges.Messages) > 0 {
		lastMsg := room.Edges.Messages[0] // 最新メッセージ（created_at DESC順でソート済み想定）
		response.LastMessage = &LastMessageInfo{
			ID:        lastMsg.ID.String(),
			Content:   lastMsg.Content,
			SenderID:  lastMsg.UserID.String(),
			CreatedAt: lastMsg.CreatedAt,
		}
		// 送信者情報がロードされている場合
		if lastMsg.Edges.Sender != nil {
			response.LastMessage.SenderName = lastMsg.Edges.Sender.Name
		}
	}

	return response
}

// ValidateUUIDs UUID文字列のバリデーション
func ValidateUUIDs(uuidStrs []string) error {
	for _, uuidStr := range uuidStrs {
		if _, err := uuid.Parse(uuidStr); err != nil {
			return err
		}
	}
	return nil
}