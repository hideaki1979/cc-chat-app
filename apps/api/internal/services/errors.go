package services

import "errors"


var (
	// ErrEmailExists はメールアドレスの一意制約違反を表すエラー
	ErrEmailExists = errors.New("email already exists")

	// ErrUserNotFound ユーザーが見つからない場合のエラー
	ErrUserNotFound = errors.New("user not found")

)


