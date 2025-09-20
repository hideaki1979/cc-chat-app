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
	"github.com/hideaki1979/cc-chat-app/apps/api/internal/repositories"
	"github.com/hideaki1979/cc-chat-app/apps/api/internal/services"
	"github.com/hideaki1979/cc-chat-app/apps/api/internal/websocket"
	"github.com/joho/godotenv"
	"github.com/labstack/echo/v4"
	echoMiddleware "github.com/labstack/echo/v4/middleware"
	_ "github.com/lib/pq"
)

const (
	defaultPort     = "8080"
	portEnvKey      = "PORT"
	healthCheckPath = "/health"
	databaseURLKey  = "DATABASE_URL"
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
		AllowHeaders:     []string{"Content-Type", "Authorization", "X-CSRF-Token"},
	}))

	// コンテキストにEntクライアントを設定
	e.Use(func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			c.Set("db", client)
			return next(c)
		}
	})

	// WebSocketハブ初期化
	hub := websocket.NewHub()
	go hub.Run()

	// リポジトリ初期化
	userRepo := repositories.NewUserRepository(client)

	// サービス初期化
	tokenService := services.NewTokenService(userRepo)
	authService := services.NewAuthService(client, userRepo, tokenService)

	// S3設定とクライアント初期化
	s3Config := services.NewS3Config()
	s3Client, err := services.NewS3Client(context.Background(), s3Config)
	if err != nil {
		log.Printf("Warning: Failed to initialize S3 client: %v", err)
		// S3が利用できない場合でもアプリケーションは継続
	}

	// ハンドラー初期化
	authHandler := handlers.NewAuthHandler(authService, tokenService)
	profileHandler := handlers.NewProfileHandler()
	userHandler := handlers.NewUserHandler()
	chatRoomHandler := handlers.NewChatRoomHandler(client)
	messageHandler := handlers.NewMessageHandler(client, hub)
	wsHandler := handlers.NewWebSocketHandler(hub)

	var fileHandler *handlers.FileHandler
	if s3Client != nil {
		fileHandler = handlers.NewFileHandler(s3Client, s3Config.Bucket)
	}

	// ルーティング設定
	// ヘルスチェック
	e.GET(healthCheckPath, healthCheck)

	e.GET("/", func(c echo.Context) error {
		return c.String(http.StatusOK, "Hello, world!")
	})

	// 認証関連のエンドポイント（JWT認証不要）
	authGroup := e.Group("/auth")
	authGroup.POST("/register", authHandler.Register)
	authGroup.POST("/login", authHandler.Login)
	authGroup.POST("/logout", authHandler.Logout)
	authGroup.POST("/refresh", middleware.CSRFProtection()(authHandler.RefreshToken))

	// CSRFトークン取得エンドポイント（認証不要）
	e.GET("/csrf", func(c echo.Context) error {
		token, err := middleware.GenerateCSRFToken()
		if err != nil {
			return c.JSON(http.StatusInternalServerError, map[string]string{
				"message": "Failed to generate CSRF token",
			})
		}
		middleware.SetCSRFTokenCookie(c, token)
		return c.JSON(http.StatusOK, map[string]string{
			"csrf_token": token,
		})
	})

	// 認証が必要なエンドポイント
	protectedGroup := e.Group("/api")
	protectedGroup.Use(middleware.JWTAuth())
	protectedGroup.Use(middleware.CSRFProtection())

	// プロフィール関連
	protectedGroup.GET("/profile", profileHandler.GetProfile)
	protectedGroup.PUT("/profile", profileHandler.UpdateProfile)
	protectedGroup.POST("/avatar/upload", profileHandler.UploadAvatar)

	// ユーザー関連
	protectedGroup.GET("/users/search", userHandler.SearchUsers)

	// チャットルーム関連
	protectedGroup.POST("/chatrooms", chatRoomHandler.CreateChatRoom)
	protectedGroup.POST("/chatrooms/dm", chatRoomHandler.CreateDMRoom)
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

	// メッセージ拡張機能（既読・リアクション）
	protectedGroup.POST("/messages/:id/read", messageHandler.MarkAsRead)
	protectedGroup.GET("/messages/:id/reads", messageHandler.GetMessageReads)
	protectedGroup.POST("/messages/:id/reactions", messageHandler.AddReaction)
	protectedGroup.DELETE("/messages/:id/reactions/:emoji", messageHandler.RemoveReaction)
	protectedGroup.GET("/messages/:id/reactions", messageHandler.GetMessageReactions)
	protectedGroup.GET("/messages/:id/reactions/summary", messageHandler.GetMessageReactionsSummary)

	// ファイル関連（S3が利用可能な場合のみ）
	if fileHandler != nil {
		protectedGroup.POST("/files/upload", fileHandler.UploadFile)
		protectedGroup.GET("/files/presigned-url/:key", fileHandler.GetPresignedURL)
		protectedGroup.DELETE("/files/:key", fileHandler.DeleteFile)
	}

	// WebSocket関連（CSRFは適用しない）
	wsGroup := e.Group("/api")
	wsGroup.Use(middleware.JWTAuth())
	wsGroup.GET("/ws", wsHandler.HandleWebSocket)

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
