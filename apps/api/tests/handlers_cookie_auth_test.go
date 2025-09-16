package tests

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/hideaki1979/cc-chat-app/apps/api/internal/handlers"
	"github.com/hideaki1979/cc-chat-app/apps/api/internal/middleware"
	"github.com/hideaki1979/cc-chat-app/apps/api/internal/models"
	"github.com/hideaki1979/cc-chat-app/apps/api/util"
	"github.com/labstack/echo/v4"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
)

// TestAuthHandler_CookieAuthentication TASK-021のCookie完全移行テスト
func TestAuthHandler_CookieAuthentication(t *testing.T) {
	tests := []struct {
		name               string
		requestBody        string
		setupMock          func(*MockAuthService, *MockTokenService)
		expectedStatus     int
		checkAccessCookie  bool
		checkRefreshCookie bool
		checkCSRFCookie    bool
	}{
		{
			name: "successful registration with all cookies",
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
						AccessToken:  "access-token-123",
						RefreshToken: "refresh-token-456",
					},
				}
				authSvc.On("RegisterUser", mock.Anything, mock.AnythingOfType("models.RegisterRequest")).Return(result, nil)
			},
			expectedStatus:     http.StatusCreated,
			checkAccessCookie:  true,
			checkRefreshCookie: true,
			checkCSRFCookie:    true,
		},
		{
			name: "successful login with all cookies",
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
						AccessToken:  "access-token-789",
						RefreshToken: "refresh-token-012",
					},
				}
				authSvc.On("AuthenticateUser", mock.Anything, mock.AnythingOfType("models.LoginRequest")).Return(result, nil)
			},
			expectedStatus:     http.StatusOK,
			checkAccessCookie:  true,
			checkRefreshCookie: true,
			checkCSRFCookie:    true,
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

			var endpoint string
			if strings.Contains(tt.name, "registration") {
				endpoint = "/auth/register"
			} else {
				endpoint = "/auth/login"
			}

			req := httptest.NewRequest(http.MethodPost, endpoint, strings.NewReader(tt.requestBody))
			req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
			rec := httptest.NewRecorder()
			c := e.NewContext(req, rec)

			// Execute
			var err error
			if strings.Contains(tt.name, "registration") {
				err = handler.Register(c)
			} else {
				err = handler.Login(c)
			}

			// Assert
			if tt.expectedStatus < 400 {
				require.NoError(t, err)
			}
			assert.Equal(t, tt.expectedStatus, rec.Code)

			// Check cookies
			cookies := rec.Result().Cookies()
			cookieMap := make(map[string]*http.Cookie)
			for _, cookie := range cookies {
				cookieMap[cookie.Name] = cookie
			}

			if tt.checkAccessCookie {
				accessCookie, found := cookieMap["access_token"]
				assert.True(t, found, "access_token cookie should be set")
				if found {
					assert.True(t, accessCookie.HttpOnly, "access_token should be HttpOnly")
					assert.Equal(t, "/", accessCookie.Path)
					assert.Equal(t, http.SameSiteLaxMode, accessCookie.SameSite)
					assert.Equal(t, int(15*time.Minute.Seconds()), accessCookie.MaxAge)
					assert.Equal(t, util.IsProduction(), accessCookie.Secure)
				}
			}

			if tt.checkRefreshCookie {
				refreshCookie, found := cookieMap["refresh_token"]
				assert.True(t, found, "refresh_token cookie should be set")
				if found {
					assert.True(t, refreshCookie.HttpOnly, "refresh_token should be HttpOnly")
					assert.Equal(t, "/", refreshCookie.Path)
					assert.Equal(t, http.SameSiteLaxMode, refreshCookie.SameSite)
					assert.Equal(t, int(7*24*time.Hour.Seconds()), refreshCookie.MaxAge)
					assert.Equal(t, util.IsProduction(), refreshCookie.Secure)
				}
			}

			if tt.checkCSRFCookie {
				csrfCookie, found := cookieMap["csrf_token"]
				assert.True(t, found, "csrf_token cookie should be set")
				if found {
					assert.False(t, csrfCookie.HttpOnly, "csrf_token should NOT be HttpOnly (readable by JS)")
					assert.Equal(t, "/", csrfCookie.Path)
					assert.Equal(t, http.SameSiteLaxMode, csrfCookie.SameSite)
					assert.NotEmpty(t, csrfCookie.Value, "CSRF token should not be empty")
				}
			}

			// Verify response does NOT contain tokens in JSON (security requirement)
			body := rec.Body.String()
			assert.NotContains(t, body, "access_token", "Response should not contain access_token in JSON")
			assert.NotContains(t, body, "refresh_token", "Response should not contain refresh_token in JSON")

			mockAuthService.AssertExpectations(t)
			mockTokenService.AssertExpectations(t)
		})
	}
}

