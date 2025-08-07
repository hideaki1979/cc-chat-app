package models

// ユーザー登録用のリクエスト構造体
type RegisterRequest struct {
	Name     string `json:"name" validate:"required,min=2,max=50"`
	Email    string `json:"email" validate:"required,email"`
	Password string `json:"password" validate:"required,min=8"`
}

// ユーザーログイン用のリクエスト構造体
type LoginRequest struct {
	Email    string `json:"email" validate:"required,email"`
	Password string `json:"password" validate:"required"`
}

// 認証レスポンス構造体
type AuthResponse struct {
	Token string    `json:"token"`
	User  UserInfo  `json:"user"`
}

// ユーザー情報構造体（パスワードを除く）
type UserInfo struct {
	ID               string `json:"id"`
	Name             string `json:"name"`
	Email            string `json:"email"`
	ProfileImageURL  string `json:"profile_image_url,omitempty"`
	Bio              string `json:"bio,omitempty"`
	CreatedAt        string `json:"created_at"`
	UpdatedAt        string `json:"updated_at"`
}

// エラーレスポンス構造体
type ErrorResponse struct {
	Message string `json:"message"`
	Code    string `json:"code,omitempty"`
}