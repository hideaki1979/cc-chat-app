package models

import (
	"time"

	"github.com/google/uuid"
)

// MessageReactionRequest メッセージリアクションリクエスト
type MessageReactionRequest struct {
	MessageID uuid.UUID `json:"message_id" validate:"required"`
	Emoji     string    `json:"emoji" validate:"required,min=1,max=10"`
}

// MessageReactionResponse メッセージリアクションレスポンス
type MessageReactionResponse struct {
	ID        uuid.UUID `json:"id"`
	MessageID uuid.UUID `json:"message_id"`
	UserID    uuid.UUID `json:"user_id"`
	Emoji     string    `json:"emoji"`
	CreatedAt time.Time `json:"created_at"`
}

// MessageReactionListResponse メッセージリアクション一覧レスポンス
type MessageReactionListResponse struct {
	MessageID uuid.UUID                 `json:"message_id"`
	Reactions []MessageReactionResponse `json:"reactions"`
}

// MessageReactionSummary メッセージリアクション集計
type MessageReactionSummary struct {
	Emoji string `json:"emoji"`
	Count int    `json:"count"`
	Users []struct {
		UserID uuid.UUID `json:"user_id"`
		Name   string    `json:"name"`
	} `json:"users"`
}

// MessageReactionSummaryResponse メッセージリアクション集計レスポンス
type MessageReactionSummaryResponse struct {
	MessageID uuid.UUID                `json:"message_id"`
	Summary   []MessageReactionSummary `json:"summary"`
}