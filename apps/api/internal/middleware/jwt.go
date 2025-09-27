package middleware

import (
	"net/http"
	"strings"

	"github.com/hideaki1979/cc-chat-app/apps/api/internal/auth"
	"github.com/hideaki1979/cc-chat-app/apps/api/internal/models"
	"github.com/labstack/echo/v4"
)

// JWTAuth JWT認証ミドルウェア（Cookie優先、Authorizationヘッダーをフォールバックとしてサポート）
func JWTAuth() echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			var tokenString string

			// 1. Cookieからaccess_tokenを取得を優先する
			if accessTokenCookie, err := c.Cookie("access_token"); err == nil && accessTokenCookie.Value != "" {
				tokenString = strings.TrimSpace(accessTokenCookie.Value)
			} else {
				// 2. フォールバック: Authorizationヘッダーから取得
				authHeader := c.Request().Header.Get("Authorization")
				if authHeader != "" {
					const bearerPrefix = "Bearer "
					if strings.HasPrefix(authHeader, bearerPrefix) {
						tokenString = strings.TrimSpace(authHeader[len(bearerPrefix):])
					}
				} else {
					// 3. WebSocket用: クエリパラメータからtokenを取得
					tokenParam := c.QueryParam("token")
					if tokenParam != "" {
						tokenString = strings.TrimSpace(tokenParam)
					}
				}
			}

			// トークンが無い場合は認証失敗
			if tokenString == "" {
				return c.JSON(http.StatusUnauthorized, models.ErrorResponse{
					Message: "Missing access token in cookie, authorization header, or token parameter",
					Code:    "MISSING_ACCESS_TOKEN",
				})
			}

			// トークンを検証
			claims, err := auth.ValidateJWT(tokenString)
			if err != nil {
				return c.JSON(http.StatusUnauthorized, models.ErrorResponse{
					Message: "Invalid or expired access token",
					Code:    "INVALID_ACCESS_TOKEN",
				})
			}

			// ユーザー情報をコンテキストに設定
			c.Set("user_id", claims.UserID)
			c.Set("user_email", claims.Email)

			return next(c)
		}
	}
}