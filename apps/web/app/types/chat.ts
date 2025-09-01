export interface Message {
    id: string;
    content: string;
    sender_id: string;
    sender_name: string;
    room_id: string;
    created_at: string;
    updated_at?: string;
    message_type?: 'text' | 'image' | 'file' | 'system';
    is_edited?: boolean;
    reply_to_message_id?: string;
}

export interface ChatRoom {
    id: string;
    name: string;
    is_group_chat: boolean;
    member_count?: number;
    last_message?: {
        content: string;
        sender_name: string;
        created_at: string;
    };
    updated_at: string;
}
