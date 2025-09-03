export interface MessageSender {
    id: string;
    name: string;
    profile_image_url?: string;
}

export interface Message {
    id: string;
    content: string;
    room_id: string;
    user_id: string;
    file_url?: string;
    created_at: string;
    updated_at: string;
    deleted_at?: string;
    sender?: MessageSender;
    message_type?: 'text' | 'image' | 'file' | 'system';
    is_edited?: boolean;
    // 後方互換性のため
    sender_id?: string;
    sender_name?: string;
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
