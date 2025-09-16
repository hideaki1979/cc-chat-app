package tests

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/google/uuid"
	"github.com/hideaki1979/cc-chat-app/apps/api/internal/handlers"
	"github.com/hideaki1979/cc-chat-app/apps/api/internal/middleware"
	"github.com/hideaki1979/cc-chat-app/apps/api/internal/models"
	"github.com/hideaki1979/cc-chat-app/apps/api/internal/services"
	"github.com/labstack/echo/v4"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
)

// MockAuthService AuthServiceのモック
type MockAuthService struct {
	mock.Mock
}

func (m *MockAuthService) RegisterUser(ctx context.Context, req models.RegisterRequest) (*models.AuthResult, error) {
	args := m.Called(ctx, req)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*models.AuthResult), args.Error(1)
}

func (m *MockAuthService) AuthenticateUser(ctx context.Context, req models.LoginRequest) (*models.AuthResult, error) {
	args := m.Called(ctx, req)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*models.AuthResult), args.Error(1)
}

func (m *MockAuthService) GetUserProfile(ctx context.Context, userID uuid.UUID) (*models.UserResponse, error) {
	args := m.Called(ctx, userID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*models.UserResponse), args.Error(1)
}

func (m *MockAuthService) UpdateUserProfile(ctx context.Context, userID uuid.UUID, req models.UpdateProfileRequest) (*models.UserResponse, error) {
	args := m.Called(ctx, userID, req)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*models.UserResponse), args.Error(1)
}

func (m *MockAuthService) SearchUsers(ctx context.Context, query string, currentUserID uuid.UUID) (*models.UserSearchResponse, error) {
	args := m.Called(ctx, query, currentUserID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*models.UserSearchResponse), args.Error(1)
}

func (m *MockAuthService) UploadUserAvatar(ctx context.Context, userID uuid.UUID, imageData []byte, contentType string) (*models.UserResponse, error) {
	args := m.Called(ctx, userID, imageData, contentType)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*models.UserResponse), args.Error(1)
}

// MockTokenService TokenServiceのモック
type MockTokenService struct {
	mock.Mock
}

func (m *MockTokenService) GenerateTokens(ctx context.Context, userID uuid.UUID, email string) (*models.TokenPair, error) {
	args := m.Called(ctx, userID, email)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*models.TokenPair), args.Error(1)
}

func (m *MockTokenService) RefreshTokens(ctx context.Context, refreshToken string) (*models.TokenPair, error) {
	args := m.Called(ctx, refreshToken)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*models.TokenPair), args.Error(1)
}

func (m *MockTokenService) ValidateAccessToken(tokenString string) (*models.TokenClaims, error) {
	args := m.Called(tokenString)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*models.TokenClaims), args.Error(1)
}

func (m *MockTokenService) ValidateRefreshToken(ctx context.Context, tokenString string) (*models.TokenClaims, error) {
	args := m.Called(ctx, tokenString)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*models.TokenClaims), args.Error(1)
}

func (m *MockTokenService) RevokeRefreshToken(ctx context.Context, userID uuid.UUID) error {
	args := m.Called(ctx, userID)
	return args.Error(0)
}

