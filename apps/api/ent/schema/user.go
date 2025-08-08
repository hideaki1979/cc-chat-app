package schema

import (
	"context"
	"fmt"
	"time"

	"entgo.io/ent"
	"entgo.io/ent/schema/field"
	"github.com/google/uuid"
)

// User holds the schema definition for the User entity.
type User struct {
	ent.Schema
}

// Fields of the User.
func (User) Fields() []ent.Field {
	return []ent.Field{
		field.UUID("id", uuid.UUID{}).
			Default(uuid.New).
			Immutable().
			StorageKey("id"),
		field.String("name").
			NotEmpty().
			Comment("ユーザー名"),
		field.String("email").
			Unique().
			NotEmpty().
			Comment("メールアドレス（ユニーク）"),
		field.String("password_hash").
			NotEmpty().
			Sensitive().
			Comment("パスワードハッシュ"),
		field.String("profile_image_url").
			Optional().
			Comment("プロフィール画像URL"),
		field.Text("bio").
			Optional().
			Comment("自己紹介文"),
		field.Time("created_at").
			Default(time.Now).
			Immutable().
			Comment("作成日時"),
		field.Time("updated_at").
			Default(time.Now).
			UpdateDefault(time.Now).
			Comment("更新日時"),
		field.String("refresh_token").
			Optional().
			Nillable().
			Sensitive().
			Comment("リフレッシュトークン"),
		field.Time("refresh_token_expires_at").
			Optional().
			Nillable().
			Comment("リフレッシュトークン有効期限"),
	}
}

// Edges of the User.
func (User) Edges() []ent.Edge {
	return nil
}

// Indexes of the User.
func (User) Indexes() []ent.Index {
	return nil
}

// Hooks of the User.
func (User) Hooks() []ent.Hook {
	return []ent.Hook{
		// リフレッシュトークンフィールドの整合性を保つフック
		func(next ent.Mutator) ent.Mutator {
			return ent.MutateFunc(func(ctx context.Context, m ent.Mutation) (ent.Value, error) {
				um, ok := m.(interface {
					RefreshToken() (string, bool)
					RefreshTokenExpiresAt() (time.Time, bool)
					RefreshTokenCleared() bool
					RefreshTokenExpiresAtCleared() bool
					ClearRefreshToken()
					ClearRefreshTokenExpiresAt()
				})
				if ok {
					// === クリア操作の整合性チェック ===
					// リフレッシュトークンがクリアされる場合、有効期限もクリア
					if um.RefreshTokenCleared() && !um.RefreshTokenExpiresAtCleared() {
						um.ClearRefreshTokenExpiresAt()
					}
					// 有効期限がクリアされる場合、リフレッシュトークンもクリア
					if um.RefreshTokenExpiresAtCleared() && !um.RefreshTokenCleared() {
						um.ClearRefreshToken()
					}

					// === 設定操作の整合性チェック ===
					refreshToken, hasRefreshToken := um.RefreshToken()
					expiresAt, hasExpiresAt := um.RefreshTokenExpiresAt()
					
					// リフレッシュトークンが設定されているが、有効期限が設定されていない場合はエラー
					if hasRefreshToken && refreshToken != "" && !hasExpiresAt {
						return nil, fmt.Errorf("refresh token requires expiry time")
					}
					
					// 有効期限が設定されているが、リフレッシュトークンが設定されていない場合はエラー
					if hasExpiresAt && !hasRefreshToken {
						return nil, fmt.Errorf("refresh token expiry requires refresh token")
					}
					
					// 有効期限が過去の時刻の場合はエラー
					if hasExpiresAt && expiresAt.Before(time.Now()) {
						return nil, fmt.Errorf("refresh token expiry must be in the future")
					}
				}
				return next.Mutate(ctx, m)
			})
		},
	}
}