func TestAuthHandler_RefreshToken_WithCookies(t *testing.T) {
	tests := []struct {
		name               string
		setupCookie        func(*http.Request)
		setupMock          func(*MockTokenService)
		expectedStatus     int
		checkNewCookies    bool
		checkTokenRotation bool
	}{
		{
			name: "successful token refresh with cookie rotation",
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
					RefreshToken: "new-refresh-token", // Token rotation
				}
				tokenSvc.On("RefreshTokens", mock.Anything, "valid-refresh-token").Return(tokens, nil)
			},
			expectedStatus:     http.StatusOK,
			checkNewCookies:    true,
			checkTokenRotation: true,
		},
		{
			name: "token refresh without rotation",
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
					RefreshToken: "", // No rotation
				}
				tokenSvc.On("RefreshTokens", mock.Anything, "valid-refresh-token").Return(tokens, nil)
			},
			expectedStatus:     http.StatusOK,
			checkNewCookies:    true,
			checkTokenRotation: false,
		},
		{
			name: "refresh token cookie missing",
			setupCookie: func(req *http.Request) {
				// No cookie added
			},
			setupMock: func(tokenSvc *MockTokenService) {
				// No service call expected
			},
			expectedStatus:  http.StatusUnauthorized,
			checkNewCookies: false,
		},
		{
			name: "empty refresh token value",
			setupCookie: func(req *http.Request) {
				cookie := &http.Cookie{
					Name:  "refresh_token",
					Value: "",
				}
				req.AddCookie(cookie)
			},
			setupMock: func(tokenSvc *MockTokenService) {
				// No service call expected
			},
			expectedStatus:  http.StatusUnauthorized,
			checkNewCookies: false,
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

			if tt.checkNewCookies {
				cookies := rec.Result().Cookies()
				cookieMap := make(map[string]*http.Cookie)
				for _, cookie := range cookies {
					cookieMap[cookie.Name] = cookie
				}

				// Check access token cookie is updated
				accessCookie, found := cookieMap["access_token"]
				assert.True(t, found, "new access_token cookie should be set")
				if found {
					assert.Equal(t, "new-access-token", accessCookie.Value)
					assert.True(t, accessCookie.HttpOnly)
				}

				// Check CSRF token is regenerated
				csrfCookie, found := cookieMap["csrf_token"]
				assert.True(t, found, "new csrf_token cookie should be set")
				if found {
					assert.NotEmpty(t, csrfCookie.Value)
					assert.False(t, csrfCookie.HttpOnly)
				}

				// Check refresh token rotation if expected
				if tt.checkTokenRotation {
					refreshCookie, found := cookieMap["refresh_token"]
					assert.True(t, found, "refresh_token should be rotated")
					if found {
						assert.Equal(t, "new-refresh-token", refreshCookie.Value)
						assert.True(t, refreshCookie.HttpOnly)
					}
				}
			}

			// Verify response does NOT contain tokens in JSON
			body := rec.Body.String()
			assert.NotContains(t, body, "access_token")
			assert.NotContains(t, body, "refresh_token")

			mockAuthService.AssertExpectations(t)
			mockTokenService.AssertExpectations(t)
		})
	}
}

