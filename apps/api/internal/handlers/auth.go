package handlers

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/hideaki1979/cc-chat-app/apps/api/ent"
	"github.com/hideaki1979/cc-chat-app/apps/api/ent/user"
	"github.com/hideaki1979/cc-chat-app/apps/api/internal/auth"
	"github.com/hideaki1979/cc-chat-app/apps/api/internal/middleware"
	"github.com/hideaki1979/cc-chat-app/apps/api/internal/models"
	"github.com/hideaki1979/cc-chat-app/apps/api/util"
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
		c.Logger().Errorf("validation error: %v", err)
		if c.Response().Committed {
			return nil
		}
		return err // エラーレスポンスは既にValidateRequest内で送信済み
	}

	// データベースクライアント取得
	client := c.Get("db").(*ent.Client)
	ctx := c.Request().Context()

	// メールアドレスの重複チェック（大文字小文字を区別しない）
	existingUser, err := client.User.Query().
		Where(user.EmailEqualFold(req.Email)).
		Only(ctx)
	if err != nil {
		// ent.NotFoundError以外のエラーの場合はサーバーエラーを返す
		if !ent.IsNotFound(err) {
			c.Logger().Errorf("query user error: %v", err)
			return c.JSON(http.StatusInternalServerError, models.ErrorResponse{
				Message: "DBエラーが発生しました",
				Code:    "DATABASE_ERROR",
			})
		}
		// NotFoundErrorの場合は続行（新規ユーザー）
	} else if existingUser != nil {
		return c.JSON(http.StatusConflict, models.ErrorResponse{
			Message: "このメールアドレスは既に使用されています",
			Code:    "EMAIL_EXISTS",
		})
	}

	// パスワードハッシュ化
	hashedPassword, err := auth.HashPassword(req.Password)
	if err != nil {
		c.Logger().Errorf("hash password error: %v", err)
		return c.JSON(http.StatusInternalServerError, models.ErrorResponse{
			Message: "パスワードの処理中にエラーが発生しました",
			Code:    "HASH_ERROR",
		})
	}

	// リフレッシュトークン生成
	refreshToken, err := auth.GenerateRefreshToken()
	if err != nil {
		c.Logger().Errorf("generate refresh token error: %v", err)
		return c.JSON(http.StatusInternalServerError, models.ErrorResponse{
			Message: "リフレッシュトークンの生成中にエラーが発生しました",
			Code:    "REFRESH_TOKEN_ERROR",
		})
	}

	// リフレッシュトークンをハッシュ化してDB保存用に準備
	hashedRefreshToken := auth.HashRefreshToken(refreshToken)
	refreshTokenExpiry := auth.GetRefreshTokenExpiry()

	// 新しいユーザーを作成（IDは自動生成）
	newUser, err := client.User.Create().
		SetName(req.Name).
		SetEmail(req.Email).
		SetPasswordHash(hashedPassword).
		SetRefreshTokenHash(hashedRefreshToken).
		SetRefreshTokenExpiresAt(refreshTokenExpiry).
		Save(ctx)
	if err != nil {
		c.Logger().Errorf("create user error: %v", err)
		return c.JSON(http.StatusInternalServerError, models.ErrorResponse{
			Message: "ユーザーの作成中にエラーが発生しました",
			Code:    "CREATE_USER_ERROR",
		})
	}

	// JWTトークン生成
	token, err := auth.GenerateJWT(newUser.ID.String(), newUser.Email)
	if err != nil {
		c.Logger().Errorf("generate jwt error: %v", err)
		return c.JSON(http.StatusInternalServerError, models.ErrorResponse{
			Message: "JWTトークンの生成中にエラーが発生しました",
			Code:    "JWT_TOKEN_ERROR",
		})
	}

	// リフレッシュトークンをhttpOnly Cookieに設定(平文のtokenを使用)
	cookie := &http.Cookie{
		Name:     "refresh_token",
		Value:    refreshToken,
		Path:     "/",
		MaxAge:   int(7 * 24 * time.Hour.Seconds()), // 7日間（秒単位）
		HttpOnly: true,                              // XSS攻撃を防ぐ
		Secure:   util.IsProduction(),               // 本番環境のみHTTPS必須
		SameSite: http.SameSiteLaxMode,              // 開発環境でのクロスサイト許可
	}
	c.SetCookie(cookie)

	// レスポンス作成（refresh_tokenはCookieに保存されるのでレスポンスに含めない）
	return c.JSON(http.StatusCreated, models.AuthResponse{
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
	})
}

