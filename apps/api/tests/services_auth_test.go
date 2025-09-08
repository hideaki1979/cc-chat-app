package tests

import (
	"context"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/hideaki1979/cc-chat-app/apps/api/ent"
	"github.com/hideaki1979/cc-chat-app/apps/api/internal/models"
	"github.com/hideaki1979/cc-chat-app/apps/api/internal/services"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	"golang.org/x/crypto/bcrypt"
)

// MockUserRepository UserRepositoryのモック
type MockUserRepository struct {
	mock.Mock
}

func (m *MockUserRepository) GetUserByEmail(ctx context.Context, email string) (*ent.User, error) {
	args := m.Called(ctx, email)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*ent.User), args.Error(1)
}

func (m *MockUserRepository) GetUserByID(ctx context.Context, userID uuid.UUID) (*ent.User, error) {
	args := m.Called(ctx, userID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*ent.User), args.Error(1)
}

func (m *MockUserRepository) CreateUser(ctx context.Context, req models.RegisterRequest) (*ent.User, error) {
	args := m.Called(ctx, req)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*ent.User), args.Error(1)
}

func (m *MockUserRepository) UpdateUser(ctx context.Context, userID uuid.UUID, req models.UpdateProfileRequest) (*ent.User, error) {
	args := m.Called(ctx, userID, req)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*ent.User), args.Error(1)
}

func (m *MockUserRepository) UpdateUserAvatar(ctx context.Context, userID uuid.UUID, avatarURL string) (*ent.User, error) {
	args := m.Called(ctx, userID, avatarURL)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*ent.User), args.Error(1)
}

func (m *MockUserRepository) SearchUsersByName(ctx context.Context, query string, excludeUserID uuid.UUID) ([]*ent.User, error) {
	args := m.Called(ctx, query, excludeUserID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]*ent.User), args.Error(1)
}

func (m *MockUserRepository) UpdateRefreshToken(ctx context.Context, userID uuid.UUID, tokenHash []byte, expiresAt time.Time) error {
	args := m.Called(ctx, userID, tokenHash, expiresAt)
	return args.Error(0)
}

func (m *MockUserRepository) GetUserByRefreshTokenHash(ctx context.Context, tokenHash []byte) (*ent.User, error) {
	args := m.Called(ctx, tokenHash)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*ent.User), args.Error(1)
}

func (m *MockUserRepository) RevokeUserRefreshToken(ctx context.Context, userID uuid.UUID) error {
	args := m.Called(ctx, userID)
	return args.Error(0)
}

// MockTokenServiceForAuth TokenServiceのモック（AuthService用）
type MockTokenServiceForAuth struct {
	mock.Mock
}

func (m *MockTokenServiceForAuth) GenerateTokens(ctx context.Context, userID uuid.UUID, email string) (*models.TokenPair, error) {
	args := m.Called(ctx, userID, email)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*models.TokenPair), args.Error(1)
}

func (m *MockTokenServiceForAuth) RefreshTokens(ctx context.Context, refreshToken string) (*models.TokenPair, error) {
	args := m.Called(ctx, refreshToken)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*models.TokenPair), args.Error(1)
}

func (m *MockTokenServiceForAuth) ValidateAccessToken(tokenString string) (*models.TokenClaims, error) {
	args := m.Called(tokenString)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*models.TokenClaims), args.Error(1)
}

func (m *MockTokenServiceForAuth) ValidateRefreshToken(ctx context.Context, tokenString string) (*models.TokenClaims, error) {
	args := m.Called(ctx, tokenString)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*models.TokenClaims), args.Error(1)
}

func (m *MockTokenServiceForAuth) RevokeRefreshToken(ctx context.Context, userID uuid.UUID) error {
	args := m.Called(ctx, userID)
	return args.Error(0)
}

