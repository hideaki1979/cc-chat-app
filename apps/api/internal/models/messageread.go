package models

import (
	"time"

	"github.com/google/uuid"
)

// MessageReadRequest メッセージ既読リクエスト
type MessageReadRequest struct {
	MessageID *uuid.UUID `json:"message_id" validate:"required"`
}

// MessageReadResponse メッセージ既読レスポンス
type MessageReadResponse struct {
	ID        uuid.UUID `json:"id"`
	MessageID uuid.UUID `json:"message_id"`
	UserID    uuid.UUID `json:"user_id"`
	ReadAt    time.Time `json:"read_at"`
}

// MessageReadListResponse メッセージ既読一覧レスポンス
type MessageReadListResponse struct {
	MessageID uuid.UUID             `json:"message_id"`
	Reads     []MessageReadResponse `json:"reads"`
}