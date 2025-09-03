package schema

import (
	"time"

	"entgo.io/ent"
	"entgo.io/ent/schema/edge"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
	"github.com/google/uuid"
)

// ChatRoom holds the schema definition for the ChatRoom entity.
type ChatRoom struct {
	ent.Schema
}

// Fields of the ChatRoom.
func (ChatRoom) Fields() []ent.Field {
	return []ent.Field{
		field.UUID("id", uuid.UUID{}).
			Default(uuid.New).
			Unique(),
		field.String("name").
			NotEmpty().
			MaxLen(100).
			Comment("チャットルーム名"),
		field.Bool("is_group_chat").
			Default(false).
			Comment("グループチャットかどうか"),
		field.String("dm_key").
			Optional().
			Nillable().
			Comment("DM識別キー（非グループチャット専用）"),
		field.Time("created_at").
			Default(time.Now).
			Immutable(),
		field.Time("updated_at").
			Default(time.Now).
			UpdateDefault(time.Now),
	}
}

// Edges of the ChatRoom.
func (ChatRoom) Edges() []ent.Edge {
	return []ent.Edge{
		// ChatRoomは複数のメンバー（User）を持つ（room_membersテーブル経由）
		edge.To("room_members", RoomMember.Type),
		// ChatRoomは複数のメッセージ（Message）を持つ
		edge.To("messages", Message.Type),
	}
}

// Indexes of the ChatRoom.
func (ChatRoom) Indexes() []ent.Index {
	return []ent.Index{
		// DM重複防止のためのユニークインデックス
		index.Fields("dm_key").
			Unique(),
	}
}
