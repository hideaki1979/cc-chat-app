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

	// ErrInvalidInput 入力が不正な場合のエラー（バリデーション/フォーマット等）
	ErrInvalidInput = errors.New("invalid input")

	// ErrFileNotFound アップロードファイルが見つからない場合のエラー
	ErrFileNotFound = errors.New("file not found")

	// ErrFileTooLarge アップロードファイルが大きすぎる場合のエラー
	ErrFileTooLarge = errors.New("file too large")

	// ErrInvalidFileType サポートされないファイル形式のエラー
	ErrInvalidFileType = errors.New("invalid file type")

	// ErrFileReadError ファイルの読み取りに失敗した場合のエラー
	ErrFileReadError = errors.New("file read error")

	ErrDBNotAvailable = errors.New("db client not available")
)
