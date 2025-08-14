package util

import (
	"os"
	"strings"
)

// 環境判定
func IsProduction() bool {
	env := os.Getenv("GO_ENV")
	env = strings.ToLower(strings.TrimSpace(env))
	return env == "production" || env == "prod"
}
