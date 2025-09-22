package schema

import (
	"time"

	"entgo.io/ent"
	"entgo.io/ent/schema/edge"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
	"github.com/google/uuid"
)

// MessageReaction holds the schema definition for the MessageReaction entity.
type MessageReaction struct {
	ent.Schema
}

// Fields of the MessageReaction.
func (MessageReaction) Fields() []ent.Field {
	return []ent.Field{
		field.UUID("id", uuid.UUID{}).
			Default(uuid.New).
			Unique(),
		field.UUID("message_id", uuid.UUID{}).
			Comment("メッセージID"),
		field.UUID("user_id", uuid.UUID{}).
			Comment("リアクションしたユーザーID"),
		field.String("emoji").
			Comment("リアクション絵文字"),
		field.Time("created_at").
			Default(time.Now).
			Immutable().
			Comment("リアクション作成日時"),
	}
}

// Edges of the MessageReaction.
func (MessageReaction) Edges() []ent.Edge {
	return []ent.Edge{
		// MessageReactionはメッセージ（Message）に属する
		edge.From("message", Message.Type).
			Ref("reactions").
			Field("message_id").
			Required().
			Unique(),
		// MessageReactionはユーザー（User）に属する
		edge.From("user", User.Type).
			Ref("message_reactions").
			Field("user_id").
			Required().
			Unique(),
	}
}

// Indexes of the MessageReaction.
func (MessageReaction) Indexes() []ent.Index {
	return []ent.Index{
		// パフォーマンス最適化インデックス
		index.Fields("message_id", "user_id", "emoji").Unique(),
		index.Fields("message_id", "emoji"),
	}
}