// Login ユーザーログインハンドラー
func (h *AuthHandler) Login(c echo.Context) error {
	// リクエストのバリデーション
	var req models.LoginRequest
	if err := middleware.ValidateRequest(c, &req); err != nil {
		if c.Response().Committed {
			return nil
		}
		return err // エラーレスポンスは既にValidateRequest内で送信済み
	}

	// データベースクライアント取得
	client := c.Get("db").(*ent.Client)
	ctx := context.Background()

	// ユーザーをメールアドレスで検索（大文字小文字を区別しない）
	existingUser, err := client.User.Query().
		Where(user.EmailEqualFold(req.Email)).
		Only(ctx)
	if err != nil {
		if !ent.IsNotFound(err) {
			return c.JSON(http.StatusInternalServerError, models.ErrorResponse{
				Message: "DBエラーが発生しました",
				Code:    "DATABASE_ERROR",
			})
		}
		return c.JSON(http.StatusUnauthorized, models.ErrorResponse{
			Message: "メールアドレスまたはパスワードに誤りがあります",
			Code:    "INVALID_CREDENTIALS",
		})
	}

	// パスワード検証
	if !auth.CheckPasswordHash(req.Password, existingUser.PasswordHash) {
		return c.JSON(http.StatusUnauthorized, models.ErrorResponse{
			Message: "メールアドレスまたはパスワードに誤りがあります",
			Code:    "INVALID_CREDENTIALS",
		})
	}

	// JWTトークン生成
	token, err := auth.GenerateJWT(existingUser.ID.String(), existingUser.Email)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, models.ErrorResponse{
			Message: "JWTトークンの生成中にエラーが発生しました",
			Code:    "TOKEN_ERROR",
		})
	}

	// リフレッシュトークン生成
	refreshToken, err := auth.GenerateRefreshToken()
	if err != nil {
		return c.JSON(http.StatusInternalServerError, models.ErrorResponse{
			Message: "リフレッシュトークンの生成中にエラーが発生しました",
			Code:    "REFRESH_TOKEN_ERROR",
		})
	}

	// データベースにリフレッシュトークンを保存
	// リフレッシュトークンをハッシュ化してDB更新
	hashedRefreshToken := auth.HashRefreshToken(refreshToken)
	refreshTokenExpiry := auth.GetRefreshTokenExpiry()
	_, err = client.User.UpdateOne(existingUser).
		SetRefreshTokenHash(hashedRefreshToken).
		SetRefreshTokenExpiresAt(refreshTokenExpiry).
		Save(ctx)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, models.ErrorResponse{
			Message: "リフレッシュトークンの保存に失敗しました",
			Code:    "REFRESH_TOKEN_SAVE_ERROR",
		})
	}

	// リフレッシュトークンをhttpOnly Cookieに設定
	cookie := &http.Cookie{
		Name:     "refresh_token",
		Value:    refreshToken,
		Path:     "/",
		MaxAge:   int(7 * 24 * time.Hour.Seconds()), // 7日間（秒単位）
		HttpOnly: true,                              // XSS攻撃を防ぐ
		Secure:   util.IsProduction(),               // 本番環境のみHTTPS必須
		SameSite: http.SameSiteLaxMode,              // 開発環境でのクロスサイト許可
	}
	c.SetCookie(cookie)

	// レスポンス作成（refresh_tokenはCookieに保存されるのでレスポンスに含めない）
	return c.JSON(http.StatusOK, models.AuthResponse{
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
	})
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
		hashedToken := auth.HashRefreshToken(cookie.Value)
		_, updateErr := client.User.Update().
			Where(user.RefreshTokenHashEQ(hashedToken)).
			ClearRefreshTokenHash().
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
		Secure:   util.IsProduction(),
		SameSite: http.SameSiteLaxMode,
	}
	c.SetCookie(clearCookie)

	return c.JSON(http.StatusOK, map[string]string{
		"message": "ログアウトしました",
	})
}

