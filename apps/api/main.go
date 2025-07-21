package main

import (
	"context"
	"net/http"
	"os"
	"os/signal"
	"time"

	"github.com/labstack/echo/v4"
	"github.com/labstack/echo/v4/middleware"
)

const (
	defaultPort     = "8080"
	portEnvKey      = "PORT"
	healthCheckPath = "/health"
)

// ヘルスチェック用のハンドラー
func healthCheck(c echo.Context) error {
	// HTTPステータス200 (OK) と、文字列 "OK" を返す
	return c.String(http.StatusOK, "接続OK！")
}

func main() {
	// Echoのインスタンスを作成
	e := echo.New()

	// ミドルウェアを設定
	e.Use(middleware.LoggerWithConfig(middleware.LoggerConfig{
		Skipper: func(c echo.Context) bool {
			return c.Path() == healthCheckPath
		},
	}))

	e.Use(middleware.Recover())
	e.Use(middleware.CORS())

	// ルーティングを設定
	// GETリクエストで /health にアクセスがあったら healthCheck 関数を呼ぶ
	e.GET(healthCheckPath, healthCheck)

	// グレースフルシャットダウンの設定
	go func() {
		// PORT環境変数を取得、なければ8080をデフォルトにする
		port := os.Getenv(portEnvKey)
		if port == "" {
			port = defaultPort
		}
		if err := e.Start(":" + port); err != nil && err != http.ErrServerClosed {
			e.Logger.Fatal("shutting down the server")
		}
	}()

	// シグナルを待機
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, os.Interrupt)
	<-quit

	// サーバーをシャットダウン
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := e.Shutdown(ctx); err != nil {
		e.Logger.Fatal(err)
	}
}
