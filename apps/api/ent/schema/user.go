package schema

import (
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