// Profile 現在のユーザー情報取得ハンドラー（JWT認証が必要）
func (h *AuthHandler) Profile(c echo.Context) error {
	// JWTミドルウェアで設定されたユーザー情報を取得
	userID, ok := c.Get("user_id").(string)
	if !ok {
		return c.JSON(http.StatusUnauthorized, models.ErrorResponse{
			Message: "認証が必要です",
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
			Message: "無効なユーザーIDです",
			Code:    "INVALID_USER_ID",
		})
	}

	existingUser, err := client.User.Query().
		Where(user.ID(userUUID)).
		Only(ctx)
	if err != nil {
		if !ent.IsNotFound(err) {
			return c.JSON(http.StatusInternalServerError, models.ErrorResponse{
				Message: "DBエラーが発生しました",
				Code:    "DATABASE_ERROR",
			})
		}
		return c.JSON(http.StatusNotFound, models.ErrorResponse{
			Message: "ユーザーが見つかりません",
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
	// Cookieからリフレッシュトークンを取得（平文）
	cookie, err := c.Cookie("refresh_token")
	if err != nil {
		return c.JSON(http.StatusUnauthorized, models.ErrorResponse{
			Message: "リフレッシュトークンが見つかりません",
			Code:    "REFRESH_TOKEN_NOT_FOUND",
		})
	}

	refreshTokenValue := strings.TrimSpace(cookie.Value)
	if refreshTokenValue == "" {
		return c.JSON(http.StatusUnauthorized, models.ErrorResponse{
			Message: "リフレッシュトークンが無効です",
			Code:    "INVALID_REFRESH_TOKEN",
		})
	}

	// リフレッシュトークンをハッシュ化
	hashedRefreshToken := auth.HashRefreshToken((refreshTokenValue))

	// データベースクライアント取得
	client := c.Get("db").(*ent.Client)
	ctx := context.Background()

	// リフレッシュトークンでユーザーを検索
	existingUser, err := client.User.Query().
		Where(user.RefreshTokenHashEQ(hashedRefreshToken)).
		Only(ctx)
	if err != nil {
		if !ent.IsNotFound(err) {
			return c.JSON(http.StatusInternalServerError, models.ErrorResponse{
				Message: "DBエラーが発生しました",
				Code:    "DATABASE_ERROR",
			})
		}
		return c.JSON(http.StatusUnauthorized, models.ErrorResponse{
			Message: "リフレッシュトークンが無効です",
			Code:    "INVALID_REFRESH_TOKEN",
		})
	}

	// リフレッシュトークンの有効期限を確認
	if existingUser.RefreshTokenExpiresAt == nil || time.Now().After(*existingUser.RefreshTokenExpiresAt) {
		// 期限切れの場合、DBからトークンをクリア（セキュリティ強化）
		_, _ = client.User.UpdateOne(existingUser).
			ClearRefreshTokenHash().
			ClearRefreshTokenExpiresAt().
			Save(ctx)

		return c.JSON(http.StatusUnauthorized, models.ErrorResponse{
			Message: "リフレッシュトークンが期限切れです",
			Code:    "REFRESH_TOKEN_EXPIRED",
		})
	}

	// 新しいアクセストークンを生成
	newAccessToken, err := auth.GenerateJWT(existingUser.ID.String(), existingUser.Email)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, models.ErrorResponse{
			Message: "新しいJWTトークンの生成中にエラーが発生しました",
			Code:    "TOKEN_ERROR",
		})
	}

	// 新しいリフレッシュトークンを生成（トークンローテーション）
	newRefreshToken, err := auth.GenerateRefreshToken()
	if err != nil {
		return c.JSON(http.StatusInternalServerError, models.ErrorResponse{
			Message: "リフレッシュトークンの生成中にエラーが発生しました",
			Code:    "REFRESH_TOKEN_ERROR",
		})
	}

	// データベースのリフレッシュトークンを更新
	// 新しいリフレッシュトークンをハッシュ化
	newHashedRefreshToken := auth.HashRefreshToken(newRefreshToken)
	refreshTokenExpiry := auth.GetRefreshTokenExpiry()
	_, err = client.User.UpdateOne(existingUser).
		SetRefreshTokenHash(newHashedRefreshToken).
		SetRefreshTokenExpiresAt(refreshTokenExpiry).
		Save(ctx)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, models.ErrorResponse{
			Message: "Failed to update refresh token",
			Code:    "UPDATE_ERROR",
		})
	}

	// 新しいリフレッシュトークンをhttpOnly Cookieに設定(平文を使用)
	newCookie := &http.Cookie{
		Name:     "refresh_token",
		Value:    newRefreshToken,
		Path:     "/",
		MaxAge:   7 * 24 * 60 * 60,     // 7日間（秒単位）
		HttpOnly: true,                 // XSS攻撃を防ぐ
		Secure:   util.IsProduction(),  // 本番環境のみHTTPS必須
		SameSite: http.SameSiteLaxMode, // 開発環境でのクロスサイト許可
	}
	c.SetCookie(newCookie)

	// レスポンス作成（access_tokenのみ、refresh_tokenはCookieに保存）
	response := models.RefreshTokenResponse{
		Token: newAccessToken, // access_tokenのみレスポンスに含める
	}

	return c.JSON(http.StatusOK, response)
}

