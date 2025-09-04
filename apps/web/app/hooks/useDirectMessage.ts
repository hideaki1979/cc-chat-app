import { useChatStore } from "../stores/chat"
import { ChatRoomResponse } from "../types/chat";
import { createDirectMessage } from "../lib/api";

export const useDirectMessage = () => {
    const upsertRoom = useChatStore((s) => s.upsertRoom);
    const startDM = async (targetUserId: string): Promise<ChatRoomResponse> => {
        const room = await createDirectMessage(targetUserId);
        upsertRoom({
            id: room.id,
            name: room.name,
            is_group_chat: room.is_group_chat,
            member_count: room.member_count || 2, // DMの場合は2人
            last_message: room.last_message,
            updated_at: room.updated_at,
        });
        return room;
    };
    return { startDM };
}