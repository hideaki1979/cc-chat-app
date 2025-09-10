import { useChatStore } from '../stores/chat';
import { ChatRoomResponse } from '../types/chat';
import { initializeDirectMessage } from '../lib/services/directMessageService';
import { normalizeError, logError } from '../lib/services/errorService';

export const useDirectMessage = () => {
  const upsertRoom = useChatStore((s) => s.upsertRoom);
  
  const startDM = async (targetUserId: string): Promise<ChatRoomResponse> => {
    try {
      const room = await initializeDirectMessage(targetUserId);
      
      // ストア更新（UI層の責務）
      upsertRoom({
        id: room.id,
        name: room.name,
        is_group_chat: room.is_group_chat,
        member_count: room.member_count,
        last_message: room.last_message,
        updated_at: room.updated_at,
      });
      
      return room;
    } catch (error) {
      const appError = normalizeError(error, 'DM開始');
      logError(appError, 'useDirectMessage.startDM');
      throw appError;
    }
  };
  
  return { startDM };
};