// UpdateProfile プロフィール更新ハンドラー（JWT認証が必要）
func (h *AuthHandler) UpdateProfile(c echo.Context) error {
	// JWTミドルウェアで設定されたユーザー情報を取得
	userID, ok := c.Get("user_id").(string)
	if !ok {
		return c.JSON(http.StatusUnauthorized, models.ErrorResponse{
			Message: "認証が必要です",
			Code:    "NOT_AUTHENTICATED",
		})
	}

	// リクエストのバリデーション
	var req models.UpdateProfileRequest
	if err := middleware.ValidateRequest(c, &req); err != nil {
		if c.Response().Committed {
			return nil
		}
		return err
	}

	// データベースクライアント取得
	client := c.Get("db").(*ent.Client)
	ctx := c.Request().Context()

	// ユーザー情報をUUIDで検索
	userUUID, err := uuid.Parse(userID)
	if err != nil {
		return c.JSON(http.StatusBadRequest, models.ErrorResponse{
			Message: "無効なユーザーIDです",
			Code:    "INVALID_USER_ID",
		})
	}

	// 更新するフィールドを動的に設定
	updateQuery := client.User.UpdateOneID(userUUID)

	if req.Name != "" {
		updateQuery = updateQuery.SetName(req.Name)
	}
	if req.Bio != "" {
		updateQuery = updateQuery.SetBio(req.Bio)
	}
	if req.ProfileImageURL != "" {
		updateQuery = updateQuery.SetProfileImageURL(req.ProfileImageURL)
	}

	// プロフィールを更新
	updatedUser, err := updateQuery.Save(ctx)
	if err != nil {
		if ent.IsNotFound(err) {
			return c.JSON(http.StatusNotFound, models.ErrorResponse{
				Message: "ユーザーが見つかりません",
				Code:    "USER_NOT_FOUND",
			})
		}
		c.Logger().Errorf("update profile error: %v", err)
		return c.JSON(http.StatusInternalServerError, models.ErrorResponse{
			Message: "プロフィールの更新中にエラーが発生しました",
			Code:    "UPDATE_PROFILE_ERROR",
		})
	}

	// レスポンス作成
	userInfo := models.UserInfo{
		ID:              updatedUser.ID.String(),
		Name:            updatedUser.Name,
		Email:           updatedUser.Email,
		ProfileImageURL: updatedUser.ProfileImageURL,
		Bio:             updatedUser.Bio,
		CreatedAt:       updatedUser.CreatedAt,
		UpdatedAt:       updatedUser.UpdatedAt,
	}

	return c.JSON(http.StatusOK, userInfo)
}

