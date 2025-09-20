package schema

import (
	"time"

	"entgo.io/ent"
	"entgo.io/ent/schema/edge"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
	"github.com/google/uuid"
)

// MessageRead holds the schema definition for the MessageRead entity.
type MessageRead struct {
	ent.Schema
}

// Fields of the MessageRead.
func (MessageRead) Fields() []ent.Field {
	return []ent.Field{
		field.UUID("id", uuid.UUID{}).
			Default(uuid.New).
			Unique(),
		field.UUID("message_id", uuid.UUID{}).
			Comment("メッセージID"),
		field.UUID("user_id", uuid.UUID{}).
			Comment("既読したユーザーID"),
		field.Time("read_at").
			Default(time.Now).
			Comment("既読日時"),
	}
}

// Edges of the MessageRead.
func (MessageRead) Edges() []ent.Edge {
	return []ent.Edge{
		// MessageReadはメッセージ（Message）に属する
		edge.From("message", Message.Type).
			Ref("reads").
			Field("message_id").
			Required().
			Unique(),
		// MessageReadはユーザー（User）に属する
		edge.From("user", User.Type).
			Ref("message_reads").
			Field("user_id").
			Required().
			Unique(),
	}
}

// Indexes of the MessageRead.
func (MessageRead) Indexes() []ent.Index {
	return []ent.Index{
		// パフォーマンス最適化インデックス
		index.Fields("message_id", "user_id").Unique(),
		index.Fields("user_id", "read_at"),
	}
}