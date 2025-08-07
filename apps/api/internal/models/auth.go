package models

import "time"

// ユーザー登録用のリクエスト構造体
type RegisterRequest struct {
	Name     string `json:"username" validate:"required,min=2,max=30,regexp=^[a-zA-Z0-9_-]+$"`
	Email    string `json:"email" validate:"required,email"`
	Password string `json:"password" validate:"required,min=6,regexp=^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d).+$"`
}

// ユーザーログイン用のリクエスト構造体
type LoginRequest struct {
	Email    string `json:"email" validate:"required,email"`
	Password string `json:"password" validate:"required,min=6"`
}

// 認証レスポンス構造体
type AuthResponse struct {
	Token string   `json:"token"`
	User  UserInfo `json:"user"`
}

// ユーザー情報構造体（パスワードを除く）
type UserInfo struct {
	ID              string    `json:"id"`
	Name            string    `json:"name"`
	Email           string    `json:"email"`
	ProfileImageURL string    `json:"profile_image_url,omitempty"`
	Bio             string    `json:"bio,omitempty"`
	CreatedAt       time.Time `json:"created_at"`
	UpdatedAt       time.Time `json:"updated_at"`
}

// エラーレスポンス構造体
type ErrorResponse struct {
	Message string `json:"message"`
	Code    string `json:"code,omitempty"`
}
