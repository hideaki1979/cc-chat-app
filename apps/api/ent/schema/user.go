package schema

import (
	"context"
	"fmt"
	"strings"
	"time"

	"entgo.io/ent"
	"entgo.io/ent/schema/edge"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
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
			Comment("メールアドレス（正規化によりユニーク）"),
		field.Bytes("password_hash").
			NotEmpty().
			Sensitive().
			Comment("パスワードハッシュ"),
		field.String("profile_image_url").
			Optional().
			Nillable().
			Comment("プロフィール画像URL"),
		field.Text("bio").
			Optional().
			Nillable().
			Comment("自己紹介文"),
		field.Time("created_at").
			Default(time.Now).
			Immutable().
			Comment("作成日時"),
		field.Time("updated_at").
			Default(time.Now).
			UpdateDefault(time.Now).
			Comment("更新日時"),
		field.Bytes("refresh_token_hash").
			Optional().
			Nillable().
			Unique().
			Sensitive().
			Comment("リフレッシュトークンハッシュ"),
		field.Time("refresh_token_expires_at").
			Optional().
			Nillable().
			Comment("リフレッシュトークン有効期限"),
	}
}

// Edges of the User.
func (User) Edges() []ent.Edge {
	return []ent.Edge{
		// Userは複数のルームメンバー（RoomMember）を持つ
		edge.To("room_members", RoomMember.Type),
		// Userは複数のメッセージ（Message）を持つ
		edge.To("messages", Message.Type),
	}
}

// Indexes of the User.
func (User) Indexes() []ent.Index {
	return []ent.Index{
		// 設計書で指定されたパフォーマンス最適化インデックス
		index.Fields("email"),
	}
}

// Hooks of the User.
func (User) Hooks() []ent.Hook {
	return []ent.Hook{
		// リフレッシュトークンフィールドの整合性を保つフック
		func(next ent.Mutator) ent.Mutator {
			return ent.MutateFunc(func(ctx context.Context, m ent.Mutation) (ent.Value, error) {
				um, ok := m.(interface {
					RefreshTokenHash() ([]byte, bool)
					RefreshTokenExpiresAt() (time.Time, bool)
					RefreshTokenHashCleared() bool
					RefreshTokenExpiresAtCleared() bool
					ClearRefreshTokenHash()
					ClearRefreshTokenExpiresAt()
				})
				if ok {
					// === クリア操作の整合性チェック ===
					// リフレッシュトークンがクリアされる場合、有効期限もクリア
					if um.RefreshTokenHashCleared() && !um.RefreshTokenExpiresAtCleared() {
						um.ClearRefreshTokenExpiresAt()
					}
					// 有効期限がクリアされる場合、リフレッシュトークンもクリア
					if um.RefreshTokenExpiresAtCleared() && !um.RefreshTokenHashCleared() {
						um.ClearRefreshTokenHash()
					}

					// === 設定操作の整合性チェック ===
					refreshTokenHash, hasRefreshTokenHash := um.RefreshTokenHash()
					expiresAt, hasExpiresAt := um.RefreshTokenExpiresAt()

					// リフレッシュトークンが設定されているが、有効期限が設定されていない場合はエラー
					if hasRefreshTokenHash && len(refreshTokenHash) > 0 && !hasExpiresAt {
						return nil, fmt.Errorf("refresh token requires expiry time")
					}

					// 有効期限が設定されているが、リフレッシュトークンが設定されていない場合はエラー
					if hasExpiresAt && !hasRefreshTokenHash {
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
		// Email正規化フック
		func(next ent.Mutator) ent.Mutator {
			return ent.MutateFunc(func(ctx context.Context, m ent.Mutation) (ent.Value, error) {
				// UserMutationのEmailフィールドにアクセスするインターフェース定義
				if um, ok := m.(interface {
					Email() (string, bool)
					SetEmail(string)
				}); ok {
					// Emailが設定されている場合、正規化を実行
					if email, exists := um.Email(); exists {
						// トリムと小文字変換による正規化
						normalizedEmail := strings.ToLower(strings.TrimSpace(email))
						if normalizedEmail != email {
							um.SetEmail(normalizedEmail)
						}
					}
				}
				return next.Mutate(ctx, m)
			})
		},
	}
}