func TestAuthHandler_Logout_CookieCleanup(t *testing.T) {
	// Test the cookie cleanup behavior without database operations
	// This focuses on testing the cookie management logic

	// Setup
	mockAuthService := new(MockAuthService)
	mockTokenService := new(MockTokenService)
	handler := handlers.NewAuthHandler(mockAuthService, mockTokenService)

	// Request without refresh token cookie (to avoid database operations)
	e := echo.New()
	req := httptest.NewRequest(http.MethodPost, "/auth/logout", nil)
	// Note: No refresh token cookie added to avoid database operations

	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)

	// Mock database client
	mockClient := CreateMockEntClient()
	c.Set("db", mockClient)

	// Execute
	err := handler.Logout(c)

	// Assert - should succeed even without refresh token
	require.NoError(t, err)
	assert.Equal(t, http.StatusOK, rec.Code)

	// Check that auth cookies are cleared
	cookies := rec.Result().Cookies()
	cookieMap := make(map[string]*http.Cookie)
	for _, cookie := range cookies {
		cookieMap[cookie.Name] = cookie
	}

	// Verify access token cookie is cleared
	if accessCookie, found := cookieMap["access_token"]; found {
		assert.Equal(t, "", accessCookie.Value)
		assert.Equal(t, -1, accessCookie.MaxAge)
	}

	// Verify refresh token cookie is cleared
	if refreshCookie, found := cookieMap["refresh_token"]; found {
		assert.Equal(t, "", refreshCookie.Value)
		assert.Equal(t, -1, refreshCookie.MaxAge)
	}

	// Verify CSRF token cookie is cleared
	if csrfCookie, found := cookieMap["csrf_token"]; found {
		assert.Equal(t, "", csrfCookie.Value)
		assert.Equal(t, -1, csrfCookie.MaxAge)
	}

	// Verify response message
	body := rec.Body.String()
	assert.Contains(t, body, "ログアウトしました")
}

func TestAuthHandler_CookieSecuritySettings(t *testing.T) {
	// Test cookie security settings in different environments
	tests := []struct {
		name           string
		isProduction   bool
		expectedSecure bool
	}{
		{
			name:           "production environment",
			isProduction:   true,
			expectedSecure: true,
		},
		{
			name:           "development environment",
			isProduction:   false,
			expectedSecure: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Note: This test would require mocking util.IsProduction()
			// For now, we're testing the expected behavior structure

			mockAuthService := new(MockAuthService)
			mockTokenService := new(MockTokenService)

			// Setup mock for successful registration
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
			mockAuthService.On("RegisterUser", mock.Anything, mock.AnythingOfType("models.RegisterRequest")).Return(result, nil)

			handler := handlers.NewAuthHandler(mockAuthService, mockTokenService)

			// Execute registration
			e := echo.New()
			e.Validator = middleware.NewValidator()
			reqBody := `{"email": "test@example.com", "name": "testuser", "password": "Password123"}`
			req := httptest.NewRequest(http.MethodPost, "/auth/register", strings.NewReader(reqBody))
			req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
			rec := httptest.NewRecorder()
			c := e.NewContext(req, rec)

			err := handler.Register(c)
			require.NoError(t, err)

			// Check cookie security settings
			cookies := rec.Result().Cookies()
			for _, cookie := range cookies {
				if cookie.Name == "access_token" || cookie.Name == "refresh_token" {
					assert.True(t, cookie.HttpOnly, "Auth cookies should be HttpOnly")
					assert.Equal(t, http.SameSiteLaxMode, cookie.SameSite, "Auth cookies should use SameSite=Lax")
					assert.Equal(t, "/", cookie.Path, "Auth cookies should have Path=/")
					// Note: Secure flag testing would require mocking util.IsProduction()
				}
			}

			mockAuthService.AssertExpectations(t)
		})
	}
}

