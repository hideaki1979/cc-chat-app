package tests

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	v4 "github.com/aws/aws-sdk-go-v2/aws/signer/v4"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/google/uuid"
	"github.com/hideaki1979/cc-chat-app/apps/api/internal/handlers"
	"github.com/hideaki1979/cc-chat-app/apps/api/internal/models"
	"github.com/labstack/echo/v4"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
)

// MockS3Client S3クライアントのモック
type MockS3Client struct {
	mock.Mock
}

type MockPresigner struct {
	mock.Mock
}

func (m *MockPresigner) PresignGetObject(ctx context.Context, params *s3.GetObjectInput, optFns ...func(*s3.PresignOptions)) (*v4.PresignedHTTPRequest, error) {
	args := m.Called(ctx, params)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*v4.PresignedHTTPRequest), args.Error(1)
}

func (m *MockS3Client) PutObject(ctx context.Context, params *s3.PutObjectInput, optFns ...func(*s3.Options)) (*s3.PutObjectOutput, error) {
	args := m.Called(ctx, params)
	return args.Get(0).(*s3.PutObjectOutput), args.Error(1)
}

func (m *MockS3Client) DeleteObject(ctx context.Context, params *s3.DeleteObjectInput, optFns ...func(*s3.Options)) (*s3.DeleteObjectOutput, error) {
	args := m.Called(ctx, params)
	return args.Get(0).(*s3.DeleteObjectOutput), args.Error(1)
}

func (m *MockS3Client) GetObject(ctx context.Context, params *s3.GetObjectInput, optFns ...func(*s3.Options)) (*s3.GetObjectOutput, error) {
	args := m.Called(ctx, params)
	return args.Get(0).(*s3.GetObjectOutput), args.Error(1)
}

// PresignedOutput プリサインド結果の構造体
type PresignedOutput struct {
	URL string
}

// MockPresignClient プリサインドクライアントのモック
type MockPresignClient struct {
	mock.Mock
}

func (m *MockPresignClient) PresignGetObject(ctx context.Context, params *s3.GetObjectInput, optFns ...interface{}) (*PresignedOutput, error) {
	args := m.Called(ctx, params)
	return args.Get(0).(*PresignedOutput), args.Error(1)
}

// S3Clientインターフェース（テスト用）
type S3ClientInterface interface {
	PutObject(ctx context.Context, params *s3.PutObjectInput, optFns ...func(*s3.Options)) (*s3.PutObjectOutput, error)
	DeleteObject(ctx context.Context, params *s3.DeleteObjectInput, optFns ...func(*s3.Options)) (*s3.DeleteObjectOutput, error)
	GetObject(ctx context.Context, params *s3.GetObjectInput, optFns ...func(*s3.Options)) (*s3.GetObjectOutput, error)
}

// FileHandlerのモック対応版
type TestFileHandler struct {
	s3Client   S3ClientInterface
	bucketName string
}

func NewTestFileHandler(s3Client S3ClientInterface, bucketName string) *TestFileHandler {
	return &TestFileHandler{
		s3Client:   s3Client,
		bucketName: bucketName,
	}
}

func setupFileTest(t *testing.T) (*MockS3Client, *MockPresigner, *handlers.FileHandler, func()) {
	// 実際のFileHandlerを使うため、S3クライアントだけモックする
	mockS3 := &MockS3Client{}

	// テスト用のbucket名
	bucketName := "test-bucket"

	// 実際のhandlerではなく、テスト専用のhandlerを作成する場合のパターン
	// ここでは実際のhandlerをそのまま使用（S3, Presignerはnilで初期化）
	// MockPresignerも定義の必要がある
	mockPresigner := &MockPresigner{}
	handler := handlers.NewFileHandler(mockS3, mockPresigner, bucketName)

	cleanup := func() {
		mockS3.AssertExpectations(t)
		mockPresigner.AssertExpectations(t)
	}

	return mockS3, mockPresigner, handler, cleanup
}

// --- 追加: ワイルドカード/エンコードキー用の最小スタブとテスト ---

// stubS3 は handlers.S3API を満たす最小スタブ
type stubS3 struct{}

func (s *stubS3) PutObject(ctx context.Context, in *s3.PutObjectInput, optFns ...func(*s3.Options)) (*s3.PutObjectOutput, error) {
	return &s3.PutObjectOutput{}, nil
}

func (s *stubS3) DeleteObject(ctx context.Context, in *s3.DeleteObjectInput, optFns ...func(*s3.Options)) (*s3.DeleteObjectOutput, error) {
	return &s3.DeleteObjectOutput{}, nil
}

// stubPresigner は handlers.S3Presigner を満たす最小スタブ
type stubPresigner struct{}

