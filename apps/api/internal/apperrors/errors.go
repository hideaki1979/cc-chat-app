package apperrors

import "errors"


var (
	// ErrUserNotFound ユーザーが見つからない場合のエラー
	ErrUserNotFound = errors.New("user not found")

	// ErrEmailExists はメールアドレスの一意制約違反を表すエラー
	ErrEmailExists = errors.New("email already exists")
)
