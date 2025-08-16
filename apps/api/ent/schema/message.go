package schema

import (
	"time"

	"entgo.io/ent"
	"entgo.io/ent/schema/edge"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
	"github.com/google/uuid"
)

// Message holds the schema definition for the Message entity.
type Message struct {
	ent.Schema
}

// Fields of the Message.
func (Message) Fields() []ent.Field {
	return []ent.Field{
		field.UUID("id", uuid.UUID{}).
			Default(uuid.New).
			Unique(),
		field.UUID("room_id", uuid.UUID{}).
			Comment("チャットルームID"),
		field.UUID("user_id", uuid.UUID{}).
			Comment("送信者ユーザーID"),
		field.Text("content").
			Comment("メッセージ内容"),
		field.Text("file_url").
			Optional().
			Nillable().
			Comment("添付ファイルURL"),
		field.Time("created_at").
			Default(time.Now).
			Immutable(),
		field.Time("updated_at").
			Default(time.Now).
			UpdateDefault(time.Now),
		field.Time("deleted_at").
			Optional().
			Nillable().
			Comment("論理削除日時"),
	}
}

// Edges of the Message.
func (Message) Edges() []ent.Edge {
	return []ent.Edge{
		// Messageはチャットルーム（ChatRoom）に属する
		edge.From("room", ChatRoom.Type).
			Ref("messages").
			Field("room_id").
			Required().
			Unique(),
		// Messageは送信者（User）に属する
		edge.From("sender", User.Type).
			Ref("messages").
			Field("user_id").
			Required().
			Unique(),
	}
}

// Indexes of the Message.
func (Message) Indexes() []ent.Index {
	return []ent.Index{
		// 設計書で指定されたパフォーマンス最適化インデックス
		index.Fields("room_id", "created_at"),
	}
}