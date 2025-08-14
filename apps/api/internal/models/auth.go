package models

import "time"

// ユーザー登録用のリクエスト構造体
type RegisterRequest struct {
	Name     string `json:"name" validate:"required,min=2,max=30,username"`
	Email    string `json:"email" validate:"required,email"`
	Password string `json:"password" validate:"required,min=8,password_complex"`
}

// ユーザーログイン用のリクエスト構造体
type LoginRequest struct {
	Email    string `json:"email" validate:"required,email"`
	Password string `json:"password" validate:"required,min=8"`
}

// 認証レスポンス構造体（refresh_tokenはCookieで送信されるためレスポンスに含まない）
type AuthResponse struct {
	Token string   `json:"token"`
	User  UserInfo `json:"user"`
}

// トークンリフレッシュリクエスト構造体（Cookieから取得するため不要だが互換性のため残す）
type RefreshTokenRequest struct {
	RefreshToken string `json:"refresh_token" validate:"required"`
}

// トークンリフレッシュレスポンス構造体（refresh_tokenはCookieで送信されるためレスポンスに含まない）
type RefreshTokenResponse struct {
	Token string `json:"token"`
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

// プロフィール更新用のリクエスト構造体
type UpdateProfileRequest struct {
	Name            string `json:"name" validate:"omitempty,min=2,max=30,username"`
	Bio             string `json:"bio" validate:"omitempty,max=500"`
	ProfileImageURL string `json:"profile_image_url" validate:"omitempty,url"`
}

// ユーザー検索用のリクエスト構造体
type UserSearchRequest struct {
	Query string `json:"query" validate:"required,min=1,max=50"`
	Limit int    `json:"limit" validate:"omitempty,min=1,max=20"`
}

// ユーザー検索レスポンス構造体
type UserSearchResponse struct {
	Users []UserSearchResult `json:"users"`
	Total int                `json:"total"`
}

// ユーザー検索結果（簡易ユーザー情報）
type UserSearchResult struct {
	ID              string `json:"id"`
	Name            string `json:"name"`
	Email           string `json:"email"`
	ProfileImageURL string `json:"profile_image_url,omitempty"`
}

// アバター画像アップロードレスポンス構造体
type UploadAvatarResponse struct {
	ProfileImageURL string `json:"profile_image_url"`
	Message         string `json:"message"`
}

// エラーレスポンス構造体
type ErrorResponse struct {
	Message string `json:"message"`
	Code    string `json:"code,omitempty"`
}
