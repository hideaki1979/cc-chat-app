package handlers

import "time"

const MessageEditTimeLimit = 5 * time.Minute	// 大文字なのでエクスポートされる（小文字だとされない）