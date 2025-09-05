package services

import (
	"context"
	"time"

	"github.com/google/uuid"
	"github.com/hideaki1979/cc-chat-app/apps/api/ent"
	"github.com/hideaki1979/cc-chat-app/apps/api/internal/models"
)

// AuthServiceInterface 認証サービスのインターフェース
type AuthServiceInterface interface {
	RegisterUser(ctx context.Context, req models.RegisterRequest) (*models.AuthResponse, error)
	AuthenticateUser(ctx context.Context, req models.LoginRequest) (*models.AuthResponse, error)
	GetUserProfile(ctx context.Context, userID uuid.UUID) (*models.UserResponse, error)
	UpdateUserProfile(ctx context.Context, userID uuid.UUID, req models.UpdateProfileRequest) (*models.UserResponse, error)
	SearchUsers(ctx context.Context, query string, currentUserID uuid.UUID) (*models.UserSearchResponse, error)
	UploadUserAvatar(ctx context.Context, userID uuid.UUID, imageData []byte, contentType string) (*models.UserResponse, error)
}

// TokenServiceInterface トークンサービスのインターフェース
type TokenServiceInterface interface {
	GenerateTokens(userID uuid.UUID, email string) (*models.TokenPair, error)
	RefreshTokens(ctx context.Context, refreshToken string) (*models.TokenPair, error)
	ValidateAccessToken(tokenString string) (*models.TokenClaims, error)
	ValidateRefreshToken(ctx context.Context, tokenString string) (*models.TokenClaims, error)
	RevokeRefreshToken(ctx context.Context, userID uuid.UUID) error
}

// UserRepositoryInterface ユーザーリポジトリのインターフェース
type UserRepositoryInterface interface {
	CreateUser(ctx context.Context, req models.RegisterRequest) (*ent.User, error)
	GetUserByEmail(ctx context.Context, email string) (*ent.User, error)
	GetUserByID(ctx context.Context, userID uuid.UUID) (*ent.User, error)
	UpdateUser(ctx context.Context, userID uuid.UUID, req models.UpdateProfileRequest) (*ent.User, error)
	SearchUsersByName(ctx context.Context, query string, excludeUserID uuid.UUID) ([]*ent.User, error)
	UpdateUserAvatar(ctx context.Context, userID uuid.UUID, avatarURL string) (*ent.User, error)
	UpdateRefreshToken(ctx context.Context, userID uuid.UUID, refreshTokenHash []byte, expiresAt time.Time) error
	GetUserByRefreshTokenHash(ctx context.Context, refreshTokenHash []byte) (*ent.User, error)
	RevokeUserRefreshToken(ctx context.Context, userID uuid.UUID) error
}

// ChatRoomServiceInterface チャットルームサービスのインターフェース
type ChatRoomServiceInterface interface {
	CreateChatRoom(ctx context.Context, req models.CreateChatRoomRequest, creatorID uuid.UUID) (*models.ChatRoomResponse, error)
	GetUserChatRooms(ctx context.Context, userID uuid.UUID) (*models.ChatRoomsResponse, error)
	GetChatRoom(ctx context.Context, roomID uuid.UUID, userID uuid.UUID) (*models.ChatRoomResponse, error)
	UpdateChatRoom(ctx context.Context, roomID uuid.UUID, req models.UpdateChatRoomRequest, userID uuid.UUID) (*models.ChatRoomResponse, error)
	AddMember(ctx context.Context, roomID uuid.UUID, userID uuid.UUID, targetUserID uuid.UUID) error
	RemoveMember(ctx context.Context, roomID uuid.UUID, userID uuid.UUID, targetUserID uuid.UUID) error
	CreateDirectMessage(ctx context.Context, userID uuid.UUID, targetUserID uuid.UUID) (*models.ChatRoomResponse, error)
}

// MessageServiceInterface メッセージサービスのインターフェース
type MessageServiceInterface interface {
	SendMessage(ctx context.Context, req models.SendMessageRequest, senderID uuid.UUID) (*models.MessageResponse, error)
	GetRoomMessages(ctx context.Context, roomID uuid.UUID, userID uuid.UUID, limit int, offset int) (*models.MessagesResponse, error)
	GetMessage(ctx context.Context, messageID uuid.UUID, userID uuid.UUID) (*models.MessageResponse, error)
	UpdateMessage(ctx context.Context, messageID uuid.UUID, req models.UpdateMessageRequest, userID uuid.UUID) (*models.MessageResponse, error)
	DeleteMessage(ctx context.Context, messageID uuid.UUID, userID uuid.UUID) error
}