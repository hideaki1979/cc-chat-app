package models

import (
	"time"

	"github.com/hideaki1979/cc-chat-app/apps/api/ent"
)

// SendMessageRequest メッセージ送信リクエスト
type SendMessageRequest struct {
	Content string `json:"content" validate:"required,min=1,max=2000"`
	FileURL string `json:"file_url,omitempty" validate:"omitempty,url"`
}

// UpdateMessageRequest メッセージ更新リクエスト
type UpdateMessageRequest struct {
	Content string `json:"content" validate:"required,min=1,max=2000"`
}

// MessageResponse メッセージレスポンス
type MessageResponse struct {
	ID        string    `json:"id"`
	RoomID    string    `json:"room_id"`
	UserID    string    `json:"user_id"`
	Content   string    `json:"content"`
	FileURL   *string   `json:"file_url,omitempty"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
	DeletedAt *time.Time `json:"deleted_at,omitempty"`
	Sender    MessageSender `json:"sender"`
}

// MessageSender メッセージ送信者情報
type MessageSender struct {
	ID               string  `json:"id"`
	Name             string  `json:"name"`
	ProfileImageURL  *string `json:"profile_image_url,omitempty"`
}

// MessageListParams メッセージ一覧取得パラメータ
type MessageListParams struct {
	Page     int `query:"page" validate:"min=1"`
	PageSize int `query:"page_size" validate:"min=1,max=100"`
	Before   string `query:"before,omitempty"` // 指定した日時より前のメッセージを取得
}

// ConvertToMessageResponse EntのMessageをレスポンス形式に変換
func ConvertToMessageResponse(message *ent.Message) *MessageResponse {
	response := &MessageResponse{
		ID:        message.ID.String(),
		RoomID:    message.RoomID.String(),
		UserID:    message.UserID.String(),
		Content:   message.Content,
		CreatedAt: message.CreatedAt,
		UpdatedAt: message.UpdatedAt,
	}

	// ファイルURL設定
	if message.FileURL != nil && *message.FileURL != "" {
		response.FileURL = message.FileURL
	}

	// 論理削除日時設定
	if message.DeletedAt != nil {
		response.DeletedAt = message.DeletedAt
	}

	// 送信者情報設定
	if message.Edges.Sender != nil {
		response.Sender = MessageSender{
			ID:   message.Edges.Sender.ID.String(),
			Name: message.Edges.Sender.Name,
		}
		if message.Edges.Sender.ProfileImageURL != nil && *message.Edges.Sender.ProfileImageURL != "" {
			response.Sender.ProfileImageURL = message.Edges.Sender.ProfileImageURL
		}
	}

	return response
}