// SearchUsers ユーザー検索ハンドラー（JWT認証が必要）
func (h *AuthHandler) SearchUsers(c echo.Context) error {
	// JWTミドルウェアで設定されたユーザー情報を取得（認証チェック）
	_, ok := c.Get("user_id").(string)
	if !ok {
		return c.JSON(http.StatusUnauthorized, models.ErrorResponse{
			Message: "認証が必要です",
			Code:    "NOT_AUTHENTICATED",
		})
	}

	// リクエストのバリデーション
	var req models.UserSearchRequest
	if err := middleware.ValidateRequest(c, &req); err != nil {
		if c.Response().Committed {
			return nil
		}
		return err
	}

	// デフォルトのlimit設定
	if req.Limit == 0 {
		req.Limit = 10
	}

	// データベースクライアント取得
	client := c.Get("db").(*ent.Client)
	ctx := c.Request().Context()

	// ユーザー検索（名前とメールアドレスで検索）
	// 総件数を取得
	total, err := client.User.Query().
		Where(
			user.Or(
				user.NameContainsFold(req.Query),
				user.EmailContainsFold(req.Query),
			),
		).Count(ctx)

	if err != nil {
		c.Logger().Errorf("count users error：%v", err)
		return c.JSON(http.StatusInternalServerError, models.ErrorResponse{
			Message: "ユーザー検索中にエラーが発生しました",
			Code:    "SEARCH_USERS_ERROR",
		})
	}

	// 実際の検索結果を取得
	users, err := client.User.Query().
		Where(
			user.Or(
				user.NameContainsFold(req.Query),
				user.EmailContainsFold(req.Query),
			),
		).
		Limit(req.Limit).
		All(ctx)

	if err != nil {
		c.Logger().Errorf("search users error: %v", err)
		return c.JSON(http.StatusInternalServerError, models.ErrorResponse{
			Message: "ユーザー検索中にエラーが発生しました",
			Code:    "SEARCH_USERS_ERROR",
		})
	}

	// レスポンス作成
	searchResults := make([]models.UserSearchResult, len(users))
	for i, user := range users {
		searchResults[i] = models.UserSearchResult{
			ID:              user.ID.String(),
			Name:            user.Name,
			Email:           user.Email,
			ProfileImageURL: user.ProfileImageURL,
		}
	}

	response := models.UserSearchResponse{
		Users: searchResults,
		Total: total,
	}

	return c.JSON(http.StatusOK, response)
}

