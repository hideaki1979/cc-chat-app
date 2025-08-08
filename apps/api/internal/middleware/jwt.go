package middleware

import (
	"net/http"
	"strings"

	"github.com/hideaki1979/cc-chat-app/apps/api/internal/auth"
	"github.com/hideaki1979/cc-chat-app/apps/api/internal/models"
	"github.com/labstack/echo/v4"
)

// JWTAuth JWT認証ミドルウェア
func JWTAuth() echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			// Authorizationヘッダーを取得
			authHeader := c.Request().Header.Get("Authorization")
			if authHeader == "" {
				return c.JSON(http.StatusUnauthorized, models.ErrorResponse{
					Message: "Missing authorization header",
					Code:    "MISSING_AUTH_HEADER",
				})
			}

			// "Bearer " プレフィックスをチェック
			const bearerPrefix = "Bearer "
			if !strings.HasPrefix(authHeader, bearerPrefix) {
				return c.JSON(http.StatusUnauthorized, models.ErrorResponse{
					Message: "Invalid authorization header format",
					Code:    "INVALID_AUTH_HEADER",
				})
			}

			// トークンを抽出
			tokenString := authHeader[len(bearerPrefix):]
			if tokenString == "" {
				return c.JSON(http.StatusUnauthorized, models.ErrorResponse{
					Message: "Missing token",
					Code:    "MISSING_TOKEN",
				})
			}

			// トークンを検証
			claims, err := auth.ValidateJWT(tokenString)
			if err != nil {
				return c.JSON(http.StatusUnauthorized, models.ErrorResponse{
					Message: "Invalid or expired token",
					Code:    "INVALID_TOKEN",
				})
			}

			// ユーザー情報をコンテキストに設定
			c.Set("user_id", claims.UserID)
			c.Set("user_email", claims.Email)

			return next(c)
		}
	}
}