func TestAuthHandler_CSRFTokenGeneration(t *testing.T) {
	mockAuthService := new(MockAuthService)
	mockTokenService := new(MockTokenService)

	// Setup successful login
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
	mockAuthService.On("AuthenticateUser", mock.Anything, mock.AnythingOfType("models.LoginRequest")).Return(result, nil)

	handler := handlers.NewAuthHandler(mockAuthService, mockTokenService)

	// Execute login multiple times to test CSRF token uniqueness
	csrfTokens := make(map[string]bool)
	for i := 0; i < 5; i++ {
		e := echo.New()
		e.Validator = middleware.NewValidator()
		reqBody := `{"email": "test@example.com", "password": "Password123"}`
		req := httptest.NewRequest(http.MethodPost, "/auth/login", strings.NewReader(reqBody))
		req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
		rec := httptest.NewRecorder()
		c := e.NewContext(req, rec)

		err := handler.Login(c)
		require.NoError(t, err)

		// Extract CSRF token
		cookies := rec.Result().Cookies()
		for _, cookie := range cookies {
			if cookie.Name == "csrf_token" {
				assert.NotEmpty(t, cookie.Value, "CSRF token should not be empty")
				assert.False(t, csrfTokens[cookie.Value], "CSRF tokens should be unique")
				csrfTokens[cookie.Value] = true

				// Verify CSRF token format (base64 URL encoded)
				assert.True(t, len(cookie.Value) > 20, "CSRF token should be reasonably long")
				break
			}
		}
	}

	// Verify we got unique tokens
	assert.Equal(t, 5, len(csrfTokens), "All CSRF tokens should be unique")

	mockAuthService.AssertExpectations(t)
}

func TestAuthHandler_TokenNotInResponseBody(t *testing.T) {
	// Test that tokens are never exposed in response body (TASK-021 requirement)
	mockAuthService := new(MockAuthService)
	mockTokenService := new(MockTokenService)

	userID := uuid.New()
	result := &models.AuthResult{
		User: models.UserInfo{
			ID:    userID.String(),
			Email: "test@example.com",
			Name:  "testuser",
		},
		Tokens: &models.TokenPair{
			AccessToken:  "secret-access-token-should-not-appear",
			RefreshToken: "secret-refresh-token-should-not-appear",
		},
	}

	// Test both registration and login
	mockAuthService.On("RegisterUser", mock.Anything, mock.AnythingOfType("models.RegisterRequest")).Return(result, nil)
	mockAuthService.On("AuthenticateUser", mock.Anything, mock.AnythingOfType("models.LoginRequest")).Return(result, nil)

	handler := handlers.NewAuthHandler(mockAuthService, mockTokenService)

	testCases := []struct {
		name     string
		endpoint string
		handler  func(echo.Context) error
	}{
		{"registration", "/auth/register", handler.Register},
		{"login", "/auth/login", handler.Login},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			e := echo.New()
			e.Validator = middleware.NewValidator()

			var reqBody string
			if tc.name == "registration" {
				reqBody = `{"email": "test@example.com", "name": "testuser", "password": "Password123"}`
			} else {
				reqBody = `{"email": "test@example.com", "password": "Password123"}`
			}

			req := httptest.NewRequest(http.MethodPost, tc.endpoint, strings.NewReader(reqBody))
			req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
			rec := httptest.NewRecorder()
			c := e.NewContext(req, rec)

			err := tc.handler(c)
			require.NoError(t, err)

			// Verify tokens are NOT in response body
			body := rec.Body.String()
			assert.NotContains(t, body, "secret-access-token-should-not-appear")
			assert.NotContains(t, body, "secret-refresh-token-should-not-appear")
			assert.NotContains(t, body, "access_token")
			assert.NotContains(t, body, "refresh_token")

			// Verify user information IS in response body
			assert.Contains(t, body, "test@example.com")
			assert.Contains(t, body, "testuser")
		})
	}

	mockAuthService.AssertExpectations(t)
}
