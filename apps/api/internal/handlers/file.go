package handlers

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"net/http"
	"path/filepath"
	"strings"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/google/uuid"
	"github.com/hideaki1979/cc-chat-app/apps/api/internal/models"
	"github.com/labstack/echo/v4"
)

// FileHandler ファイル関連のハンドラー
type FileHandler struct {
	s3Client   *s3.Client
	bucketName string
}

// NewFileHandler FileHandlerのコンストラクタ
func NewFileHandler(s3Client *s3.Client, bucketName string) *FileHandler {
	return &FileHandler{
		s3Client:   s3Client,
		bucketName: bucketName,
	}
}

const (
	maxFileSize = 10 * 1024 * 1024 // 10MB
)

// allowedMimeTypes 許可されたファイルタイプ
var allowedMimeTypes = map[string]bool{
	"image/jpeg": true,
	"image/png":  true,
	"image/gif":  true,
	"image/webp": true,
	"text/plain": true,
	"application/pdf": true,
	"application/msword": true,
	"application/vnd.openxmlformats-officedocument.wordprocessingml.document": true,
	"application/vnd.ms-excel": true,
	"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": true,
}

// UploadFile ファイルアップロード
// POST /api/files/upload
func (h *FileHandler) UploadFile(c echo.Context) error {
	userUUID, err := getUserUUID(c)
	if err != nil {
		return err
	}

	// ファイルを取得
	file, err := c.FormFile("file")
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "File is required")
	}

	// ファイルサイズチェック
	if file.Size > maxFileSize {
		return echo.NewHTTPError(http.StatusBadRequest, "File size exceeds 10MB limit")
	}

	// ファイルを開く
	src, err := file.Open()
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to open file")
	}
	defer src.Close()

	// MIMEタイプチェック
	contentType := file.Header.Get("Content-Type")
	if !allowedMimeTypes[contentType] {
		return echo.NewHTTPError(http.StatusBadRequest, "File type not allowed")
	}

	// ファイル内容を読み込み
	fileBytes, err := io.ReadAll(src)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to read file")
	}

	// S3用のキー生成（ユニークなファイル名）
	ext := filepath.Ext(file.Filename)
	s3Key := fmt.Sprintf("chat-files/%s/%s_%s%s",
		userUUID.String(),
		time.Now().Format("2006/01/02"),
		uuid.New().String(),
		ext)

	// S3にアップロード
	uploadInput := &s3.PutObjectInput{
		Bucket:        aws.String(h.bucketName),
		Key:           aws.String(s3Key),
		Body:          bytes.NewReader(fileBytes),
		ContentType:   aws.String(contentType),
		ContentLength: aws.Int64(file.Size),
		Metadata: map[string]string{
			"original-filename": file.Filename,
			"user-id":          userUUID.String(),
			"upload-time":      time.Now().Format(time.RFC3339),
		},
	}

	ctx := context.Background()
	_, err = h.s3Client.PutObject(ctx, uploadInput)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to upload file to S3")
	}

	// ファイルURL生成（S3の公開URL）
	fileURL := fmt.Sprintf("https://%s.s3.amazonaws.com/%s", h.bucketName, s3Key)

	response := models.FileUploadResponse{
		URL:      fileURL,
		Filename: file.Filename,
		Size:     file.Size,
		MimeType: contentType,
	}

	return c.JSON(http.StatusOK, response)
}

// GetPresignedURL プリサインドURL生成（プライベートファイル用）
// GET /api/files/presigned-url/:key
func (h *FileHandler) GetPresignedURL(c echo.Context) error {
	userUUID, err := getUserUUID(c)
	if err != nil {
		return err
	}

	s3Key := c.Param("key")
	if s3Key == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "File key is required")
	}

	// セキュリティチェック：ユーザーが自分のファイルのみアクセス可能
	if !strings.HasPrefix(s3Key, fmt.Sprintf("chat-files/%s/", userUUID.String())) {
		return echo.NewHTTPError(http.StatusForbidden, "Access denied")
	}

	// プリサインドURL生成（15分有効）
	ctx := context.Background()
	presignClient := s3.NewPresignClient(h.s3Client)

	request, err := presignClient.PresignGetObject(ctx, &s3.GetObjectInput{
		Bucket: aws.String(h.bucketName),
		Key:    aws.String(s3Key),
	}, func(opts *s3.PresignOptions) {
		opts.Expires = 15 * time.Minute
	})

	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to generate presigned URL")
	}

	return c.JSON(http.StatusOK, map[string]string{
		"presigned_url": request.URL,
		"expires_in":    "900", // 15分 = 900秒
	})
}

// DeleteFile ファイル削除
// DELETE /api/files/:key
func (h *FileHandler) DeleteFile(c echo.Context) error {
	userUUID, err := getUserUUID(c)
	if err != nil {
		return err
	}

	s3Key := c.Param("key")
	if s3Key == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "File key is required")
	}

	// セキュリティチェック：ユーザーが自分のファイルのみ削除可能
	if !strings.HasPrefix(s3Key, fmt.Sprintf("chat-files/%s/", userUUID.String())) {
		return echo.NewHTTPError(http.StatusForbidden, "Access denied")
	}

	// S3からファイル削除
	deleteInput := &s3.DeleteObjectInput{
		Bucket: aws.String(h.bucketName),
		Key:    aws.String(s3Key),
	}

	ctx := context.Background()
	_, err = h.s3Client.DeleteObject(ctx, deleteInput)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to delete file from S3")
	}

	return c.JSON(http.StatusOK, map[string]string{
		"message": "File deleted successfully",
	})
}