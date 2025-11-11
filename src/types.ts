export interface Post {
  id: string;
  author_id: string;
  content: string;
  media_url?: string;
  media_type?: string;
  has_ai_generated: boolean;
  tags?: string[];
  like_count: number;
  comment_count: number;
  share_count: number;
  created_at: string;
  profiles?: {
    id: string;
    full_name: string | null;
    username: string | null;
    avatar_url: string | null;
    craft: string | null;
  };
}

export interface Comment {
  id: string;
  user_id: string;
  content: string;
  created_at: string;
  profiles?: {
    full_name: string | null;
    username: string | null;
    avatar_url: string | null;
  };
}

export interface Profile {
  id: string;
  avatar_url: string | null;
  bio: string | null;
  craft: string | null;
  created_at: string | null;
  full_name: string | null;
  location: string | null;
  updated_at: string | null;
  username: string | null;
  website: string | null;
}
