package main

import (
	"context"
	"database/sql"
	"log"
	"net/http"
	"os"
	"os/signal"
	"time"

	"entgo.io/ent/dialect"
	entsql "entgo.io/ent/dialect/sql"

	"github.com/hideaki1979/cc-chat-app/apps/api/ent"
	_ "github.com/hideaki1979/cc-chat-app/apps/api/ent/runtime"
	"github.com/hideaki1979/cc-chat-app/apps/api/internal/handlers"
	"github.com/hideaki1979/cc-chat-app/apps/api/internal/middleware"
	"github.com/joho/godotenv"
	"github.com/labstack/echo/v4"
	echoMiddleware "github.com/labstack/echo/v4/middleware"
	_ "github.com/lib/pq"
)

const (
	defaultPort        = "8080"
	portEnvKey         = "PORT"
	healthCheckPath    = "/health"
	defaultDatabaseURL = ""
	databaseURLKey     = "DATABASE_URL"
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
		log.Fatal("DATABASE_URL environment variable must be set")
	}

	// sql.DBを直接作成してプール設定
	db, err := sql.Open("postgres", dbURL)
	if err != nil {
		log.Fatalf("Failed to open database: %v", err)
	}

	// コネクションプール設定
	db.SetMaxIdleConns(10)
	db.SetMaxOpenConns(100)
	db.SetConnMaxLifetime(time.Hour)

	// EntクライアントをDriverオプションで作成
	drv := entsql.OpenDB(dialect.Postgres, db)
	client := ent.NewClient(ent.Driver(drv))
	defer client.Close()

	// マイグレーションを条件付きで実行（本番環境では無効化）
	if os.Getenv("RUN_MIGRATIONS") == "true" {
		ctx := context.Background()
		if err := client.Schema.Create(ctx); err != nil {
			log.Fatalf("Failed to create database schema: %v", err)
		}
		log.Println("Database schema created successfully")
	}
	// Echoのインスタンスを作成
	e := echo.New()

	// カスタムバリデーターを設定
	e.Validator = middleware.NewValidator()

	// ミドルウェアを設定
	e.Use(echoMiddleware.LoggerWithConfig(echoMiddleware.LoggerConfig{
		Skipper: func(c echo.Context) bool {
			return c.Path() == healthCheckPath
		},
	}))

	e.Use(echoMiddleware.Recover())
	// CORS設定（環境に応じて動的設定）
	allowOrigins := []string{"http://localhost:3003"} // 開発環境用
	if os.Getenv("GO_ENV") == "production" {
		// 本番環境用のオリジンを設定
		frontendURL := os.Getenv("FRONTEND_URL")
		if frontendURL != "" {
			allowOrigins = []string{frontendURL}
		} else {
			// デフォルトの本番環境用設定
			// allowOrigins = []string{"https://*.onrender.com"}
			// 本番環境ではFRONTEND_URLが必須です。設定されていない場合は安全のためにアプリケーションを停止します。
			log.Fatal("FRONTEND_URL environment variable must be set in production")
		}
	}
	
	e.Use(echoMiddleware.CORSWithConfig(echoMiddleware.CORSConfig{
		AllowOrigins:     allowOrigins,
		AllowCredentials: true,
		AllowMethods:     []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Content-Type", "Authorization"},
	}))

	// コンテキストにEntクライアントを設定
	e.Use(func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			c.Set("db", client)
			return next(c)
		}
	})

	// ハンドラー初期化
	authHandler := handlers.NewAuthHandler()
	chatRoomHandler := handlers.NewChatRoomHandler(client)
	messageHandler := handlers.NewMessageHandler(client)

	// ルーティング設定
	// ヘルスチェック
	e.GET(healthCheckPath, healthCheck)

	// 認証関連のエンドポイント（JWT認証不要）
	authGroup := e.Group("/auth")
	authGroup.POST("/register", authHandler.Register)
	authGroup.POST("/login", authHandler.Login)
	authGroup.POST("/logout", authHandler.Logout)
	authGroup.POST("/refresh", authHandler.RefreshToken)

	// 認証が必要なエンドポイント
	protectedGroup := e.Group("/api")
	protectedGroup.Use(middleware.JWTAuth())
	
	// ユーザー関連
	protectedGroup.GET("/profile", authHandler.Profile)
	protectedGroup.PUT("/profile", authHandler.UpdateProfile)
	protectedGroup.GET("/users/search", authHandler.SearchUsers)
	protectedGroup.POST("/avatar/upload", authHandler.UploadAvatar)

	// チャットルーム関連
	protectedGroup.POST("/chatrooms", chatRoomHandler.CreateChatRoom)
	protectedGroup.GET("/chatrooms", chatRoomHandler.GetChatRooms)
	protectedGroup.GET("/chatrooms/:id", chatRoomHandler.GetChatRoom)
	protectedGroup.PUT("/chatrooms/:id", chatRoomHandler.UpdateChatRoom)
	protectedGroup.POST("/chatrooms/:id/members", chatRoomHandler.AddMember)
	protectedGroup.DELETE("/chatrooms/:id/members/:user_id", chatRoomHandler.RemoveMember)

	// メッセージ関連
	protectedGroup.POST("/chatrooms/:room_id/messages", messageHandler.SendMessage)
	protectedGroup.GET("/chatrooms/:room_id/messages", messageHandler.GetMessages)
	protectedGroup.GET("/messages/:id", messageHandler.GetMessage)
	protectedGroup.PUT("/messages/:id", messageHandler.UpdateMessage)
	protectedGroup.DELETE("/messages/:id", messageHandler.DeleteMessage)

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
