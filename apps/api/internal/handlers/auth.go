package handlers

import (
	"context"
	"net/http"
	"os"
	"time"

	"github.com/google/uuid"
	"github.com/hideaki1979/cc-chat-app/apps/api/ent"
	"github.com/hideaki1979/cc-chat-app/apps/api/ent/user"
	"github.com/hideaki1979/cc-chat-app/apps/api/internal/auth"
	"github.com/hideaki1979/cc-chat-app/apps/api/internal/middleware"
	"github.com/hideaki1979/cc-chat-app/apps/api/internal/models"
	"github.com/labstack/echo/v4"
)

// AuthHandler 認証関連のハンドラー構造体
type AuthHandler struct{}

// NewAuthHandler 新しいAuthHandlerインスタンスを作成
func NewAuthHandler() *AuthHandler {
	return &AuthHandler{}
}

// Register ユーザー登録ハンドラー
func (h *AuthHandler) Register(c echo.Context) error {
	// リクエストのバリデーション
	var req models.RegisterRequest
	if err := middleware.ValidateRequest(c, &req); err != nil {
		return err // エラーレスポンスは既にValidateRequest内で送信済み
	}

	// データベースクライアント取得
	client := c.Get("db").(*ent.Client)
	ctx := c.Request().Context()

	// メールアドレスの重複チェック
	existingUser, err := client.User.Query().
		Where(user.Email(req.Email)).
		Only(ctx)
	if err != nil {
		// ent.NotFoundError以外のエラーの場合はサーバーエラーを返す
		if !ent.IsNotFound(err) {
			return c.JSON(http.StatusInternalServerError, models.ErrorResponse{
				Message: "Database Error",
				Code:    "DATABASE_ERROR",
			})
		}
		// NotFoundErrorの場合は続行（新規ユーザー）
	} else if existingUser != nil {
		return c.JSON(http.StatusConflict, models.ErrorResponse{
			Message: "Email already registered",
			Code:    "EMAIL_EXISTS",
		})
	}

	// パスワードハッシュ化
	hashedPassword, err := auth.HashPassword(req.Password)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, models.ErrorResponse{
			Message: "Failed to process password",
			Code:    "HASH_ERROR",
		})
	}

	// 新しいユーザーを作成（IDは自動生成）
	newUser, err := client.User.Create().
		SetName(req.Name).
		SetEmail(req.Email).
		SetPasswordHash(hashedPassword).
		Save(ctx)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, models.ErrorResponse{
			Message: "Failed to create user",
			Code:    "CREATE_USER_ERROR",
		})
	}

	// JWTトークン生成
	token, err := auth.GenerateJWT(newUser.ID.String(), newUser.Email)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, models.ErrorResponse{
			Message: "Failed to generate token",
			Code:    "TOKEN_ERROR",
		})
	}

	// リフレッシュトークン生成
	refreshToken, err := auth.GenerateRefreshToken()
	if err != nil {
		return c.JSON(http.StatusInternalServerError, models.ErrorResponse{
			Message: "Failed to generate refresh token",
			Code:    "REFRESH_TOKEN_ERROR",
		})
	}

	// データベースにリフレッシュトークンを保存
	refreshTokenExpiry := auth.GetRefreshTokenExpiry()
	newUser, err = client.User.UpdateOne(newUser).
		SetNillableRefreshToken(&refreshToken).
		SetNillableRefreshTokenExpiresAt(&refreshTokenExpiry).
		Save(ctx)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, models.ErrorResponse{
			Message: "Failed to save refresh token",
			Code:    "REFRESH_TOKEN_SAVE_ERROR",
		})
	}

	// リフレッシュトークンをhttpOnly Cookieに設定
	cookie := &http.Cookie{
		Name:     "refresh_token",
		Value:    refreshToken,
		Path:     "/",
		MaxAge:   7 * 24 * 60 * 60,                    // 7日間（秒単位）
		HttpOnly: true,                                // XSS攻撃を防ぐ
		Secure:   os.Getenv("GO_ENV") == "production", // 本番環境のみHTTPS必須
		SameSite: http.SameSiteLaxMode,                // 開発環境でのクロスサイト許可
	}
	c.SetCookie(cookie)

	// レスポンス作成（refresh_tokenはCookieに保存されるのでレスポンスに含めない）
	response := models.AuthResponse{
		Token: token, // access_tokenのみレスポンスに含める
		User: models.UserInfo{
			ID:              newUser.ID.String(),
			Name:            newUser.Name,
			Email:           newUser.Email,
			ProfileImageURL: newUser.ProfileImageURL,
			Bio:             newUser.Bio,
			CreatedAt:       newUser.CreatedAt,
			UpdatedAt:       newUser.UpdatedAt,
		},
	}

	return c.JSON(http.StatusCreated, response)
}

