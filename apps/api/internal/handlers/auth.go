package handlers

import (
	"context"
	"crypto/rand"
	"encoding/base64"
	"net/http"
	"strings"
	"time"

	"github.com/hideaki1979/cc-chat-app/apps/api/ent/user"
	"github.com/hideaki1979/cc-chat-app/apps/api/internal/auth"
	"github.com/hideaki1979/cc-chat-app/apps/api/internal/middleware"
	"github.com/hideaki1979/cc-chat-app/apps/api/internal/models"
	"github.com/hideaki1979/cc-chat-app/apps/api/internal/services"
	"github.com/hideaki1979/cc-chat-app/apps/api/util"

	"github.com/labstack/echo/v4"
	"github.com/sirupsen/logrus"
)

// AuthHandler 認証処理専用のハンドラー構造体
type AuthHandler struct {
	*BaseHandler
	authService  services.AuthServiceInterface
	tokenService services.TokenServiceInterface
}

// NewAuthHandler 新しいAuthHandlerインスタンスを作成
func NewAuthHandler(authService services.AuthServiceInterface, tokenService services.TokenServiceInterface) *AuthHandler {
	return &AuthHandler{
		BaseHandler:  NewBaseHandler(),
		authService:  authService,
		tokenService: tokenService,
	}
}

// setAccessTokenCookie アクセストークンをhttpOnly Cookieに設定する共通処理
func (h *AuthHandler) setAccessTokenCookie(c echo.Context, accessToken string) {
	cookie := &http.Cookie{
		Name:     "access_token",
		Value:    accessToken,
		Path:     "/",
		Domain:   "",                                // 空文字でcurrent hostに設定
		MaxAge:   int(15 * time.Minute.Seconds()),   // 15分間（秒単位）
		HttpOnly: true,                              // XSS攻撃を防ぐ
		Secure:   util.IsProduction(),               // 本番環境のみHTTPS必須
		SameSite: http.SameSiteLaxMode,              // 開発環境でのクロスサイト許可
	}
	c.SetCookie(cookie)
}

// setRefreshTokenCookie リフレッシュトークンをhttpOnly Cookieに設定する共通処理
func (h *AuthHandler) setRefreshTokenCookie(c echo.Context, refreshToken string) {
	cookie := &http.Cookie{
		Name:     "refresh_token",
		Value:    refreshToken,
		Path:     "/",
		Domain:   "",                                // 空文字でcurrent hostに設定
		MaxAge:   int(7 * 24 * time.Hour.Seconds()), // 7日間（秒単位）
		HttpOnly: true,                              // XSS攻撃を防ぐ
		Secure:   util.IsProduction(),               // 本番環境のみHTTPS必須
		SameSite: http.SameSiteLaxMode,              // 開発環境でのクロスサイト許可
	}
	c.SetCookie(cookie)
}

// clearAccessTokenCookie アクセストークンCookieを削除する共通処理
func (h *AuthHandler) clearAccessTokenCookie(c echo.Context) {
	clearCookie := &http.Cookie{
		Name:     "access_token",
		Value:    "",
		Path:     "/",
		Domain:   "", // 空文字でcurrent hostに設定
		MaxAge:   -1, // 即座に削除
		HttpOnly: true,
		Secure:   util.IsProduction(),
		SameSite: http.SameSiteLaxMode,
	}
	c.SetCookie(clearCookie)
}

// clearRefreshTokenCookie リフレッシュトークンCookieを削除する共通処理
func (h *AuthHandler) clearRefreshTokenCookie(c echo.Context) {
	clearCookie := &http.Cookie{
		Name:     "refresh_token",
		Value:    "",
		Path:     "/",
		Domain:   "", // 空文字でcurrent hostに設定
		MaxAge:   -1, // 即座に削除
		HttpOnly: true,
		Secure:   util.IsProduction(),
		SameSite: http.SameSiteLaxMode,
	}
	c.SetCookie(clearCookie)
}

// generateCSRFToken CSRFトークンを生成
func (h *AuthHandler) generateCSRFToken() (string, error) {
	bytes := make([]byte, 32)
	if _, err := rand.Read(bytes); err != nil {
		return "", err
	}
	return base64.URLEncoding.EncodeToString(bytes), nil
}

// Register ユーザー登録ハンドラー
func (h *AuthHandler) Register(c echo.Context) error {
	var req models.RegisterRequest
	if err := middleware.ValidateRequest(c, &req); err != nil {
		h.logError(c, err, "Validation failed for registration request", logrus.Fields{
			"operation": "register",
		})
		return h.handleError(c, err)
	}

	ctx := c.Request().Context()

	h.logInfo(c, "Processing user registration request", logrus.Fields{
		"operation":       "register",
		"user_name":       req.Name,
		"user_email":      req.Email,
		"password_length": len(req.Password),
	})

	result, err := h.authService.RegisterUser(ctx, req)
	if err != nil {
		h.logError(c, err, "User registration failed", logrus.Fields{
			"operation":  "register",
			"user_email": req.Email,
			"user_name":  req.Name,
		})
		return h.handleError(c, err)
	}

	// アクセストークン、リフレッシュトークン、CSRFトークンをCookieに設定
	h.setAccessTokenCookie(c, result.Tokens.AccessToken)
	h.setRefreshTokenCookie(c, result.Tokens.RefreshToken)

	// CSRFトークンを生成してCookieに設定
	csrfToken, err := h.generateCSRFToken()
	if err != nil {
		h.logError(c, err, "Failed to generate CSRF token during registration", logrus.Fields{
			"operation": "register",
		})
		return h.handleError(c, err)
	}
	middleware.SetCSRFTokenCookie(c, csrfToken)

	h.logInfo(c, "User registration completed successfully", logrus.Fields{
		"operation": "register",
		"user_id":   result.User.ID,
		"user_name": result.User.Name,
	})

	// JSONレスポンスからトークンを除去
	return c.JSON(http.StatusCreated, models.AuthResponse{
		User: result.User,
	})
}

