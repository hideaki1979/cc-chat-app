package util

import "os"

// 環境判定
func IsProduction() bool {
	return os.Getenv("GO_ENV") == "production"
}