// Login ユーザーログインハンドラー
func (h *AuthHandler) Login(c echo.Context) error {
	// リクエストのバリデーション
	var req models.LoginRequest
	if err := middleware.ValidateRequest(c, &req); err != nil {
		return err // エラーレスポンスは既にValidateRequest内で送信済み
	}

	// データベースクライアント取得
	client := c.Get("db").(*ent.Client)
	ctx := context.Background()

	// ユーザーをメールアドレスで検索
	existingUser, err := client.User.Query().
		Where(user.Email(req.Email)).
		Only(ctx)
	if err != nil {
		if !ent.IsNotFound(err) {
			return c.JSON(http.StatusInternalServerError, models.ErrorResponse{
				Message: "Database Error",
				Code:    "DATABASE_ERROR",
			})
		}
		return c.JSON(http.StatusUnauthorized, models.ErrorResponse{
			Message: "Invalid email or password",
			Code:    "INVALID_CREDENTIALS",
		})
	}

	// パスワード検証
	if err := auth.CheckPassword(req.Password, existingUser.PasswordHash); err != nil {
		return c.JSON(http.StatusUnauthorized, models.ErrorResponse{
			Message: "Invalid email or password",
			Code:    "INVALID_CREDENTIALS",
		})
	}

	// JWTトークン生成
	token, err := auth.GenerateJWT(existingUser.ID.String(), existingUser.Email)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, models.ErrorResponse{
			Message: "Failed to generate token",
			Code:    "TOKEN_ERROR",
		})
	}

	// リフレッシュトークン生成
	refreshToken, err := auth.GenerateRefreshToken()
	if err != nil {
		return c.JSON(http.StatusInternalServerError, models.ErrorResponse{
			Message: "Failed to generate refresh token",
			Code:    "REFRESH_TOKEN_ERROR",
		})
	}

	// データベースにリフレッシュトークンを保存
	refreshTokenExpiry := auth.GetRefreshTokenExpiry()
	existingUser, err = client.User.UpdateOne(existingUser).
		SetNillableRefreshToken(&refreshToken).
		SetNillableRefreshTokenExpiresAt(&refreshTokenExpiry).
		Save(ctx)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, models.ErrorResponse{
			Message: "Failed to save refresh token",
			Code:    "REFRESH_TOKEN_SAVE_ERROR",
		})
	}

	// リフレッシュトークンをhttpOnly Cookieに設定
	cookie := &http.Cookie{
		Name:     "refresh_token",
		Value:    refreshToken,
		Path:     "/",
		MaxAge:   7 * 24 * 60 * 60,                 // 7日間（秒単位）
		HttpOnly: true,                             // XSS攻撃を防ぐ
		Secure:   os.Getenv("ENV") == "production", // 本番環境のみHTTPS必須
		SameSite: http.SameSiteLaxMode,             // 開発環境でのクロスサイト許可
	}
	c.SetCookie(cookie)

	// レスポンス作成（refresh_tokenはCookieに保存されるのでレスポンスに含めない）
	response := models.AuthResponse{
		Token: token, // access_tokenのみレスポンスに含める
		User: models.UserInfo{
			ID:              existingUser.ID.String(),
			Name:            existingUser.Name,
			Email:           existingUser.Email,
			ProfileImageURL: existingUser.ProfileImageURL,
			Bio:             existingUser.Bio,
			CreatedAt:       existingUser.CreatedAt,
			UpdatedAt:       existingUser.UpdatedAt,
		},
	}

	return c.JSON(http.StatusOK, response)
}