// Login ユーザーログインハンドラー
func (h *AuthHandler) Login(c echo.Context) error {
	var req models.LoginRequest
	if err := middleware.ValidateRequest(c, &req); err != nil {
		h.logError(c, err, "Validation failed for login request", logrus.Fields{
			"operation": "login",
		})
		return h.handleError(c, err)
	}

	ctx := c.Request().Context()

	result, err := h.authService.AuthenticateUser(ctx, req)
	if err != nil {
		h.logError(c, err, "User authentication failed", logrus.Fields{
			"operation":  "login",
			"user_email": req.Email,
		})
		return h.handleError(c, err)
	}

	// アクセストークン、リフレッシュトークン、CSRFトークンをCookieに設定
	h.setAccessTokenCookie(c, result.Tokens.AccessToken)
	h.setRefreshTokenCookie(c, result.Tokens.RefreshToken)

	// CSRFトークンを生成してCookieに設定
	csrfToken, err := h.generateCSRFToken()
	if err != nil {
		h.logError(c, err, "Failed to generate CSRF token during login", logrus.Fields{
			"operation": "login",
		})
		return h.handleError(c, err)
	}
	middleware.SetCSRFTokenCookie(c, csrfToken)

	h.logInfo(c, "User login completed successfully", logrus.Fields{
		"operation": "login",
		"user_id":   result.User.ID,
		"user_name": result.User.Name,
	})

	// JSONレスポンスからトークンを除去
	return c.JSON(http.StatusOK, models.AuthResponse{
		User: result.User,
	})
}

// Logout ユーザーログアウトハンドラー
func (h *AuthHandler) Logout(c echo.Context) error {
	client := h.getDBClient(c)
	ctx := context.Background()

	// Cookieからリフレッシュトークンを取得してDBから削除
	cookie, err := c.Cookie("refresh_token")
	if err == nil && cookie.Value != "" {
		hashedToken := auth.HashRefreshToken(cookie.Value)
		_, updateErr := client.User.Update().
			Where(user.RefreshTokenHashEQ(hashedToken)).
			ClearRefreshTokenHash().
			ClearRefreshTokenExpiresAt().
			Save(ctx)
		if updateErr != nil {
			h.logError(c, updateErr, "Failed to clear refresh token from database during logout", logrus.Fields{
				"operation": "logout",
			})
		}
	}

	// アクセストークン、リフレッシュトークン、CSRFトークンCookieを削除
	h.clearAccessTokenCookie(c)
	h.clearRefreshTokenCookie(c)
	middleware.ClearCSRFTokenCookie(c)

	return c.JSON(http.StatusOK, map[string]string{
		"message": "ログアウトしました",
	})
}

// RefreshToken リフレッシュトークンを使ってアクセストークンを更新
func (h *AuthHandler) RefreshToken(c echo.Context) error {
	cookie, err := c.Cookie("refresh_token")
	if err != nil {
		h.logWarn(c, "Refresh token cookie not found", logrus.Fields{
			"operation": "refresh_token",
		})
		return h.handleError(c, services.ErrInvalidToken)
	}

	refreshTokenValue := strings.TrimSpace(cookie.Value)
	if refreshTokenValue == "" {
		h.logWarn(c, "Empty refresh token value provided", logrus.Fields{
			"operation": "refresh_token",
		})
		return h.handleError(c, services.ErrInvalidToken)
	}

	ctx := c.Request().Context()

	tokens, err := h.tokenService.RefreshTokens(ctx, refreshTokenValue)
	if err != nil {
		h.logError(c, err, "Token refresh failed", logrus.Fields{
			"operation": "refresh_token",
		})
		// 失敗時はクッキーを無効化
		h.clearRefreshTokenCookie(c)
		return h.handleError(c, services.ErrInvalidToken)
	}

	// 新しいアクセストークンをCookieに設定
	h.setAccessTokenCookie(c, tokens.AccessToken)

	// CSRFトークンを更新
	csrfToken, err := h.generateCSRFToken()
	if err != nil {
		h.logError(c, err, "Failed to generate CSRF token during token refresh", logrus.Fields{
			"operation": "refresh_token",
		})
		return h.handleError(c, err)
	}
	middleware.SetCSRFTokenCookie(c, csrfToken)

	// 新しいリフレッシュトークンが発行された場合はCookieを更新
	if tokens.RefreshToken != "" && tokens.RefreshToken != refreshTokenValue {
		h.setRefreshTokenCookie(c, tokens.RefreshToken)
		h.logInfo(c, "Refresh token rotated successfully", logrus.Fields{
			"operation": "refresh_token",
		})
	}

	h.logInfo(c, "Access token refreshed successfully", logrus.Fields{
		"operation": "refresh_token",
	})

	// JSONレスポンスからトークンを除去（Cookie化により不要）
	return c.JSON(http.StatusOK, map[string]string{
		"message": "トークンが更新されました",
	})
}