func TestAuthHandler_Register(t *testing.T) {
	tests := []struct {
		name           string
		requestBody    string
		setupMock      func(*MockAuthService, *MockTokenService)
		expectedStatus int
		checkCookie    bool
	}{
		{
			name: "successful registration",
			requestBody: `{
				"email": "test@example.com",
				"name": "testuser",
				"password": "Password123"
			}`,
			setupMock: func(authSvc *MockAuthService, tokenSvc *MockTokenService) {
				userID := uuid.New()
				result := &models.AuthResult{
					User: models.UserInfo{
						ID:    userID.String(),
						Email: "test@example.com",
						Name:  "testuser",
					},
					Tokens: &models.TokenPair{
						AccessToken:  "access-token",
						RefreshToken: "refresh-token",
					},
				}
				authSvc.On("RegisterUser", mock.Anything, mock.AnythingOfType("models.RegisterRequest")).Return(result, nil)
			},
			expectedStatus: http.StatusCreated,
			checkCookie:    true,
		},
		{
			name: "email already exists",
			requestBody: `{
				"email": "existing@example.com",
				"name": "testuser", 
				"password": "Password123"
			}`,
			setupMock: func(authSvc *MockAuthService, tokenSvc *MockTokenService) {
				authSvc.On("RegisterUser", mock.Anything, mock.AnythingOfType("models.RegisterRequest")).Return(nil, services.ErrEmailExists)
			},
			expectedStatus: http.StatusConflict,
			checkCookie:    false,
		},
		{
			name: "invalid request body",
			requestBody: `{
				"email": "invalid-email",
				"name": "",
				"password": "123"
			}`,
			setupMock: func(authSvc *MockAuthService, tokenSvc *MockTokenService) {
				// バリデーションエラーでもサービスが呼ばれる可能性があるため、エラーを返すモックを設定
				authSvc.On("RegisterUser", mock.Anything, mock.AnythingOfType("models.RegisterRequest")).Return(nil, errors.New("validation failed")).Maybe()
			},
			expectedStatus: http.StatusBadRequest,
			checkCookie:    false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Setup
			mockAuthService := new(MockAuthService)
			mockTokenService := new(MockTokenService)
			tt.setupMock(mockAuthService, mockTokenService)

			handler := handlers.NewAuthHandler(mockAuthService, mockTokenService)

			// Request
			e := echo.New()
			e.Validator = middleware.NewValidator()
			req := httptest.NewRequest(http.MethodPost, "/auth/register", strings.NewReader(tt.requestBody))
			req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
			rec := httptest.NewRecorder()
			c := e.NewContext(req, rec)

			// Execute
			err := handler.Register(c)

			// Assert
			if tt.expectedStatus < 400 {
				require.NoError(t, err)
			}
			assert.Equal(t, tt.expectedStatus, rec.Code)

			if tt.checkCookie {
				cookies := rec.Result().Cookies()
				found := false
				for _, cookie := range cookies {
					if cookie.Name == "refresh_token" {
						found = true
						assert.True(t, cookie.HttpOnly)
						assert.Equal(t, "/", cookie.Path)
						assert.Equal(t, "refresh-token", cookie.Value)
						break
					}
				}
				assert.True(t, found, "refresh_token cookie should be set")
			}

			mockAuthService.AssertExpectations(t)
			mockTokenService.AssertExpectations(t)
		})
	}
}

func TestAuthHandler_Login(t *testing.T) {
	tests := []struct {
		name           string
		requestBody    string
		setupMock      func(*MockAuthService, *MockTokenService)
		expectedStatus int
		checkCookie    bool
	}{
		{
			name: "successful login",
			requestBody: `{
				"email": "test@example.com",
				"password": "Password123"
			}`,
			setupMock: func(authSvc *MockAuthService, tokenSvc *MockTokenService) {
				userID := uuid.New()
				result := &models.AuthResult{
					User: models.UserInfo{
						ID:    userID.String(),
						Email: "test@example.com",
						Name:  "testuser",
					},
					Tokens: &models.TokenPair{
						AccessToken:  "access-token",
						RefreshToken: "refresh-token",
					},
				}
				authSvc.On("AuthenticateUser", mock.Anything, mock.AnythingOfType("models.LoginRequest")).Return(result, nil)
			},
			expectedStatus: http.StatusOK,
			checkCookie:    true,
		},
		{
			name: "invalid credentials",
			requestBody: `{
				"email": "test@example.com",
				"password": "wrongpassword"
			}`,
			setupMock: func(authSvc *MockAuthService, tokenSvc *MockTokenService) {
				authSvc.On("AuthenticateUser", mock.Anything, mock.AnythingOfType("models.LoginRequest")).Return(nil, services.ErrInvalidCredentials)
			},
			expectedStatus: http.StatusUnauthorized,
			checkCookie:    false,
		},
		{
			name: "malformed request",
			requestBody: `{
				"email": "invalid-email",
				"password": ""
			}`,
			setupMock: func(authSvc *MockAuthService, tokenSvc *MockTokenService) {
				// バリデーションエラーでもサービスが呼ばれる可能性があるため、エラーを返すモックを設定
				authSvc.On("AuthenticateUser", mock.Anything, mock.AnythingOfType("models.LoginRequest")).Return(nil, errors.New("validation failed")).Maybe()
			},
			expectedStatus: http.StatusBadRequest,
			checkCookie:    false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Setup
			mockAuthService := new(MockAuthService)
			mockTokenService := new(MockTokenService)
			tt.setupMock(mockAuthService, mockTokenService)

			handler := handlers.NewAuthHandler(mockAuthService, mockTokenService)

			// Request
			e := echo.New()
			e.Validator = middleware.NewValidator()
			req := httptest.NewRequest(http.MethodPost, "/auth/login", strings.NewReader(tt.requestBody))
			req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
			rec := httptest.NewRecorder()
			c := e.NewContext(req, rec)

			// Execute
			err := handler.Login(c)

			// Assert
			if tt.expectedStatus < 400 {
				require.NoError(t, err)
			}
			assert.Equal(t, tt.expectedStatus, rec.Code)

			if tt.checkCookie {
				cookies := rec.Result().Cookies()
				found := false
				for _, cookie := range cookies {
					if cookie.Name == "refresh_token" {
						found = true
						assert.True(t, cookie.HttpOnly)
						assert.Equal(t, "/", cookie.Path)
						assert.Equal(t, "refresh-token", cookie.Value)
						break
					}
				}
				assert.True(t, found, "refresh_token cookie should be set")
			}

			mockAuthService.AssertExpectations(t)
			mockTokenService.AssertExpectations(t)
		})
	}
}