// Logout ユーザーログアウトハンドラー
func (h *AuthHandler) Logout(c echo.Context) error {
	// データベースクライアント取得
	client := c.Get("db").(*ent.Client)
	ctx := context.Background()

	// Cookieからリフレッシュトークンを取得してDBから削除
	cookie, err := c.Cookie("refresh_token")
	if err == nil && cookie.Value != "" {
		// リフレッシュトークンに基づいてユーザーを検索し、トークンをクリア
		_, updateErr := client.User.Update().
			Where(user.RefreshTokenEQ(cookie.Value)).
			ClearRefreshToken().
			ClearRefreshTokenExpiresAt().
			Save(ctx)
		if updateErr != nil {
			// DBエラーがあってもクライアント側はクリアする
			// サーバーエラーは内部ログのみ
			// TODO: ログ出力追加
		}
	}

	// リフレッシュトークンCookieを削除
	clearCookie := &http.Cookie{
		Name:     "refresh_token",
		Value:    "",
		Path:     "/",
		MaxAge:   -1, // 即座に削除
		HttpOnly: true,
		Secure:   os.Getenv("GO_ENV") == "production",
		SameSite: http.SameSiteLaxMode,
	}
	c.SetCookie(clearCookie)

	return c.JSON(http.StatusOK, map[string]string{
		"message": "Logout successful",
	})
}

// Profile 現在のユーザー情報取得ハンドラー（JWT認証が必要）
func (h *AuthHandler) Profile(c echo.Context) error {
	// JWTミドルウェアで設定されたユーザー情報を取得
	userID, ok := c.Get("user_id").(string)
	if !ok {
		return c.JSON(http.StatusUnauthorized, models.ErrorResponse{
			Message: "User not authenticated",
			Code:    "NOT_AUTHENTICATED",
		})
	}

	// データベースクライアント取得
	client := c.Get("db").(*ent.Client)
	ctx := context.Background()

	// ユーザー情報をUUIDで検索
	userUUID, err := uuid.Parse(userID)
	if err != nil {
		return c.JSON(http.StatusBadRequest, models.ErrorResponse{
			Message: "Invalid user ID",
			Code:    "INVALID_USER_ID",
		})
	}

	existingUser, err := client.User.Query().
		Where(user.ID(userUUID)).
		Only(ctx)
	if err != nil {
		if !ent.IsNotFound(err) {
			return c.JSON(http.StatusInternalServerError, models.ErrorResponse{
				Message: "Database Error",
				Code:    "DATABASE_ERROR",
			})
		}
		return c.JSON(http.StatusNotFound, models.ErrorResponse{
			Message: "User not found",
			Code:    "USER_NOT_FOUND",
		})
	}

	// レスポンス作成
	userInfo := models.UserInfo{
		ID:              existingUser.ID.String(),
		Name:            existingUser.Name,
		Email:           existingUser.Email,
		ProfileImageURL: existingUser.ProfileImageURL,
		Bio:             existingUser.Bio,
		CreatedAt:       existingUser.CreatedAt,
		UpdatedAt:       existingUser.UpdatedAt,
	}

	return c.JSON(http.StatusOK, userInfo)
}

