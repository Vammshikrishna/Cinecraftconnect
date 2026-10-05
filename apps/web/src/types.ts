export interface Post {
  id: string;
  author_id: string;
  content: string;
  media_url?: string;
  media_urls?: string[];
  media_type?: string;
  media_items?: { url: string; type: "image" | "video" }[];
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
    is_verified: boolean | null;
  };
  page_id?: string;
  company_pages?: {
    id: string;
    name: string;
    logo_url: string | null;
    slug: string;
    is_verified: boolean | null;
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
    is_verified: boolean | null;
  };
  parent_id?: string | null;
}

export interface Profile {
  id: string;
  avatar_url: string | null;
  cover_image_url: string | null;
  bio: string | null;
  craft: string | null;
  experience: string | null;
  full_name: string | null;
  location: string | null;
  onboarding_completed: boolean | null;
  is_internal: boolean | null;
  updated_at: string | null;
  username: string | null;
  website: string | null;
  instagram_url: string | null;
  youtube_url: string | null;
  social_links?: {
    instagram?: string;
    linkedin?: string;
    twitter?: string;
    facebook?: string;
  } | null;
  is_verified?: boolean | null;
  is_banned?: boolean | null;
}
