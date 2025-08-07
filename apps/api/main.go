package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"time"

	"github.com/hideaki1979/cc-chat-app/apps/api/ent"
	"github.com/hideaki1979/cc-chat-app/apps/api/internal/handlers"
	"github.com/hideaki1979/cc-chat-app/apps/api/internal/middleware"
	"github.com/joho/godotenv"
	"github.com/labstack/echo/v4"
	echoMiddleware "github.com/labstack/echo/v4/middleware"
	_ "github.com/lib/pq"
)

const (
	defaultPort       = "8080"
	portEnvKey        = "PORT"
	healthCheckPath   = "/health"
	defaultDatabaseURL = "postgres://user:password@localhost/chatapp?sslmode=disable"
	databaseURLKey    = "DATABASE_URL"
)

// ヘルスチェック用のハンドラー
func healthCheck(c echo.Context) error {
	// HTTPステータス200 (OK) と、文字列 "OK" を返す
	return c.String(http.StatusOK, "接続OK！")
}

func main() {
	// .envファイルを読み込み（エラーは無視、システム環境変数が優先）
	_ = godotenv.Load()

	// データベース接続設定
	dbURL := os.Getenv(databaseURLKey)
	if dbURL == "" {
		dbURL = defaultDatabaseURL
	}

	// Entクライアントを直接作成（PostgreSQL用）
	client, err := ent.Open("postgres", dbURL)
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}
	defer client.Close()

	// マイグレーションを実行
	ctx := context.Background()
	if err := client.Schema.Create(ctx); err != nil {
		log.Fatalf("Failed to create database schema: %v", err)
	}
	log.Println("Database schema created successfully")

	// Echoのインスタンスを作成
	e := echo.New()

	// ミドルウェアを設定
	e.Use(echoMiddleware.LoggerWithConfig(echoMiddleware.LoggerConfig{
		Skipper: func(c echo.Context) bool {
			return c.Path() == healthCheckPath
		},
	}))

	e.Use(echoMiddleware.Recover())
	e.Use(echoMiddleware.CORS())

	// コンテキストにEntクライアントを設定
	e.Use(func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			c.Set("db", client)
			return next(c)
		}
	})

	// ハンドラー初期化
	authHandler := handlers.NewAuthHandler()

	// ルーティング設定
	// ヘルスチェック
	e.GET(healthCheckPath, healthCheck)

	// 認証関連のエンドポイント（JWT認証不要）
	authGroup := e.Group("/api/auth")
	authGroup.POST("/register", authHandler.Register)
	authGroup.POST("/login", authHandler.Login)
	authGroup.POST("/logout", authHandler.Logout)

	// 認証が必要なエンドポイント
	protectedGroup := e.Group("/api")
	protectedGroup.Use(middleware.JWTAuth())
	protectedGroup.GET("/profile", authHandler.Profile)

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
