package services

import (
	"context"
	"errors"
	"fmt"

	"github.com/go-playground/validator/v10"
	"github.com/google/uuid"
	"github.com/hideaki1979/cc-chat-app/apps/api/ent"
	"github.com/hideaki1979/cc-chat-app/apps/api/internal/models"

	"golang.org/x/crypto/bcrypt"
)

var validate = validator.New()

const (
	MaxAvatarSizeBytes = 5 * 1024 * 1024 // 5MB
)

// AuthService 認証サービスの実装
type AuthService struct {
	client   *ent.Client
	userRepo UserRepositoryInterface
	tokenSvc TokenServiceInterface
}

// NewAuthService 新しいAuthServiceインスタンスを作成
func NewAuthService(client *ent.Client, userRepo UserRepositoryInterface, tokenSvc TokenServiceInterface) AuthServiceInterface {
	return &AuthService{
		client:   client,
		userRepo: userRepo,
		tokenSvc: tokenSvc,
	}
}

// RegisterUser ユーザー登録処理
func (s *AuthService) RegisterUser(ctx context.Context, req models.RegisterRequest) (*models.AuthResult, error) {
	// バリデーション
	if err := validate.Struct(req); err != nil {
		return nil, fmt.Errorf("validation error: %w", err)
	}

	// 重複チェック
	existingUser, err := s.userRepo.GetUserByEmail(ctx, req.Email)
	if err == nil && existingUser != nil {
		return nil, ErrEmailExists
	}

	// ユーザーが見つからない以外のエラーは伝播させる
	if err != nil && !errors.Is(err, ErrUserNotFound) {
		return nil, fmt.Errorf("failed to check existing user: %w", err)
	}

	// ユーザー作成
	newUser, err := s.userRepo.CreateUser(ctx, req)
	if err != nil {
		// entの一意制約違反を明示的エラーへ正規化
		if errors.Is(err, ErrEmailExists) {
			return nil, ErrEmailExists
		}
		return nil, fmt.Errorf("failed to create user: %w", err)
	}

	// トークン生成
	tokens, err := s.tokenSvc.GenerateTokens(ctx, newUser.ID, newUser.Email)
	if err != nil {
		return nil, fmt.Errorf("failed to generate tokens: %w", err)
	}

	// レスポンス作成
	userInfo := s.convertToUserInfo(newUser)
	return &models.AuthResult{User: userInfo, Tokens: tokens}, nil
}

// AuthenticateUser ユーザー認証処理
func (s *AuthService) AuthenticateUser(ctx context.Context, req models.LoginRequest) (*models.AuthResult, error) {
	// ユーザー取得
	user, err := s.userRepo.GetUserByEmail(ctx, req.Email)
	if err != nil {
		return nil, fmt.Errorf("invalid credentials")
	}

	// パスワード検証
	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(req.Password)); err != nil {
		return nil, fmt.Errorf("invalid credentials")
	}

	// トークン生成
	tokens, err := s.tokenSvc.GenerateTokens(ctx, user.ID, user.Email)
	if err != nil {
		return nil, fmt.Errorf("failed to generate tokens: %w", err)
	}

	// レスポンス作成
	userInfo := s.convertToUserInfo(user)
	return &models.AuthResult{User: userInfo, Tokens: tokens}, nil
}

// GetUserProfile ユーザープロフィール取得
func (s *AuthService) GetUserProfile(ctx context.Context, userID uuid.UUID) (*models.UserResponse, error) {
	user, err := s.userRepo.GetUserByID(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("user not found: %w", err)
	}

	userInfo := s.convertToUserInfo(user)
	return &userInfo, nil
}

// UpdateUserProfile ユーザープロフィール更新
func (s *AuthService) UpdateUserProfile(ctx context.Context, userID uuid.UUID, req models.UpdateProfileRequest) (*models.UserResponse, error) {
	// バリデーション
	if err := validate.Struct(req); err != nil {
		return nil, fmt.Errorf("validation error: %w", err)
	}

	// ユーザー更新
	updatedUser, err := s.userRepo.UpdateUser(ctx, userID, req)
	if err != nil {
		return nil, fmt.Errorf("failed to update user: %w", err)
	}

	userInfo := s.convertToUserInfo(updatedUser)
	return &userInfo, nil
}

// SearchUsers ユーザー検索
func (s *AuthService) SearchUsers(ctx context.Context, query string, currentUserID uuid.UUID) (*models.UserSearchResponse, error) {
	if len(query) < 1 {
		return nil, fmt.Errorf("query too short")
	}

	// ユーザー検索（自分を除外）
	users, err := s.userRepo.SearchUsersByName(ctx, query, currentUserID)
	if err != nil {
		return nil, fmt.Errorf("search failed: %w", err)
	}

	// レスポンス作成
	results := make([]models.UserSearchResult, len(users))
	for i, user := range users {
		results[i] = models.UserSearchResult{
			ID:              user.ID.String(),
			Name:            user.Name,
			Email:           user.Email,
			ProfileImageURL: user.ProfileImageURL,
		}
	}

	return &models.UserSearchResponse{
		Users: results,
		Total: len(results),
	}, nil
}

// UploadUserAvatar ユーザーアバター画像アップロード
func (s *AuthService) UploadUserAvatar(ctx context.Context, userID uuid.UUID, imageData []byte, contentType string) (*models.UserResponse, error) {
	// ファイルサイズチェック（5MB制限）
	if len(imageData) > MaxAvatarSizeBytes {
		return nil, fmt.Errorf("file too large")
	}

	// コンテンツタイプチェック
	allowedTypes := map[string]bool{
		"image/jpeg": true,
		"image/png":  true,
		"image/gif":  true,
	}
	if !allowedTypes[contentType] {
		return nil, fmt.Errorf("unsupported file type")
	}

	// TODO: 実際のファイルアップロード処理（S3等）
	extMap := map[string]string{
		"image/jpeg": ".jpg",
		"image/png":  ".png",
		"image/gif":  ".git",
	}
	ext, ok := extMap[contentType]
	if !ok {
		return nil, fmt.Errorf("unsupported file type")
	}
	avatarURL := fmt.Sprintf("/uploads/avatars/%s%s", userID.String(), ext)

	// ユーザーのアバターURL更新
	updatedUser, err := s.userRepo.UpdateUserAvatar(ctx, userID, avatarURL)
	if err != nil {
		return nil, fmt.Errorf("failed to update avatar: %w", err)
	}

	userInfo := s.convertToUserInfo(updatedUser)
	return &userInfo, nil
}

// convertToUserInfo EntユーザーをUserInfoに変換
func (s *AuthService) convertToUserInfo(user *ent.User) models.UserInfo {
	return models.UserInfo{
		ID:              user.ID.String(),
		Name:            user.Name,
		Email:           user.Email,
		ProfileImageURL: user.ProfileImageURL,
		Bio:             user.Bio,
		CreatedAt:       user.CreatedAt,
		UpdatedAt:       user.UpdatedAt,
	}
}