// RefreshToken リフレッシュトークンを使ってアクセストークンを更新
func (h *AuthHandler) RefreshToken(c echo.Context) error {
	// Cookieからリフレッシュトークンを取得
	cookie, err := c.Cookie("refresh_token")
	if err != nil {
		return c.JSON(http.StatusUnauthorized, models.ErrorResponse{
			Message: "Refresh token not found",
			Code:    "REFRESH_TOKEN_NOT_FOUND",
		})
	}

	refreshTokenValue := cookie.Value
	if refreshTokenValue == "" {
		return c.JSON(http.StatusUnauthorized, models.ErrorResponse{
			Message: "Invalid refresh token",
			Code:    "INVALID_REFRESH_TOKEN",
		})
	}

	// データベースクライアント取得
	client := c.Get("db").(*ent.Client)
	ctx := context.Background()

	// リフレッシュトークンでユーザーを検索
	existingUser, err := client.User.Query().
		Where(user.RefreshTokenEQ(refreshTokenValue)).
		Only(ctx)
	if err != nil {
		if !ent.IsNotFound(err) {
			return c.JSON(http.StatusInternalServerError, models.ErrorResponse{
				Message: "Database Error",
				Code:    "DATABASE_ERROR",
			})
		}
		return c.JSON(http.StatusUnauthorized, models.ErrorResponse{
			Message: "Invalid refresh token",
			Code:    "INVALID_REFRESH_TOKEN",
		})
	}

	// リフレッシュトークンの有効期限を確認
	if existingUser.RefreshTokenExpiresAt == nil || time.Now().After(*existingUser.RefreshTokenExpiresAt) {
		// 期限切れの場合、DBからトークンをクリア（セキュリティ強化）
		_, _ = client.User.UpdateOne(existingUser).
			ClearRefreshToken().
			ClearRefreshTokenExpiresAt().
			Save(ctx)

		return c.JSON(http.StatusUnauthorized, models.ErrorResponse{
			Message: "Refresh token expired",
			Code:    "REFRESH_TOKEN_EXPIRED",
		})
	}

	// 新しいアクセストークンを生成
	newAccessToken, err := auth.GenerateJWT(existingUser.ID.String(), existingUser.Email)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, models.ErrorResponse{
			Message: "Failed to generate access token",
			Code:    "TOKEN_ERROR",
		})
	}

	// 新しいリフレッシュトークンを生成（トークンローテーション）
	newRefreshToken, err := auth.GenerateRefreshToken()
	if err != nil {
		return c.JSON(http.StatusInternalServerError, models.ErrorResponse{
			Message: "Failed to generate refresh token",
			Code:    "REFRESH_TOKEN_ERROR",
		})
	}

	// データベースのリフレッシュトークンを更新
	refreshTokenExpiry := auth.GetRefreshTokenExpiry()
	_, err = client.User.UpdateOne(existingUser).
		SetNillableRefreshToken(&newRefreshToken).
		SetNillableRefreshTokenExpiresAt(&refreshTokenExpiry).
		Save(ctx)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, models.ErrorResponse{
			Message: "Failed to update refresh token",
			Code:    "UPDATE_ERROR",
		})
	}

	// 新しいリフレッシュトークンをhttpOnly Cookieに設定
	newCookie := &http.Cookie{
		Name:     "refresh_token",
		Value:    newRefreshToken,
		Path:     "/",
		MaxAge:   7 * 24 * 60 * 60,                 // 7日間（秒単位）
		HttpOnly: true,                             // XSS攻撃を防ぐ
		Secure:   os.Getenv("ENV") == "production", // 本番環境のみHTTPS必須
		SameSite: http.SameSiteLaxMode,             // 開発環境でのクロスサイト許可
	}
	c.SetCookie(newCookie)

	// レスポンス作成（access_tokenのみ、refresh_tokenはCookieに保存）
	response := models.RefreshTokenResponse{
		Token: newAccessToken, // access_tokenのみレスポンスに含める
	}

	return c.JSON(http.StatusOK, response)
}
