package handlers

import (
	"errors"
	"net/http"

	"github.com/hideaki1979/cc-chat-app/apps/api/ent"
	"github.com/hideaki1979/cc-chat-app/apps/api/internal/logging"
	"github.com/hideaki1979/cc-chat-app/apps/api/internal/models"
	"github.com/hideaki1979/cc-chat-app/apps/api/internal/services"
	"github.com/labstack/echo/v4"
	"github.com/sirupsen/logrus"
)

// BaseHandler すべてのハンドラーで共通の処理を提供
type BaseHandler struct {
	structuredLogger logging.StructuredLogger
}

// NewBaseHandler BaseHandlerの新しいインスタンスを作成
func NewBaseHandler() *BaseHandler {
	return &BaseHandler{
		structuredLogger: logging.NewStructuredLogger(),
	}
}

// handleError 共通エラーハンドリング
func (h *BaseHandler) handleError(c echo.Context, err error) error {
	// レスポンスが既に送信済みの場合は何もしない
	if c.Response().Committed {
		return nil
	}

	var statusCode int
	var errorResponse models.ErrorResponse

	switch {
	case errors.Is(err, services.ErrInvalidInput):
		statusCode = http.StatusBadRequest
		errorResponse = models.ErrorResponse{
			Message: "入力データが不正です",
			Code:    "INVALID_INPUT",
		}
		h.structuredLogger.WarnWithContext(c, "Invalid input", logrus.Fields{
			"error_code": "INVALID_INPUT",
		})

	case errors.Is(err, services.ErrFileNotFound):
		statusCode = http.StatusBadRequest
		errorResponse = models.ErrorResponse{
			Message: "ファイルが見つかりません",
			Code:    "FILE_NOT_FOUND",
		}
		h.structuredLogger.WarnWithContext(c, "File not found", logrus.Fields{
			"error_code": "FILE_NOT_FOUND",
		})

	case errors.Is(err, services.ErrFileTooLarge):
		statusCode = http.StatusBadRequest
		errorResponse = models.ErrorResponse{
			Message: "ファイルサイズが大きすぎます（5MB以下にしてください）",
			Code:    "FILE_TOO_LARGE",
		}
		h.structuredLogger.WarnWithContext(c, "File too large", logrus.Fields{
			"error_code": "FILE_TOO_LARGE",
		})

	case errors.Is(err, services.ErrInvalidFileType):
		statusCode = http.StatusBadRequest
		errorResponse = models.ErrorResponse{
			Message: "サポートされていないファイル形式です（JPEG、PNG、GIF、WebPのみ）",
			Code:    "INVALID_FILE_TYPE",
		}
		h.structuredLogger.WarnWithContext(c, "Invalid file type", logrus.Fields{
			"error_code": "INVALID_FILE_TYPE",
		})

	case errors.Is(err, services.ErrFileReadError):
		statusCode = http.StatusInternalServerError
		errorResponse = models.ErrorResponse{
			Message: "ファイルの読み込みに失敗しました",
			Code:    "FILE_READ_ERROR",
		}
		h.structuredLogger.ErrorWithContext(c, err, "File read error", logrus.Fields{
			"error_code": "FILE_READ_ERROR",
		})

	case errors.Is(err, services.ErrNotAuthenticated):
		statusCode = http.StatusUnauthorized
		errorResponse = models.ErrorResponse{
			Message: "認証が必要です",
			Code:    "NOT_AUTHENTICATED",
		}
		h.structuredLogger.WarnWithContext(c, "Authentication required", logrus.Fields{
			"error_code": "NOT_AUTHENTICATED",
		})

	case errors.Is(err, services.ErrEmailExists):
		statusCode = http.StatusConflict
		errorResponse = models.ErrorResponse{
			Message: "このメールアドレスは既に使用されています",
			Code:    "EMAIL_ALREADY_EXISTS",
		}
		h.structuredLogger.WarnWithContext(c, "Email already exists", logrus.Fields{
			"error_code": "EMAIL_ALREADY_EXISTS",
		})

	case errors.Is(err, services.ErrInvalidCredentials):
		statusCode = http.StatusUnauthorized
		errorResponse = models.ErrorResponse{
			Message: "メールアドレスまたはパスワードに誤りがあります",
			Code:    "INVALID_CREDENTIALS",
		}
		h.structuredLogger.WarnWithContext(c, "Invalid credentials provided", logrus.Fields{
			"error_code": "INVALID_CREDENTIALS",
		})

	case errors.Is(err, services.ErrUserNotFound):
		statusCode = http.StatusNotFound
		errorResponse = models.ErrorResponse{
			Message: "ユーザーが見つかりません",
			Code:    "USER_NOT_FOUND",
		}
		h.structuredLogger.WarnWithContext(c, "User not found", logrus.Fields{
			"error_code": "USER_NOT_FOUND",
		})

	case errors.Is(err, services.ErrInvalidToken):
		statusCode = http.StatusUnauthorized
		errorResponse = models.ErrorResponse{
			Message: "トークンが無効です",
			Code:    "INVALID_TOKEN",
		}
		h.structuredLogger.WarnWithContext(c, "Invalid token provided", logrus.Fields{
			"error_code": "INVALID_TOKEN",
		})

	case ent.IsNotFound(err):
		statusCode = http.StatusNotFound
		errorResponse = models.ErrorResponse{
			Message: "リソースが見つかりません",
			Code:    "RESOURCE_NOT_FOUND",
		}
		h.structuredLogger.WarnWithContext(c, "Resource not found", logrus.Fields{
			"error_code": "RESOURCE_NOT_FOUND",
		})

	case ent.IsValidationError(err):
		statusCode = http.StatusBadRequest
		errorResponse = models.ErrorResponse{
			Message: "入力データが不正です",
			Code:    "VALIDATION_ERROR",
		}
		h.structuredLogger.WarnWithContext(c, "Validation error", logrus.Fields{
			"error_code": "VALIDATION_ERROR",
		})

	default:
		// 想定外のエラーは内部サーバーエラーとして処理
		statusCode = http.StatusInternalServerError
		errorResponse = models.ErrorResponse{
			Message: "内部サーバーエラーが発生しました",
			Code:    "INTERNAL_SERVER_ERROR",
		}
		h.structuredLogger.ErrorWithContext(c, err, "Unexpected internal server error", logrus.Fields{
			"error_code": "INTERNAL_SERVER_ERROR",
		})
	}

	return c.JSON(statusCode, errorResponse)
}

// logError エラーログを記録する（ハンドラー内での直接使用用）
func (h *BaseHandler) logError(c echo.Context, err error, message string, fields logrus.Fields) {
	h.structuredLogger.ErrorWithContext(c, err, message, fields)
}

// logWarn 警告ログを記録する
func (h *BaseHandler) logWarn(c echo.Context, message string, fields logrus.Fields) {
	h.structuredLogger.WarnWithContext(c, message, fields)
}

// logInfo 情報ログを記録する
func (h *BaseHandler) logInfo(c echo.Context, message string, fields logrus.Fields) {
	h.structuredLogger.InfoWithContext(c, message, fields)
}

// getUserID JWTミドルウェアで設定されたユーザーIDを取得
func (h *BaseHandler) getUserID(c echo.Context) (string, error) {
	userID, ok := c.Get("user_id").(string)
	if !ok {
		return "", services.ErrNotAuthenticated
	}
	return userID, nil
}

// getDBClient データベースクライアントを取得
func (h *BaseHandler) getDBClient(c echo.Context) (*ent.Client, error) {
	v := c.Get("db")
	client, ok := v.(*ent.Client)
	if !ok || client == nil {
		return nil, services.ErrDBNotAvailable
	}
	return client, nil
}
