export interface PortfolioItemData {
  id: string;
  title: string;
  description?: string | null;
  media_url?: string | null;
  media_type?: string | null;
  project_type?: string | null;
  role?: string | null;
  completion_date?: string | null;
  tags?: string[] | null;
  is_featured?: boolean | null;
  user_id: string;
}