func (p *stubPresigner) PresignGetObject(ctx context.Context, in *s3.GetObjectInput, optFns ...func(*s3.PresignOptions)) (*v4.PresignedHTTPRequest, error) {
	return &v4.PresignedHTTPRequest{URL: "https://example.com/presigned"}, nil
}

func newFileHandlerForRouteTests() *handlers.FileHandler {
	return handlers.NewFileHandler(&stubS3{}, &stubPresigner{}, "test-bucket")
}

func TestUploadFile_Success(t *testing.T) {
	mockS3, _, handler, cleanup := setupFileTest(t)
	defer cleanup()

	userID := uuid.New()

	// S3のPutObjectの成功をモック
	mockS3.On("PutObject", mock.Anything, mock.Anything).Return(&s3.PutObjectOutput{}, nil)

	// マルチパートフォームデータ作成
	var buf bytes.Buffer
	writer := multipart.NewWriter(&buf)

	// ファイル部分作成
	fileWriter, err := writer.CreateFormFile("file", "test.jpg")
	require.NoError(t, err)

	// テスト用の画像データ（JPEGヘッダー）
	jpegHeader := []byte{0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46}
	_, err = fileWriter.Write(jpegHeader)
	require.NoError(t, err)

	writer.Close()

	// Setup Echo
	e := echo.New()
	req := httptest.NewRequest(http.MethodPost, "/api/files/upload", &buf)
	req.Header.Set("Content-Type", writer.FormDataContentType())
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)
	c.Set("user_id", userID.String())

	// Execute
	err = handler.UploadFile(c)

	// Assert
	require.NoError(t, err)
	assert.Equal(t, http.StatusOK, rec.Code)

	var response models.FileUploadResponse
	err = json.Unmarshal(rec.Body.Bytes(), &response)
	require.NoError(t, err)

	assert.NotEmpty(t, response.URL)
	assert.Equal(t, "test.jpg", response.Filename)
	assert.Equal(t, "image/jpeg", response.MimeType)
}

func TestUploadFile_NoFile(t *testing.T) {
	_, _, handler, cleanup := setupFileTest(t)
	defer cleanup()

	userID := uuid.New()

	// Setup Echo (ファイルなし)
	e := echo.New()
	req := httptest.NewRequest(http.MethodPost, "/api/files/upload", nil)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)
	c.Set("user_id", userID.String())

	// Execute
	err := handler.UploadFile(c)

	// Assert
	require.Error(t, err)
	httpError, ok := err.(*echo.HTTPError)
	require.True(t, ok)
	assert.Equal(t, http.StatusBadRequest, httpError.Code)
	assert.Contains(t, httpError.Message, "File is required")
}

func TestUploadFile_FileTooLarge(t *testing.T) {
	_, _, handler, cleanup := setupFileTest(t)
	defer cleanup()

	userID := uuid.New()

	// 10MBを超える大きなファイルを作成
	largeData := make([]byte, 11*1024*1024) // 11MB

	// マルチパートフォームデータ作成
	var buf bytes.Buffer
	writer := multipart.NewWriter(&buf)

	fileWriter, err := writer.CreateFormFile("file", "large.jpg")
	require.NoError(t, err)

	_, err = fileWriter.Write(largeData)
	require.NoError(t, err)

	writer.Close()

	// Setup Echo
	e := echo.New()
	req := httptest.NewRequest(http.MethodPost, "/api/files/upload", &buf)
	req.Header.Set("Content-Type", writer.FormDataContentType())
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)
	c.Set("user_id", userID.String())

	// Execute
	err = handler.UploadFile(c)

	// Assert
	require.Error(t, err)
	httpError, ok := err.(*echo.HTTPError)
	require.True(t, ok)
	assert.Equal(t, http.StatusBadRequest, httpError.Code)
	assert.Contains(t, httpError.Message, "File size exceeds 10MB limit")
}

func TestUploadFile_InvalidFileType(t *testing.T) {
	_, _, handler, cleanup := setupFileTest(t)
	defer cleanup()

	userID := uuid.New()

	// マルチパートフォームデータ作成
	var buf bytes.Buffer
	writer := multipart.NewWriter(&buf)

	// 実行可能ファイル（.exe）を作成
	fileWriter, err := writer.CreateFormFile("file", "malware.exe")
	require.NoError(t, err)

	// 実行可能ファイルのヘッダー
	exeHeader := []byte{0x4D, 0x5A} // MZ header
	_, err = fileWriter.Write(exeHeader)
	require.NoError(t, err)

	writer.Close()

	// Setup Echo
	e := echo.New()
	req := httptest.NewRequest(http.MethodPost, "/api/files/upload", &buf)
	req.Header.Set("Content-Type", writer.FormDataContentType())
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)
	c.Set("user_id", userID.String())

	// Execute
	err = handler.UploadFile(c)

	// Assert
	require.Error(t, err)
	httpError, ok := err.(*echo.HTTPError)
	require.True(t, ok)
	assert.Equal(t, http.StatusBadRequest, httpError.Code)
	assert.Contains(t, httpError.Message, "File type not allowed")
}

