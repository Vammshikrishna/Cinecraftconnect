export interface Post {
  id: number;
  content: string;
  created_at: string;
  likes?: number;
  comments_count?: number;
  author?: {
    name?: string;
    avatar?: string;
  };
}
