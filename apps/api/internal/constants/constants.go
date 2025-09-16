package constants

import "time"

const (
	MaxFileSize          = 5 * 1024 * 1024
	MessageEditTimeLimit = 5 * time.Minute // 大文字なのでエクスポートされる（小文字だとされない）
)
