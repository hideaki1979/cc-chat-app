package middleware

import (
	"net/http"
	"reflect"
	"regexp"
	"strings"

	"github.com/go-playground/validator/v10"
	"github.com/hideaki1979/cc-chat-app/apps/api/internal/models"
	"github.com/labstack/echo/v4"
)

// CustomValidator カスタムバリデーター構造体
type CustomValidator struct {
	validator *validator.Validate
}

// NewValidator 新しいカスタムバリデーターを作成
func NewValidator() *CustomValidator {
	v := validator.New()
	// jsonタグ名をエラーフィールド名として使用
	v.RegisterTagNameFunc(func(fld reflect.StructField) string {
		name := strings.SplitN(fld.Tag.Get("json"), ",", 2)[0]
		if name == "-" {
			return ""
		}
		return name
	})
	// カスタムバリデーション: ユーザー名（英数字・アンダースコア・ハイフン・スペースを許可）
	usernamePattern := regexp.MustCompile(`^[a-zA-Z0-9_\- ]+$`)
	_ = v.RegisterValidation("username", func(fl validator.FieldLevel) bool {
		value := fl.Field().String()
		return usernamePattern.MatchString(value)
	})

	// カスタムバリデーション: パスワード複雑性（小文字・大文字・数字を各1つ以上含む）
	_ = v.RegisterValidation("password_complex", func(fl validator.FieldLevel) bool {
		s := fl.Field().String()
		hasLower := regexp.MustCompile(`[a-z]`).MatchString(s)
		hasUpper := regexp.MustCompile(`[A-Z]`).MatchString(s)
		hasDigit := regexp.MustCompile(`\d`).MatchString(s)
		return hasLower && hasUpper && hasDigit
	})
	return &CustomValidator{validator: v}
}

// Validate バリデーション実行
func (cv *CustomValidator) Validate(i interface{}) error {
	if err := cv.validator.Struct(i); err != nil {
		return err
	}
	return nil
}

// ValidateRequest リクエストをバリデーションし、エラーがあればレスポンスを返す
func ValidateRequest(c echo.Context, req interface{}) error {
	// リクエストをバインド
	if err := c.Bind(req); err != nil {
		return c.JSON(http.StatusBadRequest, models.ErrorResponse{
			Message: "Invalid request format",
			Code:    "INVALID_REQUEST",
		})
	}

	// バリデーション実行
	if err := c.Validate(req); err != nil {
		if validationErrors, ok := err.(validator.ValidationErrors); ok {
			// バリデーションエラーの場合、わかりやすいメッセージに変換
			errorMessage := formatValidationError(validationErrors)
			return c.JSON(http.StatusBadRequest, models.ErrorResponse{
				Message: errorMessage,
				Code:    "VALIDATION_ERROR",
			})
		}
		return c.JSON(http.StatusBadRequest, models.ErrorResponse{
			Message: "Validation failed",
			Code:    "VALIDATION_ERROR",
		})
	}

	return nil
}

// formatValidationError バリデーションエラーを日本語メッセージに変換
func formatValidationError(errs validator.ValidationErrors) string {
	for _, err := range errs {
		switch err.Tag() {
		case "required":
			switch err.Field() {
			case "Name":
				return "名前は必須です"
			case "Email":
				return "メールアドレスは必須です"
			case "Password":
				return "パスワードは必須です"
			case "RefreshToken":
				return "リフレッシュトークンは必須です"
			default:
				return err.Field() + "は必須です"
			}
		case "email":
			return "有効なメールアドレスを入力してください"
		case "min":
			switch err.Field() {
			case "Name":
				return "名前は2文字以上で入力してください"
			case "Password":
				return "パスワードは8文字以上で入力してください"
			default:
				return err.Field() + "は" + err.Param() + "文字以上で入力してください"
			}
		case "max":
			switch err.Field() {
			case "Name":
				return "名前は30文字以下で入力してください"
			default:
				return err.Field() + "は" + err.Param() + "文字以下で入力してください"
			}
		case "username":
			return "名前は英数字、アンダースコア、ハイフン、スペースのみ使用できます"
		case "password_complex":
			return "パスワードは大文字・小文字・数字を各1つ以上含む必要があります"
		default:
			return err.Field() + "の値が正しくありません"
		}
	}
	return "入力値が正しくありません"
}
