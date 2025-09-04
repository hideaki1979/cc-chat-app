package services

import (
	"context"
	"errors"
	"fmt"
	"sort"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/hideaki1979/cc-chat-app/apps/api/ent"
	"github.com/hideaki1979/cc-chat-app/apps/api/ent/chatroom"
	"github.com/hideaki1979/cc-chat-app/apps/api/ent/user"
)

var (
	// ErrTargetUserNotFound ターゲットユーザーが存在しない
	ErrTargetUserNotFound = errors.New("target user not found")
)

// ChatRoomService チャットルームに関するビジネスロジック
type ChatRoomService struct {
	client *ent.Client
}

// NewChatRoomService ChatRoomServiceのコンストラクタ
func NewChatRoomService(client *ent.Client) *ChatRoomService {
	return &ChatRoomService{client: client}
}

// buildDMKey 2つのUUIDから正規化されたDMキーを生成
func buildDMKey(uuid1, uuid2 uuid.UUID) string {
	ids := []string{uuid1.String(), uuid2.String()}
	sort.Strings(ids)
	return strings.Join(ids, ":")
}

// FindExistingDMRoom 2ユーザー間の既存DMルームを検索（存在しなければnil,nilを返す）
func (s *ChatRoomService) FindExistingDMRoom(ctx context.Context, dmKey string) (*ent.ChatRoom, error) {
	room, err := s.client.ChatRoom.Query().
		Where(chatroom.DmKey(dmKey)).
		WithRoomMembers(func(q *ent.RoomMemberQuery) { q.WithUser() }).
		WithMessages(func(q *ent.MessageQuery) { q.WithSender().Order(ent.Desc("created_at")).Limit(1) }).
		First(ctx)
	if err != nil {
		if ent.IsNotFound(err) {
			return nil, nil
		}
		return nil, err
	}
	return room, nil
}

// buildDMRoomName 2ユーザーの名前からDMルーム名を生成（存在確認も実施）
func (s *ChatRoomService) buildDMRoomName(ctx context.Context, currentUserID, targetUserID uuid.UUID) (string, error) {
	// ターゲットユーザーの存在確認
	// 先に取得して404を明示
	targetUser, err := s.client.User.Query().Where(user.ID(targetUserID)).Only(ctx)
	if err != nil {
		if ent.IsNotFound(err) {
			return "", ErrTargetUserNotFound
		}
		return "", err
	}

	currentUser, err := s.client.User.Query().Where(user.ID(currentUserID)).Only(ctx)
	if err != nil {
		return "", err
	}

	return fmt.Sprintf("DM: %s, %s", currentUser.Name, targetUser.Name), nil
}

// CreateDMRoom 新規にDMルームを作成し、詳細付きで返す
func (s *ChatRoomService) CreateDMRoom(ctx context.Context, currentUserID, targetUserID uuid.UUID, dmKey string) (*ent.ChatRoom, error) {
	roomName, err := s.buildDMRoomName(ctx, currentUserID, targetUserID)
	if err != nil {
		return nil, err
	}

	tx, err := s.client.Tx(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()

	newRoom, err := tx.ChatRoom.Create().
		SetName(roomName).
		SetIsGroupChat(false).
		SetDmKey(dmKey).
		Save(ctx)
	if err != nil {
		// ユニーク制約違反の場合（競合状態で先行作成された）
		if ent.IsConstraintError(err) {
			// 既存のDMを検索して返す
			room, getErr := s.client.ChatRoom.Query().
				Where(chatroom.DmKey(dmKey)).
				WithRoomMembers(func(q *ent.RoomMemberQuery) {
					q.WithUser()
				}).
				WithMessages(func(q *ent.MessageQuery) {
					q.WithSender().
						Order(ent.Desc("created_at")).
						Limit(1)
				}).
				Only(ctx)
			if getErr == nil {
				return room, nil
			}
		}
		return nil, err
	}

	for _, memberID := range []uuid.UUID{currentUserID, targetUserID} {
		if _, err := tx.RoomMember.Create().
			SetRoomID(newRoom.ID).
			SetUserID(memberID).
			SetJoinedAt(time.Now()).
			Save(ctx); err != nil {
			return nil, err
		}
	}

	if err := tx.Commit(); err != nil {
		return nil, err
	}

	// 返却用に詳細を取得
	createdRoom, err := s.client.ChatRoom.Query().
		Where(chatroom.ID(newRoom.ID)).
		WithRoomMembers(func(q *ent.RoomMemberQuery) { q.WithUser() }).
		WithMessages(func(q *ent.MessageQuery) { q.WithSender().Order(ent.Desc("created_at")).Limit(1) }).
		Only(ctx)
	if err != nil {
		return nil, err
	}

	return createdRoom, nil
}

// EnsureDMRoom 既存DMがあれば取得、無ければ作成して返す（第二戻り値は作成有無）
func (s *ChatRoomService) EnsureDMRoom(ctx context.Context, currentUserID, targetUserID uuid.UUID) (*ent.ChatRoom, bool, error) {
	// DM識別キーを生成
	dmKey := buildDMKey(currentUserID, targetUserID)
	if room, err := s.FindExistingDMRoom(ctx, dmKey); err != nil {
		return nil, false, err
	} else if room != nil {
		return room, false, nil
	}

	room, err := s.CreateDMRoom(ctx, currentUserID, targetUserID, dmKey)
	if err != nil {
		return nil, false, err
	}
	return room, true, nil
}
