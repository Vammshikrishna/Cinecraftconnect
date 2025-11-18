export type UserRole = 'admin' | 'moderator' | 'user';

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