// UploadAvatar アバター画像アップロードハンドラー（JWT認証が必要）
func (h *AuthHandler) UploadAvatar(c echo.Context) error {
	// JWTミドルウェアで設定されたユーザー情報を取得
	userID, ok := c.Get("user_id").(string)
	if !ok {
		return c.JSON(http.StatusUnauthorized, models.ErrorResponse{
			Message: "認証が必要です",
			Code:    "NOT_AUTHENTICATED",
		})
	}

	// マルチパートフォームからファイルを取得
	file, err := c.FormFile("avatar")
	if err != nil {
		return c.JSON(http.StatusBadRequest, models.ErrorResponse{
			Message: "アバター画像ファイルが見つかりません",
			Code:    "FILE_NOT_FOUND",
		})
	}

	// ファイルサイズチェック (5MB制限)
	const maxFileSize = 5 * 1024 * 1024
	if file.Size > maxFileSize {
		return c.JSON(http.StatusBadRequest, models.ErrorResponse{
			Message: "ファイルサイズが大きすぎます（5MB以下にしてください）",
			Code:    "FILE_TOO_LARGE",
		})
	}

	// ファイル形式チェック
	allowedTypes := map[string]bool{
		"image/jpeg": true,
		"image/jpg":  true,
		"image/png":  true,
		"image/gif":  true,
		"image/webp": true,
	}

	// ファイルを開いてMIMEタイプをチェック
	src, err := file.Open()
	if err != nil {
		return c.JSON(http.StatusInternalServerError, models.ErrorResponse{
			Message: "ファイルの読み込みに失敗しました",
			Code:    "FILE_READ_ERROR",
		})
	}
	defer src.Close()

	// ファイルヘッダーから実際のMIMEタイプを判定(512バイト未満のファイルも)
	buffer := make([]byte, 512)
	_, err = src.Read(buffer)
	if err != nil && err != io.EOF {
		return c.JSON(http.StatusInternalServerError, models.ErrorResponse{
			Message: "ファイルの読み込みに失敗しました",
			Code:    "FILE_READ_ERROR",
		})
	}

	// ファイルを先頭に戻す（将来的な実際のアップロード処理のため）
	_, err = src.Seek(0, 0)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, models.ErrorResponse{
			Message: "ファイルの読み込みに失敗しました",
			Code:    "FILE_READ_ERROR",
		})
	}

	contentType := http.DetectContentType(buffer)
	if !allowedTypes[contentType] {
		return c.JSON(http.StatusBadRequest, models.ErrorResponse{
			Message: "サポートされていないファイル形式です（JPEG、PNG、GIF、WebPのみ）",
			Code:    "INVALID_FILE_TYPE",
		})
	}

	// 一時的にファイル名として現在時刻 + ユーザーIDを使用
	// 本番環境ではCloudflare R2やAWS S3などのオブジェクトストレージを使用する
	fileName := fmt.Sprintf("avatar_%s_%d", userID, time.Now().Unix())

	extMap := map[string]string{
		"image/jpeg": ".jpg",
		"image/jpg":  ".jpg",
		"image/png":  ".png",
		"image/gif":  ".git",
		"image/webp": ".webp",
	}

	ext := extMap[contentType]
	fileName += ext

	// TODO: 本番環境では実際のオブジェクトストレージにアップロードする
	// 現在は仮のURLを生成
	avatarURL := fmt.Sprintf("https://example.com/uploads/avatars/%s", fileName)

	// データベースクライアント取得
	client := c.Get("db").(*ent.Client)
	ctx := c.Request().Context()

	// ユーザー情報をUUIDで検索
	userUUID, err := uuid.Parse(userID)
	if err != nil {
		return c.JSON(http.StatusBadRequest, models.ErrorResponse{
			Message: "無効なユーザーIDです",
			Code:    "INVALID_USER_ID",
		})
	}

	// プロフィール画像URLを更新
	_, err = client.User.UpdateOneID(userUUID).
		SetProfileImageURL(avatarURL).
		Save(ctx)

	if err != nil {
		if ent.IsNotFound(err) {
			return c.JSON(http.StatusNotFound, models.ErrorResponse{
				Message: "ユーザーが見つかりません",
				Code:    "USER_NOT_FOUND",
			})
		}
		c.Logger().Errorf("update avatar error: %v", err)
		return c.JSON(http.StatusInternalServerError, models.ErrorResponse{
			Message: "アバターの更新中にエラーが発生しました",
			Code:    "UPDATE_AVATAR_ERROR",
		})
	}

	// レスポンス作成
	response := models.UploadAvatarResponse{
		ProfileImageURL: avatarURL,
		Message:         "アバター画像が正常にアップロードされました",
	}

	return c.JSON(http.StatusOK, response)
}
