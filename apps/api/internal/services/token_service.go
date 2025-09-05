package services

import (
	"context"
	"crypto/sha256"
	"fmt"
	"log"
	"os"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"github.com/hideaki1979/cc-chat-app/apps/api/internal/models"
)

// TokenService トークンサービスの実装
type TokenService struct {
	jwtSecret       []byte
	userRepo        UserRepositoryInterface
	accessTokenTTL  time.Duration
	refreshTokenTTL time.Duration
}

// NewTokenService 新しいTokenServiceインスタンスを作成
func NewTokenService(userRepo UserRepositoryInterface) TokenServiceInterface {
	jwtSecret := os.Getenv("JWT_SECRET")
	if jwtSecret == "" {
		if os.Getenv("GO_ENV") == "production" {
			log.Fatal("FATAL: JWT_SECRET environment variable must be set in production")
		}
		jwtSecret = "default-secret-for-development"
	}

	return &TokenService{
		jwtSecret:       []byte(jwtSecret),
		userRepo:        userRepo,
		accessTokenTTL:  15 * time.Minute,    // アクセストークン15分
		refreshTokenTTL: 30 * 24 * time.Hour, // リフレッシュトークン30日
	}
}

// GenerateTokens アクセストークンとリフレッシュトークンを生成
func (s *TokenService) GenerateTokens(ctx context.Context, userID uuid.UUID, email string) (*models.TokenPair, error) {
	now := time.Now()

	// アクセストークン生成
	accessClaims := &models.TokenClaims{
		UserID: userID.String(),
		Email:  email,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(now.Add(s.accessTokenTTL)),
			IssuedAt:  jwt.NewNumericDate(now),
			NotBefore: jwt.NewNumericDate(now),
			Audience:  jwt.ClaimStrings{"access"},
			Subject:   userID.String(),
		},
	}

	accessToken := jwt.NewWithClaims(jwt.SigningMethodHS256, accessClaims)
	accessTokenString, err := accessToken.SignedString(s.jwtSecret)
	if err != nil {
		return nil, fmt.Errorf("failed to sign access token: %w", err)
	}

	// リフレッシュトークン生成
	refreshClaims := &models.TokenClaims{
		UserID: userID.String(),
		Email:  email,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(now.Add(s.refreshTokenTTL)),
			IssuedAt:  jwt.NewNumericDate(now),
			NotBefore: jwt.NewNumericDate(now),
			Audience:  jwt.ClaimStrings{"access"},
			Subject:   userID.String(),
		},
	}

	refreshToken := jwt.NewWithClaims(jwt.SigningMethodHS256, refreshClaims)
	refreshTokenString, err := refreshToken.SignedString(s.jwtSecret)
	if err != nil {
		return nil, fmt.Errorf("failed to sign refresh token: %w", err)
	}

	// リフレッシュトークンハッシュをDBに保存
	refreshTokenHash := sha256.Sum256([]byte(refreshTokenString))
	if err := s.userRepo.UpdateRefreshToken(ctx, userID, refreshTokenHash[:], now.Add(s.refreshTokenTTL)); err != nil {
		return nil, fmt.Errorf("failed to persist refresh token: %w", err)
	}

	return &models.TokenPair{
		AccessToken:  accessTokenString,
		RefreshToken: refreshTokenString,
		ExpiresAt:    now.Add(s.accessTokenTTL).Unix(),
	}, nil
}

// RefreshTokens リフレッシュトークンを使用してアクセストークンを更新
func (s *TokenService) RefreshTokens(ctx context.Context, refreshToken string) (*models.TokenPair, error) {
	// リフレッシュトークンの検証
	claims, err := s.ValidateRefreshToken(ctx, refreshToken)
	if err != nil {
		return nil, fmt.Errorf("invalid refresh token: %w", err)
	}

	// ユーザーIDをUUIDに変換
	userID, err := uuid.Parse(claims.UserID)
	if err != nil {
		return nil, fmt.Errorf("invalid user ID in token: %w", err)
	}

	// 新しいトークンペア生成
	return s.GenerateTokens(ctx, userID, claims.Email)
}

// ValidateAccessToken アクセストークンを検証
func (s *TokenService) ValidateAccessToken(tokenString string) (*models.TokenClaims, error) {
	return s.validateToken(tokenString, "access")
}

// ValidateRefreshToken リフレッシュトークンを検証
func (s *TokenService) ValidateRefreshToken(ctx context.Context, tokenString string) (*models.TokenClaims, error) {
	claims, err := s.validateToken(tokenString, "refresh")
	if err != nil {
		return nil, err
	}

	// DBでリフレッシュトークンの有効性を確認
	userID, err := uuid.Parse(claims.UserID)
	if err != nil {
		return nil, fmt.Errorf("invalid user ID: %w", err)
	}

	// リフレッシュトークンをハッシュ化して検索
	refreshTokenHash := sha256.Sum256([]byte(tokenString))
	user, err := s.userRepo.GetUserByRefreshTokenHash(ctx, refreshTokenHash[:])
	if err != nil || user == nil {
		return nil, fmt.Errorf("refresh token not found or revoked")
	}

	if user.ID != userID {
		return nil, fmt.Errorf("token user mismatch")
	}

	return claims, nil
}

// RevokeRefreshToken リフレッシュトークンを無効化
func (s *TokenService) RevokeRefreshToken(ctx context.Context, userID uuid.UUID) error {
	return s.userRepo.RevokeUserRefreshToken(ctx, userID)
}

// validateToken トークンを検証（内部使用）
func (s *TokenService) validateToken(tokenString string, tokenType string) (*models.TokenClaims, error) {
	token, err := jwt.ParseWithClaims(tokenString, &models.TokenClaims{}, func(token *jwt.Token) (interface{}, error) {
		// 署名方式の確認
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
		}
		return s.jwtSecret, nil
	})

	if err != nil {
		return nil, fmt.Errorf("failed to parse token: %w", err)
	}

	claims, ok := token.Claims.(*models.TokenClaims)
	if !ok || !token.Valid {
		return nil, fmt.Errorf("invalid token claims")
	}

	// トークン種別の検証（aud に "access" or "refresh" が含まれること）
	validAud := false
	for _, aud := range claims.Audience {
		if aud == tokenType {
			validAud = true
			break
		}
	}
	if !validAud {
		return nil, fmt.Errorf("invalid token type: expected %s", tokenType)
	}

	// 有効期限チェック
	if claims.ExpiresAt != nil && time.Now().After(claims.ExpiresAt.Time) {
		return nil, fmt.Errorf("token expired")
	}

	// NotBefore チェック
	if claims.NotBefore != nil && time.Now().Before(claims.NotBefore.Time) {
		return nil, fmt.Errorf("token not yet valid")
	}

	return claims, nil
}