func TestAuthHandler_RefreshToken(t *testing.T) {
	tests := []struct {
		name           string
		setupCookie    func(*http.Request)
		setupMock      func(*MockTokenService)
		expectedStatus int
		checkNewCookie bool
	}{
		{
			name: "successful token refresh",
			setupCookie: func(req *http.Request) {
				cookie := &http.Cookie{
					Name:  "refresh_token",
					Value: "valid-refresh-token",
				}
				req.AddCookie(cookie)
			},
			setupMock: func(tokenSvc *MockTokenService) {
				tokens := &models.TokenPair{
					AccessToken:  "new-access-token",
					RefreshToken: "new-refresh-token",
				}
				tokenSvc.On("RefreshTokens", mock.Anything, "valid-refresh-token").Return(tokens, nil)
			},
			expectedStatus: http.StatusOK,
			checkNewCookie: true,
		},
		{
			name: "missing refresh token cookie",
			setupCookie: func(req *http.Request) {
				// No cookie added
			},
			setupMock: func(tokenSvc *MockTokenService) {
				// No service call expected
			},
			expectedStatus: http.StatusUnauthorized,
			checkNewCookie: false,
		},
		{
			name: "invalid refresh token",
			setupCookie: func(req *http.Request) {
				cookie := &http.Cookie{
					Name:  "refresh_token",
					Value: "invalid-refresh-token",
				}
				req.AddCookie(cookie)
			},
			setupMock: func(tokenSvc *MockTokenService) {
				tokenSvc.On("RefreshTokens", mock.Anything, "invalid-refresh-token").Return(nil, errors.New("invalid token"))
			},
			expectedStatus: http.StatusUnauthorized,
			checkNewCookie: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Setup
			mockAuthService := new(MockAuthService)
			mockTokenService := new(MockTokenService)
			tt.setupMock(mockTokenService)

			handler := handlers.NewAuthHandler(mockAuthService, mockTokenService)

			// Request
			e := echo.New()
			e.Validator = middleware.NewValidator()
			req := httptest.NewRequest(http.MethodPost, "/auth/refresh", nil)
			tt.setupCookie(req)
			rec := httptest.NewRecorder()
			c := e.NewContext(req, rec)

			// Execute
			err := handler.RefreshToken(c)

			// Assert
			if tt.expectedStatus < 400 {
				require.NoError(t, err)
			}
			assert.Equal(t, tt.expectedStatus, rec.Code)

			if tt.checkNewCookie {
				cookies := rec.Result().Cookies()
				found := false
				for _, cookie := range cookies {
					if cookie.Name == "refresh_token" {
						found = true
						assert.True(t, cookie.HttpOnly)
						assert.Equal(t, "/", cookie.Path)
						assert.Equal(t, "new-refresh-token", cookie.Value)
						break
					}
				}
				assert.True(t, found, "new refresh_token cookie should be set")
			}

			mockAuthService.AssertExpectations(t)
			mockTokenService.AssertExpectations(t)
		})
	}
}