func TestAuthService_RegisterUser(t *testing.T) {
	tests := []struct {
		name      string
		request   models.RegisterRequest
		setupMock func(*MockUserRepository, *MockTokenServiceForAuth)
		expectErr bool
		errType   error
	}{
		{
			name: "successful registration",
			request: models.RegisterRequest{
				Name:     "testuser",
				Email:    "test@example.com",
				Password: "Password123",
			},
			setupMock: func(userRepo *MockUserRepository, tokenSvc *MockTokenServiceForAuth) {
				// 重複チェック（存在しない）
				userRepo.On("GetUserByEmail", mock.Anything, "test@example.com").Return(nil, services.ErrUserNotFound)
				
				// ユーザー作成
				newUser := &ent.User{
					ID:    uuid.New(),
					Name:  "testuser",
					Email: "test@example.com",
				}
				userRepo.On("CreateUser", mock.Anything, mock.AnythingOfType("models.RegisterRequest")).Return(newUser, nil)
				
				// トークン生成
				tokens := &models.TokenPair{
					AccessToken:  "access-token",
					RefreshToken: "refresh-token",
				}
				tokenSvc.On("GenerateTokens", mock.Anything, newUser.ID, "test@example.com").Return(tokens, nil)
			},
			expectErr: false,
		},
		{
			name: "email already exists",
			request: models.RegisterRequest{
				Name:     "testuser",
				Email:    "existing@example.com",
				Password: "Password123",
			},
			setupMock: func(userRepo *MockUserRepository, tokenSvc *MockTokenServiceForAuth) {
				existingUser := &ent.User{
					ID:    uuid.New(),
					Name:  "existing",
					Email: "existing@example.com",
				}
				userRepo.On("GetUserByEmail", mock.Anything, "existing@example.com").Return(existingUser, nil)
			},
			expectErr: true,
			errType:   services.ErrEmailExists,
		},
		{
			name: "invalid request data",
			request: models.RegisterRequest{
				Name:     "", // 無効（空文字）
				Email:    "test@example.com",
				Password: "Password123",
			},
			setupMock: func(userRepo *MockUserRepository, tokenSvc *MockTokenServiceForAuth) {
				// バリデーションエラーのためモックは呼ばれない
			},
			expectErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Setup
			mockUserRepo := new(MockUserRepository)
			mockTokenSvc := new(MockTokenServiceForAuth)
			tt.setupMock(mockUserRepo, mockTokenSvc)

			authService := services.NewAuthService(nil, mockUserRepo, mockTokenSvc) // clientはnilでOK

			// Execute
			ctx := context.Background()
			result, err := authService.RegisterUser(ctx, tt.request)

			// Assert
			if tt.expectErr {
				assert.Error(t, err)
				if tt.errType != nil {
					assert.ErrorIs(t, err, tt.errType)
				}
				assert.Nil(t, result)
			} else {
				require.NoError(t, err)
				require.NotNil(t, result)
				assert.NotNil(t, result.User)
				assert.NotNil(t, result.Tokens)
				assert.Equal(t, "testuser", result.User.Name)
				assert.Equal(t, "test@example.com", result.User.Email)
				assert.Equal(t, "access-token", result.Tokens.AccessToken)
				assert.Equal(t, "refresh-token", result.Tokens.RefreshToken)
			}

			mockUserRepo.AssertExpectations(t)
			mockTokenSvc.AssertExpectations(t)
		})
	}
}

func TestAuthService_AuthenticateUser(t *testing.T) {
	tests := []struct {
		name      string
		request   models.LoginRequest
		setupMock func(*MockUserRepository, *MockTokenServiceForAuth)
		expectErr bool
	}{
		{
			name: "successful authentication",
			request: models.LoginRequest{
				Email:    "test@example.com",
				Password: "Password123",
			},
			setupMock: func(userRepo *MockUserRepository, tokenSvc *MockTokenServiceForAuth) {
				// BCryptでハッシュ化されたパスワード（"Password123"）
				hashedPassword, _ := bcrypt.GenerateFromPassword([]byte("Password123"), bcrypt.DefaultCost)
				
				user := &ent.User{
					ID:           uuid.New(),
					Name:         "testuser",
					Email:        "test@example.com",
					PasswordHash: hashedPassword,
				}
				userRepo.On("GetUserByEmail", mock.Anything, "test@example.com").Return(user, nil)
				
				// トークン生成
				tokens := &models.TokenPair{
					AccessToken:  "access-token",
					RefreshToken: "refresh-token",
				}
				tokenSvc.On("GenerateTokens", mock.Anything, user.ID, "test@example.com").Return(tokens, nil)
			},
			expectErr: false,
		},
		{
			name: "user not found",
			request: models.LoginRequest{
				Email:    "nonexistent@example.com",
				Password: "Password123",
			},
			setupMock: func(userRepo *MockUserRepository, tokenSvc *MockTokenServiceForAuth) {
				userRepo.On("GetUserByEmail", mock.Anything, "nonexistent@example.com").Return(nil, services.ErrUserNotFound)
			},
			expectErr: true,
		},
		{
			name: "invalid password",
			request: models.LoginRequest{
				Email:    "test@example.com",
				Password: "wrongpassword",
			},
			setupMock: func(userRepo *MockUserRepository, tokenSvc *MockTokenServiceForAuth) {
				hashedPassword, _ := bcrypt.GenerateFromPassword([]byte("Password123"), bcrypt.DefaultCost)
				
				user := &ent.User{
					ID:           uuid.New(),
					Name:         "testuser",
					Email:        "test@example.com",
					PasswordHash: hashedPassword,
				}
				userRepo.On("GetUserByEmail", mock.Anything, "test@example.com").Return(user, nil)
			},
			expectErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Setup
			mockUserRepo := new(MockUserRepository)
			mockTokenSvc := new(MockTokenServiceForAuth)
			tt.setupMock(mockUserRepo, mockTokenSvc)

			authService := services.NewAuthService(nil, mockUserRepo, mockTokenSvc)

			// Execute
			ctx := context.Background()
			result, err := authService.AuthenticateUser(ctx, tt.request)

			// Assert
			if tt.expectErr {
				assert.Error(t, err)
				assert.Nil(t, result)
			} else {
				require.NoError(t, err)
				require.NotNil(t, result)
				assert.NotNil(t, result.User)
				assert.NotNil(t, result.Tokens)
				assert.Equal(t, "testuser", result.User.Name)
				assert.Equal(t, "test@example.com", result.User.Email)
			}

			mockUserRepo.AssertExpectations(t)
			mockTokenSvc.AssertExpectations(t)
		})
	}
}

