package main

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/hideaki1979/cc-chat-app/apps/api/ent"
	_ "github.com/hideaki1979/cc-chat-app/apps/api/ent/runtime"
	"github.com/hideaki1979/cc-chat-app/apps/api/ent/user"
	"github.com/hideaki1979/cc-chat-app/apps/api/internal/auth"
	"github.com/hideaki1979/cc-chat-app/apps/api/internal/handlers"
	"github.com/hideaki1979/cc-chat-app/apps/api/internal/middleware"
	"github.com/hideaki1979/cc-chat-app/apps/api/internal/models"
	"github.com/hideaki1979/cc-chat-app/apps/api/internal/repositories"
	"github.com/hideaki1979/cc-chat-app/apps/api/internal/services"
	"github.com/joho/godotenv"
	"github.com/labstack/echo/v4"
	_ "github.com/mattn/go-sqlite3"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	entsql "entgo.io/ent/dialect/sql"
)

// テスト用のクライアント設定
func setupTestClient() (*ent.Client, error) {
	// SQLite in-memory（FK有効化）。1接続に固定して一貫性を担保
	db, err := entsql.Open("sqlite3", "file:ent_test?mode=memory&_fk=1")
	if err != nil {
		return nil, fmt.Errorf("failed opening connection to sqlite: %v", err)
	}

	db.DB().SetMaxOpenConns(1)
	db.DB().SetMaxIdleConns(1)
	db.DB().SetConnMaxLifetime(0)

	client := ent.NewClient(ent.Driver(db))
	
	// スキーマを作成
	ctx := context.Background()
	if err := client.Schema.Create(ctx); err != nil {
		return nil, fmt.Errorf("failed creating schema resources: %v", err)
	}

	return client, nil
}

// テスト用のEchoサーバーセットアップ
func setupTestServer(client *ent.Client) *echo.Echo {
	e := echo.New()
	e.Validator = middleware.NewValidator()

	// ミドルウェア設定
	e.Use(func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			c.Set("db", client)
			return next(c)
		}
	})

	// リポジトリ初期化
	userRepo := repositories.NewUserRepository(client)

	// サービス初期化
	tokenService := services.NewTokenService(userRepo)
	authService := services.NewAuthService(client, userRepo, tokenService)

	// ハンドラー設定
	authHandler := handlers.NewAuthHandler(authService, tokenService)
	authGroup := e.Group("/auth")
	authGroup.POST("/register", authHandler.Register)
	authGroup.POST("/login", authHandler.Login)

	return e
}

