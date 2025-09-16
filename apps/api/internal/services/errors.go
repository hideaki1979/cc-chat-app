package services

import "errors"


var (
	// ErrEmailExists はメールアドレスの一意制約違反を表すエラー
	ErrEmailExists = errors.New("email already exists")

	// ErrUserNotFound ユーザーが見つからない場合のエラー
	ErrUserNotFound = errors.New("user not found")

	// ErrNotAuthenticated 認証が必要な場合のエラー
	ErrNotAuthenticated = errors.New("authentication required")

	// ErrInvalidCredentials 認証情報が無効な場合のエラー
	ErrInvalidCredentials = errors.New("invalid credentials")

	// ErrInvalidToken トークンが無効な場合のエラー
	ErrInvalidToken = errors.New("invalid token")
)


