export type UserRole = 'creator' | 'admin' | 'member' | 'moderator' | 'user';

export interface Message {
  id: string;
  content: string;
  created_at: string;
  user_id: string;
  profiles: {
    id: string;
    username: string | null;
    avatar_url: string | null;
  };
}

export interface Call {
  id: string;
  room_id: string;
  created_by: string;
  call_type: 'audio' | 'video';
  status: string;
  created_at: string;
}

export interface Category {
  id: string;
  name: string;
  description: string | null;
  icon: string | null;
}