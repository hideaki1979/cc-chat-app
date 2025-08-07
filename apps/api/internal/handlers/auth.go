package handlers

import (
	"context"
	"net/http"

	"github.com/google/uuid"
	"github.com/hideaki1979/cc-chat-app/apps/api/ent"
	"github.com/hideaki1979/cc-chat-app/apps/api/ent/user"
	"github.com/hideaki1979/cc-chat-app/apps/api/internal/auth"
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
	// リクエストボディをパース
	var req models.RegisterRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, models.ErrorResponse{
			Message: "Invalid request format",
			Code:    "INVALID_REQUEST",
		})
	}

	// バリデーション（簡易版）
	if req.Name == "" || req.Email == "" || req.Password == "" {
		return c.JSON(http.StatusBadRequest, models.ErrorResponse{
			Message: "Name, email, and password are required",
			Code:    "MISSING_FIELDS",
		})
	}

	if len(req.Password) < 8 {
		return c.JSON(http.StatusBadRequest, models.ErrorResponse{
			Message: "Password must be at least 8 characters",
			Code:    "WEAK_PASSWORD",
		})
	}

	// データベースクライアント取得
	client := c.Get("db").(*ent.Client)
	ctx := context.Background()

	// メールアドレスの重複チェック
	existingUser, err := client.User.Query().
		Where(user.Email(req.Email)).
		Only(ctx)
	if err != nil {
		// ent.NotFoundError以外のエラーの場合はサーバーエラーを返す
		if !ent.IsNotFound(err) {
			return c.JSON(http.StatusInternalServerError, models.ErrorResponse{
				Message: "Database Error",
				Code: "DATABASE_ERROR",
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

	// 新しいユーザーを作成
	newUser, err := client.User.Create().
		SetID(uuid.New()).
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

	// レスポンス作成
	response := models.AuthResponse{
		Token: token,
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
	// リクエストボディをパース
	var req models.LoginRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, models.ErrorResponse{
			Message: "Invalid request format",
			Code:    "INVALID_REQUEST",
		})
	}

	// バリデーション
	if req.Email == "" || req.Password == "" {
		return c.JSON(http.StatusBadRequest, models.ErrorResponse{
			Message: "Email and password are required",
			Code:    "MISSING_FIELDS",
		})
	}

	// データベースクライアント取得
	client := c.Get("db").(*ent.Client)
	ctx := context.Background()

	// ユーザーをメールアドレスで検索
	existingUser, err := client.User.Query().
		Where(user.Email(req.Email)).
		Only(ctx)
		if err != nil {
			// ent.NotFoundError以外のエラーの場合はサーバーエラーを返す
			if !ent.IsNotFound(err) {
				return c.JSON(http.StatusInternalServerError, models.ErrorResponse{
					Message: "Database Error",
					Code: "DATABASE_ERROR",
				})
			}
		// NotFoundErrorの場合は続行（新規ユーザー）
		} else if existingUser != nil {
			return c.JSON(http.StatusConflict, models.ErrorResponse{
				Message: "Email already registered",
				Code:    "EMAIL_EXISTS",
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

	// レスポンス作成
	response := models.AuthResponse{
		Token: token,
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

// Logout ユーザーログアウトハンドラー（JWTの場合は主にクライアント側でトークンを削除）
func (h *AuthHandler) Logout(c echo.Context) error {
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