package repositories

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/hideaki1979/cc-chat-app/apps/api/ent"
	"github.com/hideaki1979/cc-chat-app/apps/api/ent/user"
	"github.com/hideaki1979/cc-chat-app/apps/api/internal/models"
	"github.com/hideaki1979/cc-chat-app/apps/api/internal/services"
	"github.com/hideaki1979/cc-chat-app/apps/api/internal/apperrors"
	"golang.org/x/crypto/bcrypt"
)

// UserRepository ユーザーリポジトリの実装
type UserRepository struct {
	client *ent.Client
}

// インターフェースの実装を確認するためのコンパイル時チェック
var _ services.UserRepositoryInterface = (*UserRepository)(nil)

// NewUserRepository 新しいUserRepositoryインスタンスを作成
func NewUserRepository(client *ent.Client) services.UserRepositoryInterface {
	return &UserRepository{
		client: client,
	}
}

// CreateUser 新しいユーザーを作成
func (r *UserRepository) CreateUser(ctx context.Context, req models.RegisterRequest) (*ent.User, error) {
	// パスワードハッシュ化
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		return nil, fmt.Errorf("failed to hash password: %w", err)
	}

	// ユーザー作成
	newUser, err := r.client.User.Create().
		SetName(req.Name).
		SetEmail(strings.ToLower(req.Email)).
		SetPasswordHash(hashedPassword).
		Save(ctx)
	if err != nil {
		// SQLiteの制約違反チェック
		
		return nil, fmt.Errorf("failed to create user: %w", err)
	}

	return newUser, nil
}

// GetUserByEmail メールアドレスでユーザーを取得
func (r *UserRepository) GetUserByEmail(ctx context.Context, email string) (*ent.User, error) {
	user, err := r.client.User.Query().
		Where(user.EmailEqualFold(email)).
		Only(ctx)
	if err != nil {
		if ent.IsNotFound(err) {
			return  nil, apperrors.ErrUserNotFound	// 正規化されたエラー
		}
		return nil, fmt.Errorf("failed to get user by email: %w", err)
	}
	return user, nil
}

// GetUserByID IDでユーザーを取得
func (r *UserRepository) GetUserByID(ctx context.Context, userID uuid.UUID) (*ent.User, error) {
	user, err := r.client.User.Query().
		Where(user.ID(userID)).
		Only(ctx)
	if err != nil {
		if ent.IsNotFound(err) {
			return nil, apperrors.ErrUserNotFound
		}
		return nil, fmt.Errorf("failed to get user by ID: %w", err)
	}
	return user, nil
}

// UpdateUser ユーザー情報を更新
func (r *UserRepository) UpdateUser(ctx context.Context, userID uuid.UUID, req models.UpdateProfileRequest) (*ent.User, error) {
	update := r.client.User.UpdateOneID(userID)

	// 名前の更新
	if req.Name != "" {
		update = update.SetName(req.Name)
	}

	// Bioの更新
	if req.Bio != "" {
		update = update.SetBio(req.Bio)
	} else if req.Bio == "" {
		update = update.ClearBio()
	}

	// プロフィール画像URLの更新
	if req.ProfileImageURL != "" {
		update = update.SetProfileImageURL(req.ProfileImageURL)
	}

	updatedUser, err := update.Save(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to update user: %w", err)
	}

	return updatedUser, nil
}

// SearchUsersByName 名前でユーザーを検索
func (r *UserRepository) SearchUsersByName(ctx context.Context, query string, excludeUserID uuid.UUID) ([]*ent.User, error) {
	users, err := r.client.User.Query().
		Where(
			user.And(
				user.NameContainsFold(query),
				user.IDNEQ(excludeUserID),
			),
		).
		Limit(20).
		All(ctx)
	if err != nil {
		return nil, fmt.Errorf("search failed: %w", err)
	}

	return users, nil
}

// UpdateUserAvatar ユーザーのアバター画像URLを更新
func (r *UserRepository) UpdateUserAvatar(ctx context.Context, userID uuid.UUID, avatarURL string) (*ent.User, error) {
	updatedUser, err := r.client.User.UpdateOneID(userID).
		SetProfileImageURL(avatarURL).
		Save(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to update avatar: %w", err)
	}

	return updatedUser, nil
}

// UpdateRefreshToken ユーザーのリフレッシュトークンを更新
func (r *UserRepository) UpdateRefreshToken(ctx context.Context, userID uuid.UUID, refreshTokenHash []byte, expiresAt time.Time) error {
	_, err := r.client.User.UpdateOneID(userID).
		SetRefreshTokenHash(refreshTokenHash).
		SetRefreshTokenExpiresAt(expiresAt).
		Save(ctx)
	if err != nil {
		return fmt.Errorf("failed to update refresh token: %w", err)
	}

	return nil
}

// GetUserByRefreshTokenHash リフレッシュトークンハッシュでユーザーを取得
func (r *UserRepository) GetUserByRefreshTokenHash(ctx context.Context, refreshTokenHash []byte) (*ent.User, error) {
	user, err := r.client.User.Query().
		Where(
			user.RefreshTokenHash(refreshTokenHash),
			user.RefreshTokenExpiresAtGT(time.Now()),
			).
		Only(ctx)
	if err != nil {
		return nil, fmt.Errorf("user not found by refresh token: %w", err)
	}

	return user, nil
}

// RevokeUserRefreshToken ユーザーのリフレッシュトークンを無効化
func (r *UserRepository) RevokeUserRefreshToken(ctx context.Context, userID uuid.UUID) error {
	_, err := r.client.User.UpdateOneID(userID).
		ClearRefreshTokenHash().
		ClearRefreshTokenExpiresAt().
		Save(ctx)
	if err != nil {
		return fmt.Errorf("failed to revoke refresh token: %w", err)
	}

	return nil
}