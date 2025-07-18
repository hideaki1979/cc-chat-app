package main

import (
	"net/http"
	"github.com/labstack/echo/v4"
)

// ヘルスチェック用のハンドラー
func healthCheck(c echo.Context) error {
	// HTTPステータス200 (OK) と、文字列 "OK" を返す
	return c.String(http.StatusOK, "接続OK！")
}

func main() {
	// Echoのインスタンスを作成
	e := echo.New()

	// ルーティングを設定
	// GETリクエストで /health にアクセスがあったら healthCheck 関数を呼ぶ
	e.GET("/health", healthCheck)

	// サーバーをポート8080で起動
	// サーバー起動に失敗したら、エラーをログに出力して終了する
	e.Logger.Fatal(e.Start(":8080"))
}