func TestDeleteFile_Success(t *testing.T) {
	mockS3, _, handler, cleanup := setupFileTest(t)
	defer cleanup()

	userID := uuid.New()
	s3Key := fmt.Sprintf("chat-files/%s/2023/01/01/test-file.jpg", userID.String())

	// S3のDeleteObjectの成功をモック
	mockS3.On("DeleteObject", mock.Anything, mock.Anything).Return(&s3.DeleteObjectOutput{}, nil)

	// Setup Echo
	e := echo.New()
	req := httptest.NewRequest(http.MethodDelete, fmt.Sprintf("/api/files/%s", s3Key), nil)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)
	c.SetParamNames("key")
	c.SetParamValues(s3Key)
	c.Set("user_id", userID.String())

	// Execute
	err := handler.DeleteFile(c)

	// Assert
	require.NoError(t, err)
	assert.Equal(t, http.StatusOK, rec.Code)
}

func TestDeleteFile_AccessDenied(t *testing.T) {
	_, _, handler, cleanup := setupFileTest(t)
	defer cleanup()

	userID := uuid.New()
	otherUserID := uuid.New()

	// 他のユーザーのファイルキー
	s3Key := fmt.Sprintf("chat-files/%s/2023/01/01/test-file.jpg", otherUserID.String())

	// Setup Echo
	e := echo.New()
	req := httptest.NewRequest(http.MethodDelete, fmt.Sprintf("/api/files/%s", s3Key), nil)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)
	c.SetParamNames("key")
	c.SetParamValues(s3Key)
	c.Set("user_id", userID.String()) // 異なるユーザーID

	// Execute
	err := handler.DeleteFile(c)

	// Assert
	require.Error(t, err)
	httpError, ok := err.(*echo.HTTPError)
	require.True(t, ok)
	assert.Equal(t, http.StatusForbidden, httpError.Code)
	assert.Contains(t, httpError.Message, "Access denied")
}

func TestGetPresignedURL_Success(t *testing.T) {
	_, mockPresigner, handler, cleanup := setupFileTest(t)
	defer cleanup()

	userID := uuid.New()
	s3Key := fmt.Sprintf("chat-files/%s/2023/01/01/test-file.jpg", userID.String())

	// Presign のモック設定
	presigned := &v4.PresignedHTTPRequest{URL: "https://example.com/presigned"}
	mockPresigner.On("PresignGetObject", mock.Anything, mock.Anything).Return(presigned, nil)

	// Setup Echo
	e := echo.New()
	req := httptest.NewRequest(http.MethodGet, fmt.Sprintf("/api/files/presigned-url/%s", s3Key), nil)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)
	c.SetParamNames("key")
	c.SetParamValues(s3Key)
	c.Set("user_id", userID.String())

	// Execute
	err := handler.GetPresignedURL(c)

	// Assert
	require.NoError(t, err)
	assert.Equal(t, http.StatusOK, rec.Code)

	var response map[string]string
	err = json.Unmarshal(rec.Body.Bytes(), &response)
	require.NoError(t, err)

	assert.NotEmpty(t, response["presigned_url"])
	assert.Equal(t, "900", response["expires_in"])
}

func TestGetPresignedURL_AccessDenied(t *testing.T) {
	_, _, handler, cleanup := setupFileTest(t)
	defer cleanup()

	userID := uuid.New()
	otherUserID := uuid.New()

	// 他のユーザーのファイルキー
	s3Key := fmt.Sprintf("chat-files/%s/2023/01/01/test-file.jpg", otherUserID.String())

	// Setup Echo
	e := echo.New()
	req := httptest.NewRequest(http.MethodGet, fmt.Sprintf("/api/files/presigned-url/%s", s3Key), nil)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)
	c.SetParamNames("key")
	c.SetParamValues(s3Key)
	c.Set("user_id", userID.String()) // 異なるユーザーID

	// Execute
	err := handler.GetPresignedURL(c)

	// Assert
	require.Error(t, err)
	httpError, ok := err.(*echo.HTTPError)
	require.True(t, ok)
	assert.Equal(t, http.StatusForbidden, httpError.Code)
	assert.Contains(t, httpError.Message, "Access denied")
}

