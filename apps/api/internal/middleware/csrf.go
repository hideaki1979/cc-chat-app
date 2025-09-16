package middleware

import (
	"crypto/rand"
	"encoding/base64"
	"net/http"
	"strings"

	"github.com/hideaki1979/cc-chat-app/apps/api/internal/models"
	"github.com/hideaki1979/cc-chat-app/apps/api/util"
	"github.com/labstack/echo/v4"
)

// GenerateCSRFToken CSRF トークンを生成 (公開用)
func GenerateCSRFToken() (string, error) {
	bytes := make([]byte, 32)
	if _, err := rand.Read(bytes); err != nil {
		return "", err
	}
	return base64.URLEncoding.EncodeToString(bytes), nil
}

// CSRFProtection CSRF二重送信保護ミドルウェア
func CSRFProtection() echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			method := c.Request().Method

			// GET, HEAD, OPTIONS, TRACE は CSRF 保護をスキップ
			if method == "GET" || method == "HEAD" || method == "OPTIONS" || method == "TRACE" {
				return next(c)
			}

			// POST, PUT, PATCH, DELETE のみ CSRF 検証を行う
			csrfToken := c.Request().Header.Get("X-CSRF-Token")
			if csrfToken == "" {
				return c.JSON(http.StatusForbidden, models.ErrorResponse{
					Message: "Missing CSRF token",
					Code:    "MISSING_CSRF_TOKEN",
				})
			}

			// Cookie から CSRF トークンを取得
			csrfCookie, err := c.Cookie("csrf_token")
			if err != nil || csrfCookie.Value == "" {
				return c.JSON(http.StatusForbidden, models.ErrorResponse{
					Message: "Missing CSRF token cookie",
					Code:    "MISSING_CSRF_COOKIE",
				})
			}

			// ヘッダーとCookieのトークンを比較
			if strings.TrimSpace(csrfToken) != strings.TrimSpace(csrfCookie.Value) {
				return c.JSON(http.StatusForbidden, models.ErrorResponse{
					Message: "CSRF token mismatch",
					Code:    "CSRF_TOKEN_MISMATCH",
				})
			}

			return next(c)
		}
	}
}

// SetCSRFTokenCookie CSRFトークンをCookieに設定
func SetCSRFTokenCookie(c echo.Context, token string) {
	cookie := &http.Cookie{
		Name:     "csrf_token",
		Value:    token,
		Path:     "/",
		Domain:   "",                    // 空文字でcurrent hostに設定
		MaxAge:   int(24 * 60 * 60),     // 24時間（秒単位）
		HttpOnly: false,                 // JavaScript からアクセス可能にする（X-CSRF-Tokenヘッダ用）
		Secure:   util.IsProduction(),   // 本番環境のみHTTPS必須
		SameSite: http.SameSiteLaxMode,  // 開発環境でのクロスサイト許可
	}
	c.SetCookie(cookie)
}

// ClearCSRFTokenCookie CSRFトークンCookieを削除
func ClearCSRFTokenCookie(c echo.Context) {
	clearCookie := &http.Cookie{
		Name:     "csrf_token",
		Value:    "",
		Path:     "/",
		Domain:   "",
		MaxAge:   -1,
		HttpOnly: false,
		Secure:   util.IsProduction(),
		SameSite: http.SameSiteLaxMode,
	}
	c.SetCookie(clearCookie)
}