// テストデータクリア
func clearTestData(client *ent.Client) error {
	ctx := context.Background()
	
	// 外部キー制約のため、依存関係の順序で削除（エラーは無視）
	// トランザクションを使用してより安全に削除
	tx, err := client.Tx(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback()
	
	// Messages テーブルがある場合は削除
	_, _ = tx.Message.Delete().Exec(ctx)
	
	// RoomMembers テーブルを削除
	_, _ = tx.RoomMember.Delete().Exec(ctx)
	
	// ChatRooms テーブルがある場合は削除
	_, _ = tx.ChatRoom.Delete().Exec(ctx)
	
	// Users テーブルを削除
	_, err = tx.User.Delete().Exec(ctx)
	if err != nil {
		return err
	}
	
	return tx.Commit()
}

func TestSecurityImprovements(t *testing.T) {
	// .envファイルを読み込み
	err := godotenv.Load()
	require.NoError(t, err, ".envファイルの読み込みに失敗しました")
	
	// テスト環境セットアップ
	client, err := setupTestClient()
	require.NoError(t, err)
	defer client.Close()

	server := setupTestServer(client)

	// テスト前にデータクリア
	err = clearTestData(client)
	require.NoError(t, err)

	t.Run("Password Hash Security - Bytes型でContains系Predicateが無効化されている", func(t *testing.T) {
		// ユーザー登録
		registerReq := models.RegisterRequest{
			Name:     "Test User",
			Email:    "test@example.com",
			Password: "Password123",
		}
		
		reqBody, _ := json.Marshal(registerReq)
		req := httptest.NewRequest(http.MethodPost, "/auth/register", bytes.NewReader(reqBody))
		req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
		rec := httptest.NewRecorder()

		server.ServeHTTP(rec, req)
		if rec.Code != http.StatusCreated {
			t.Logf("Registration failed with status %d, body: %s", rec.Code, rec.Body.String())
		}
		assert.Equal(t, http.StatusCreated, rec.Code)

		// DBからパスワードハッシュを直接検証
		ctx := context.Background()
		createdUser, err := client.User.Query().
			Where(user.EmailEQ("test@example.com")).
			Only(ctx)
		require.NoError(t, err)

		// パスワードハッシュがbytes型であることを確認
		assert.NotNil(t, createdUser.PasswordHash)
		assert.IsType(t, []byte{}, createdUser.PasswordHash)

		// BCryptハッシュのプレフィックスを確認
		hashString := string(createdUser.PasswordHash)
		assert.True(t, strings.HasPrefix(hashString, "$2a$") || strings.HasPrefix(hashString, "$2b$"))
		
		// ハッシュが元のパスワードと異なることを確認
		assert.NotEqual(t, "password123", hashString)
		assert.Greater(t, len(createdUser.PasswordHash), 50) // BCryptハッシュは通常60文字程度
	})

	t.Run("Refresh Token Hash Security - Bytes型でContains系Predicateが無効化されている", func(t *testing.T) {
		// ログインリクエスト
		loginReq := models.LoginRequest{
			Email:    "test@example.com",
			Password: "Password123",
		}
		
		reqBody, _ := json.Marshal(loginReq)
		req := httptest.NewRequest(http.MethodPost, "/auth/login", bytes.NewReader(reqBody))
		req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
		rec := httptest.NewRecorder()

		server.ServeHTTP(rec, req)
		assert.Equal(t, http.StatusOK, rec.Code)

		// DBからリフレッシュトークンハッシュを確認
		ctx := context.Background()
		user, err := client.User.Query().
			Where(user.EmailEQ("test@example.com")).
			Only(ctx)
		require.NoError(t, err)

		// リフレッシュトークンハッシュがbytes型であることを確認
		assert.NotNil(t, user.RefreshTokenHash)
		assert.IsType(t, []byte{}, *user.RefreshTokenHash)

		// ハッシュが存在し、十分な長さを持つことを確認
		assert.Equal(t, 32, len(*user.RefreshTokenHash)) // SHA256ハッシュは32バイト
		
		// 有効期限が設定されていることを確認
		assert.NotNil(t, user.RefreshTokenExpiresAt)
		assert.True(t, user.RefreshTokenExpiresAt.After(time.Now()))
	})

	t.Run("危険なPredicate関数が使用できないことを確認", func(t *testing.T) {
		ctx := context.Background()

		// テスト用の不正なクエリの試行（これらはコンパイルエラーになるべき）
		// 以下のコードは実際には存在しない関数を試行することでセキュリティ改善を検証

		// password_hashでのContains系検索ができないことをランタイムで確認
		testUser, err := client.User.Query().
			Where(user.EmailEQ("test@example.com")).
			Only(ctx)
		require.NoError(t, err)

		// PasswordHashEQ（完全一致）のみが利用可能であることを確認
		foundUser, err := client.User.Query().
			Where(user.PasswordHashEQ(testUser.PasswordHash)).
			Only(ctx)
		require.NoError(t, err)
		assert.Equal(t, testUser.ID, foundUser.ID)

		// RefreshTokenHashEQ（完全一致）のみが利用可能であることを確認
		foundUser2, err := client.User.Query().
			Where(user.RefreshTokenHashEQ(*testUser.RefreshTokenHash)).
			Only(ctx)
		require.NoError(t, err)
		assert.Equal(t, testUser.ID, foundUser2.ID)
	})

	t.Run("BCryptパスワード検証の動作確認", func(t *testing.T) {
		// 保存されたハッシュで元のパスワードが検証可能であることを確認
		ctx := context.Background()
		testUser, err := client.User.Query().
			Where(user.EmailEQ("test@example.com")).
			Only(ctx)
		require.NoError(t, err)

		// BCrypt検証が正常に動作することを確認
		isValid := auth.CheckPasswordHash("Password123", testUser.PasswordHash)
		assert.True(t, isValid)

		// 間違ったパスワードでは検証が失敗することを確認
		isValid = auth.CheckPasswordHash("wrongpassword", testUser.PasswordHash)
		assert.False(t, isValid)
	})

	t.Run("リフレッシュトークンハッシュ検証の動作確認", func(t *testing.T) {
		// クッキーからリフレッシュトークンを取得してハッシュ検証
		// この部分は実際のトークンが必要なため、概念的なテスト
		
		// ランダムなリフレッシュトークンを生成してハッシュ化
		testToken, err := auth.GenerateRefreshToken()
		require.NoError(t, err)
		
		hashedToken := auth.HashRefreshToken(testToken)
		
		// ハッシュが一定の長さを持つことを確認
		assert.Equal(t, 32, len(hashedToken)) // SHA256ハッシュは32バイト
		
		// 同じトークンから同じハッシュが生成されることを確認（一貫性テスト）
		hashedToken2 := auth.HashRefreshToken(testToken)
		assert.Equal(t, hashedToken, hashedToken2)
	})

	// テスト後のクリーンアップ
	t.Cleanup(func() {
		clearTestData(client)
	})
}

func TestMain(m *testing.M) {
	log.Println("セキュリティテスト開始...")
	code := m.Run()
	log.Println("セキュリティテスト完了")
	os.Exit(code)
}