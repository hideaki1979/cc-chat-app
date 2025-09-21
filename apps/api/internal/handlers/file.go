package handlers

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"path/filepath"
	"strings"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	v4 "github.com/aws/aws-sdk-go-v2/aws/signer/v4"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/gabriel-vasile/mimetype"
	"github.com/google/uuid"
	"github.com/hideaki1979/cc-chat-app/apps/api/internal/models"
	"github.com/labstack/echo/v4"
)

// S3API S3操作用のインターフェース
// テスト容易性のため、必要な操作のみに限定
type S3API interface {
	PutObject(context.Context, *s3.PutObjectInput, ...func(*s3.Options)) (*s3.PutObjectOutput, error)
	DeleteObject(context.Context, *s3.DeleteObjectInput, ...func(*s3.Options)) (*s3.DeleteObjectOutput, error)
}

// S3Presigner プリサインドURL生成用のインターフェース
type S3Presigner interface {
	PresignGetObject(context.Context, *s3.GetObjectInput, ...func(*s3.PresignOptions)) (*v4.PresignedHTTPRequest, error)
}

// FileHandler ファイル関連のハンドラー
type FileHandler struct {
	s3         S3API
	presigner  S3Presigner
	bucketName string
}

// NewFileHandler インターフェースベースのコンストラクタ
func NewFileHandler(s3Client S3API, presigner S3Presigner, bucketName string) *FileHandler {
	return &FileHandler{
		s3:         s3Client,
		presigner:  presigner,
		bucketName: bucketName,
	}
}

// NewFileHandlerFromAWS AWSの *s3.Client からFileHandlerを作成（実運用向け）
func NewFileHandlerFromAWS(s3Client *s3.Client, bucketName string) *FileHandler {
	if s3Client == nil {
		return nil
	}
	return NewFileHandler(s3Client, s3.NewPresignClient(s3Client), bucketName)
}

const (
	maxFileSize = 10 * 1024 * 1024 // 10MB
)

// allowedMimeTypes 許可されたファイルタイプ
var allowedMimeTypes = map[string]bool{
	"image/jpeg":         true,
	"image/png":          true,
	"image/gif":          true,
	"image/webp":         true,
	"text/plain":         true,
	"application/pdf":    true,
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

	// MIMEタイプ検出（実データ優先）
	rs, ok := src.(io.ReadSeeker)
	if !ok {
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to prepare file reader")
	}

	// MIMEタイプを検出
	mType, err := mimetype.DetectReader(rs)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to detect file type")
	}

	// ファイルストリームを先頭に戻す
	if _, err := rs.Seek(0, io.SeekStart); err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to rewind file reader")
	}

	contentType := mType.String()
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
			"user-id":           userUUID.String(),
			"upload-time":       time.Now().Format(time.RFC3339),
		},
	}

	ctx := c.Request().Context()
	_, err = h.s3.PutObject(ctx, uploadInput)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to upload file to S3")
	}

	response := models.FileUploadResponse{
		URL:      s3Key,
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

	rawKey := c.Param("key")
	if rawKey == "" {
		rawKey = c.Param("*")
	}
	if rawKey == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "File key is required")
	}

	s3Key, decErr := url.PathUnescape(rawKey)
	if decErr != nil || s3Key == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "Invalid file key")
	}

	// セキュリティチェック：ユーザーが自分のファイルのみアクセス可能
	if !strings.HasPrefix(s3Key, fmt.Sprintf("chat-files/%s/", userUUID.String())) {
		return echo.NewHTTPError(http.StatusForbidden, "Access denied")
	}

	// プリサインドURL生成（15分有効）
	ctx := context.Background()

	request, err := h.presigner.PresignGetObject(ctx, &s3.GetObjectInput{
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

	rawKey := c.Param("key")
	if rawKey == "" {
		rawKey = c.Param("*")
	}
	if rawKey == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "File key is required")
	}

	// URLデコードして検証
    s3Key, decErr := url.PathUnescape(rawKey)
    if decErr != nil || s3Key == "" {
        return echo.NewHTTPError(http.StatusBadRequest, "Invalid file key")
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
	_, err = h.s3.DeleteObject(ctx, deleteInput)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to delete file from S3")
	}

	return c.JSON(http.StatusOK, map[string]string{
		"message": "File deleted successfully",
	})
}
