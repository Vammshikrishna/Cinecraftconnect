export interface Profile {
    id: string;
    full_name: string;
    avatar_url: string;
}

export interface Conversation {
    partner: Profile;
    last_message: {
        content: string;
        created_at: string;
    };
    unread_count: number;
}

export interface Message {
    id: string;
    sender_id: string;
    receiver_id: string;
    content: string;
    created_at: string;
}