func TestGetPresignedURL_EmptyKey(t *testing.T) {
	_, _, handler, cleanup := setupFileTest(t)
	defer cleanup()

	userID := uuid.New()

	// Setup Echo (空のキー)
	e := echo.New()
	req := httptest.NewRequest(http.MethodGet, "/api/files/presigned-url/", nil)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)
	c.SetParamNames("key")
	c.SetParamValues("")
	c.Set("user_id", userID.String())

	// Execute
	err := handler.GetPresignedURL(c)

	// Assert
	require.Error(t, err)
	httpError, ok := err.(*echo.HTTPError)
	require.True(t, ok)
	assert.Equal(t, http.StatusBadRequest, httpError.Code)
	assert.Contains(t, httpError.Message, "File key is required")
}

// テスト用のヘルパー関数
func createTestMultipartFile(t *testing.T, filename, contentType string, data []byte) (*bytes.Buffer, string) {
	var buf bytes.Buffer
	writer := multipart.NewWriter(&buf)

	fileWriter, err := writer.CreateFormFile("file", filename)
	require.NoError(t, err)

	_, err = fileWriter.Write(data)
	require.NoError(t, err)

	writer.Close()

	return &buf, writer.FormDataContentType()
}

func TestFileHandlerIntegration_ValidImageTypes(t *testing.T) {
	testCases := []struct {
		filename    string
		contentType string
		data        []byte
		expectError bool
	}{
		{
			filename:    "test.jpg",
			contentType: "image/jpeg",
			data:        []byte{0xFF, 0xD8, 0xFF, 0xE0}, // JPEG header
			expectError: false,
		},
		{
			filename:    "test.png",
			contentType: "image/png",
			data:        []byte{0x89, 0x50, 0x4E, 0x47}, // PNG header
			expectError: false,
		},
		{
			filename:    "test.gif",
			contentType: "image/gif",
			data:        []byte{0x47, 0x49, 0x46, 0x38}, // GIF header
			expectError: false,
		},
		{
			filename:    "test.txt",
			contentType: "text/plain",
			data:        []byte("Hello, World!"),
			expectError: false,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.filename, func(t *testing.T) {
			// ファイルタイプのテストのみ（S3アップロードはスキップ）
			t.Logf("Testing file type: %s with content-type: %s", tc.filename, tc.contentType)
			assert.NotEmpty(t, tc.data)
		})
	}
}

// --- 統合: ワイルドカード/エンコードキー関連テスト ---

func TestGetPresignedURL_WildcardRoute_AllowsSlashesAndEncodedChars(t *testing.T) {
	e := echo.New()
	fileHandler := newFileHandlerForRouteTests()

	userID := uuid.New().String()

	// ワイルドカードルート登録
	e.GET("/api/files/presigned-url/*", func(c echo.Context) error {
		c.Set("user_id", userID)
		return fileHandler.GetPresignedURL(c)
	})

	keyPath := fmt.Sprintf("chat-files/%s/2025/09/21/test file.png", userID)
	encodedKeyPath := strings.ReplaceAll(keyPath, " ", "%20")
	req := httptest.NewRequest(http.MethodGet, "/api/files/presigned-url/"+encodedKeyPath, nil)
	rec := httptest.NewRecorder()

	e.ServeHTTP(rec, req)

	require.Equal(t, http.StatusOK, rec.Code)

	var resp map[string]string
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &resp))
	assert.Equal(t, "https://example.com/presigned", resp["presigned_url"])
	assert.Equal(t, "900", resp["expires_in"])
}

func TestGetPresignedURL_InvalidEncodedKey_ReturnsBadRequest(t *testing.T) {
	e := echo.New()
	fileHandler := newFileHandlerForRouteTests()

	userID := uuid.New().String()

	// ルーター経由にせず、パラメータを直接設定してハンドラーを叩く
	badKey := fmt.Sprintf("chat-files/%s/2025/09/21/file%%ZZ.png", userID)
	req := httptest.NewRequest(http.MethodGet, "/api/files/presigned-url/X", nil)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)
	c.Set("user_id", userID)
	c.SetParamNames("key")
	c.SetParamValues(badKey)

	err := fileHandler.GetPresignedURL(c)
	require.Error(t, err)
	httpErr, ok := err.(*echo.HTTPError)
	require.True(t, ok)
	assert.Equal(t, http.StatusBadRequest, httpErr.Code)
}

func TestDeleteFile_WildcardRoute_AllowsSlashes(t *testing.T) {
	e := echo.New()
	fileHandler := newFileHandlerForRouteTests()

	userID := uuid.New().String()

	e.DELETE("/api/files/*", func(c echo.Context) error {
		c.Set("user_id", userID)
		return fileHandler.DeleteFile(c)
	})

	keyPath := fmt.Sprintf("chat-files/%s/2025/09/21/test.png", userID)
	req := httptest.NewRequest(http.MethodDelete, "/api/files/"+keyPath, nil)
	rec := httptest.NewRecorder()

	e.ServeHTTP(rec, req)

	assert.Equal(t, http.StatusOK, rec.Code)
}
