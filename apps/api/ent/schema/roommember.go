package schema

import (
	"time"

	"entgo.io/ent"
	"entgo.io/ent/schema/edge"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
	"github.com/google/uuid"
)

// RoomMember holds the schema definition for the RoomMember entity.
type RoomMember struct {
	ent.Schema
}

// Fields of the RoomMember.
func (RoomMember) Fields() []ent.Field {
	return []ent.Field{
		field.Int64("id").
			Positive(),
		field.UUID("room_id", uuid.UUID{}).
			Comment("チャットルームID"),
		field.UUID("user_id", uuid.UUID{}).
			Comment("ユーザーID"),
		field.Time("joined_at").
			Default(time.Now).
			Comment("参加日時"),
	}
}

// Edges of the RoomMember.
func (RoomMember) Edges() []ent.Edge {
	return []ent.Edge{
		// RoomMemberはチャットルーム（ChatRoom）に属する
		edge.From("room", ChatRoom.Type).
			Ref("room_members").
			Field("room_id").
			Required().
			Unique(),
		// RoomMemberはユーザー（User）に属する
		edge.From("user", User.Type).
			Ref("room_members").
			Field("user_id").
			Required().
			Unique(),
	}
}

// Indexes of the RoomMember.
func (RoomMember) Indexes() []ent.Index {
	return []ent.Index{
		// 同じユーザーが同じルームに複数回参加することを防ぐ
		index.Fields("room_id", "user_id").
			Unique(),
		// ユーザーが参加しているルームを効率的に検索
		index.Fields("user_id"),
	}
}