import { createDirectMessage } from '../api';
import type { ChatRoomResponse } from '../../types/chat';

/**
 * ダイレクトメッセージ関連のビジネスロジックを管理するサービス層
 * Server Components/Client Components両方で使用可能
 */

/**
 * ダイレクトメッセージルームを作成または取得
 * @param targetUserId - 対象ユーザーID
 * @returns Promise<ChatRoomResponse>
 */
export const initializeDirectMessage = async (targetUserId: string): Promise<ChatRoomResponse> => {
  // バリデーション - ビジネスルール
  if (!targetUserId.trim()) {
    throw new Error('ユーザーIDが必要です');
  }

  try {
    const room = await createDirectMessage(targetUserId);
    
    // ビジネスルール：DMの場合のメンバー数は必ず2人
    const normalizedRoom: ChatRoomResponse = {
      ...room,
      member_count: room.member_count || 2, // DMの場合は2人固定
      is_group_chat: false, // DMは必ずfalse
    };
    
    return normalizedRoom;
  } catch (error) {
    throw new Error(`DM開始に失敗しました: ${error}`);
  }
};

/**
 * DMルームの表示名を生成
 * ビジネスルール：DMの場合は相手の名前を表示
 * @param room - チャットルーム情報
 * @returns 表示用ルーム名
 */
export const generateDMDisplayName = (room: ChatRoomResponse): string => {
  // DMでない場合はそのままのルーム名を返す
  if (room.is_group_chat) {
    return room.name;
  }
  
  // DMの場合、相手の名前を抽出する処理が必要
  // 現在のAPIレスポンスから相手の名前を取得するロジック
  // （実装は具体的なAPI仕様に依存）
  return room.name || 'ダイレクトメッセージ';
};

/**
 * DMルームかどうかを判定
 * @param room - チャットルーム情報
 * @returns DMかどうか
 */
export const isDirectMessageRoom = (room: ChatRoomResponse): boolean => {
  return !room.is_group_chat && (room.member_count === 2 || room.member_count === undefined);
};

/**
 * DMルーム用のアイコンタイプを決定
 * @param room - チャットルーム情報
 * @returns アイコンタイプ
 */
export const getDMIconType = (room: ChatRoomResponse): 'user' | 'group' => {
  return isDirectMessageRoom(room) ? 'user' : 'group';
};