func TestAuthService_GetUserProfile(t *testing.T) {
	userID := uuid.New()

	tests := []struct {
		name      string
		userID    uuid.UUID
		setupMock func(*MockUserRepository)
		expectErr bool
	}{
		{
			name:   "successful profile retrieval",
			userID: userID,
			setupMock: func(userRepo *MockUserRepository) {
				user := &ent.User{
					ID:    userID,
					Name:  "testuser",
					Email: "test@example.com",
				}
				userRepo.On("GetUserByID", mock.Anything, userID).Return(user, nil)
			},
			expectErr: false,
		},
		{
			name:   "user not found",
			userID: userID,
			setupMock: func(userRepo *MockUserRepository) {
				userRepo.On("GetUserByID", mock.Anything, userID).Return(nil, services.ErrUserNotFound)
			},
			expectErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Setup
			mockUserRepo := new(MockUserRepository)
			mockTokenSvc := new(MockTokenServiceForAuth)
			tt.setupMock(mockUserRepo)

			authService := services.NewAuthService(nil, mockUserRepo, mockTokenSvc)

			// Execute
			ctx := context.Background()
			result, err := authService.GetUserProfile(ctx, tt.userID)

			// Assert
			if tt.expectErr {
				assert.Error(t, err)
				assert.Nil(t, result)
			} else {
				require.NoError(t, err)
				require.NotNil(t, result)
				assert.Equal(t, userID.String(), result.ID)
				assert.Equal(t, "testuser", result.Name)
				assert.Equal(t, "test@example.com", result.Email)
			}

			mockUserRepo.AssertExpectations(t)
			mockTokenSvc.AssertExpectations(t)
		})
	}
}

func TestAuthService_UploadUserAvatar(t *testing.T) {
	userID := uuid.New()

	tests := []struct {
		name        string
		userID      uuid.UUID
		imageData   []byte
		contentType string
		setupMock   func(*MockUserRepository)
		expectErr   bool
	}{
		{
			name:        "successful avatar upload",
			userID:      userID,
			imageData:   make([]byte, 1024), // 1KB
			contentType: "image/jpeg",
			setupMock: func(userRepo *MockUserRepository) {
				updatedUser := &ent.User{
					ID:    userID,
					Name:  "testuser",
					Email: "test@example.com",
				}
				userRepo.On("UpdateUserAvatar", mock.Anything, userID, mock.AnythingOfType("string")).Return(updatedUser, nil)
			},
			expectErr: false,
		},
		{
			name:        "file too large",
			userID:      userID,
			imageData:   make([]byte, 6*1024*1024), // 6MB (exceeds 5MB limit)
			contentType: "image/jpeg",
			setupMock: func(userRepo *MockUserRepository) {
				// リポジトリは呼ばれない
			},
			expectErr: true,
		},
		{
			name:        "unsupported file type",
			userID:      userID,
			imageData:   make([]byte, 1024),
			contentType: "image/bmp", // 未サポート
			setupMock: func(userRepo *MockUserRepository) {
				// リポジトリは呼ばれない
			},
			expectErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Setup
			mockUserRepo := new(MockUserRepository)
			mockTokenSvc := new(MockTokenServiceForAuth)
			tt.setupMock(mockUserRepo)

			authService := services.NewAuthService(nil, mockUserRepo, mockTokenSvc)

			// Execute
			ctx := context.Background()
			result, err := authService.UploadUserAvatar(ctx, tt.userID, tt.imageData, tt.contentType)

			// Assert
			if tt.expectErr {
				assert.Error(t, err)
				assert.Nil(t, result)
			} else {
				require.NoError(t, err)
				require.NotNil(t, result)
				assert.Equal(t, tt.userID.String(), result.ID)
			}

			mockUserRepo.AssertExpectations(t)
			mockTokenSvc.AssertExpectations(t)
		})
	}
}