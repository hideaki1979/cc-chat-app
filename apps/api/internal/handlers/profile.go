package handlers

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"time"

	"github.com/google/uuid"
	"github.com/hideaki1979/cc-chat-app/apps/api/ent/user"
	"github.com/hideaki1979/cc-chat-app/apps/api/internal/middleware"
	"github.com/hideaki1979/cc-chat-app/apps/api/internal/models"

	"github.com/labstack/echo/v4"
	"github.com/sirupsen/logrus"
)

// ProfileHandler プロフィール管理専用のハンドラー構造体
type ProfileHandler struct {
	*BaseHandler
}

// NewProfileHandler 新しいProfileHandlerインスタンスを作成
func NewProfileHandler() *ProfileHandler {
	return &ProfileHandler{
		BaseHandler: NewBaseHandler(),
	}
}

// GetProfile 現在のユーザー情報取得ハンドラー（JWT認証が必要）
func (h *ProfileHandler) GetProfile(c echo.Context) error {
	userID, err := h.getUserID(c)
	if err != nil {
		return h.handleError(c, err)
	}

	client := h.getDBClient(c)
	ctx := context.Background()

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
		return h.handleError(c, err)
	}

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

// UpdateProfile プロフィール更新ハンドラー（JWT認証が必要）
func (h *ProfileHandler) UpdateProfile(c echo.Context) error {
	userID, err := h.getUserID(c)
	if err != nil {
		return h.handleError(c, err)
	}

	var req models.UpdateProfileRequest
	if err := middleware.ValidateRequest(c, &req); err != nil {
		return h.handleError(c, err)
	}

	client := h.getDBClient(c)
	ctx := c.Request().Context()

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
		updateQuery = updateQuery.SetNillableBio(&req.Bio)
	}
	if req.ProfileImageURL != "" {
		updateQuery = updateQuery.SetNillableProfileImageURL(&req.ProfileImageURL)
	}

	updatedUser, err := updateQuery.Save(ctx)
	if err != nil {
		h.logError(c, err, "Failed to update user profile", logrus.Fields{
			"operation": "update_profile",
			"user_id":   userID,
		})
		return h.handleError(c, err)
	}

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

// UploadAvatar アバター画像アップロードハンドラー（JWT認証が必要）
func (h *ProfileHandler) UploadAvatar(c echo.Context) error {
	userID, err := h.getUserID(c)
	if err != nil {
		return h.handleError(c, err)
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

	// ファイルヘッダーから実際のMIMEタイプを判定
	buffer := make([]byte, 512)
	_, err = src.Read(buffer)
	if err != nil && err != io.EOF {
		return c.JSON(http.StatusInternalServerError, models.ErrorResponse{
			Message: "ファイルの読み込みに失敗しました",
			Code:    "FILE_READ_ERROR",
		})
	}

	// ファイルを先頭に戻す
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
	fileName := fmt.Sprintf("avatar_%s_%d", userID, time.Now().Unix())

	extMap := map[string]string{
		"image/jpeg": ".jpg",
		"image/jpg":  ".jpg",
		"image/png":  ".png",
		"image/gif":  ".gif",
		"image/webp": ".webp",
	}

	ext := extMap[contentType]
	fileName += ext

	// TODO: 本番環境では実際のオブジェクトストレージにアップロードする
	avatarURL := fmt.Sprintf("https://example.com/uploads/avatars/%s", fileName)

	client := h.getDBClient(c)
	ctx := c.Request().Context()

	userUUID, err := uuid.Parse(userID)
	if err != nil {
		return c.JSON(http.StatusBadRequest, models.ErrorResponse{
			Message: "無効なユーザーIDです",
			Code:    "INVALID_USER_ID",
		})
	}

	// プロフィール画像URLを更新
	_, err = client.User.UpdateOneID(userUUID).
		SetNillableProfileImageURL(&avatarURL).
		Save(ctx)

	if err != nil {
		h.logError(c, err, "Failed to update user avatar", logrus.Fields{
			"operation":  "upload_avatar",
			"user_id":    userID,
			"file_size":  file.Size,
			"avatar_url": avatarURL,
		})
		return h.handleError(c, err)
	}

	response := models.UploadAvatarResponse{
		ProfileImageURL: avatarURL,
		Message:         "アバター画像が正常にアップロードされました",
	}

	return c.JSON(http.StatusOK, response)
}