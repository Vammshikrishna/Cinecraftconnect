export interface CompanyPage {
  id: string;
  owner_id: string;
  name: string;
  slug: string;
  tagline: string | null;
  description: string | null;
  logo_url: string | null;
  cover_image_url: string | null;
  industry: string[];
  company_size: string | null;
  founded_year: number | null;
  headquarters: string | null;
  website: string | null;
  email: string | null;
  phone: string | null;
  specialties: string[];
  is_verified: boolean;
  follower_count: number;
  created_at: string;
  updated_at: string;
  // Joined data
  owner_profile?: {
    id: string;
    full_name: string | null;
    username: string | null;
    avatar_url: string | null;
  };
}

export interface CompanyPageAdmin {
  id: string;
  page_id: string;
  user_id: string;
  role: 'super_admin' | 'content_admin' | 'analyst';
  created_at: string;
  profiles?: {
    id: string;
    full_name: string | null;
    username: string | null;
    avatar_url: string | null;
  };
}

export interface CompanyPageFollower {
  id: string;
  page_id: string;
  user_id: string;
  created_at: string;
}

export interface CompanyPageMember {
  id: string;
  page_id: string;
  user_id: string;
  title: string | null;
  department: string | null;
  created_at: string;
  profiles?: {
    id: string;
    full_name: string | null;
    username: string | null;
    avatar_url: string | null;
    craft: string | null;
  };
}

export const PAGE_INDUSTRIES = [
  'Production House',
  'Film Studio',
  'Post-Production',
  'VFX & Animation',
  'Talent Agency',
  'Casting Agency',
  'Distribution Company',
  'Streaming Platform',
  'Film School / Academy',
  'Media & Entertainment',
  'Advertising & Marketing',
  'Sound & Music',
  'Equipment & Technology',
  'Set Design & Art',
  'Costume & Styling',
  'Location Services',
  'Legal & Finance',
  'Freelance Collective',
  'Non-Profit / Film Foundation',
  'Other'
] as const;

export type PageIndustry = typeof PAGE_INDUSTRIES[number];

export const COMPANY_SIZES = [
  '1-10',
  '11-50',
  '51-200',
  '201-500',
  '501-1000',
  '1001-5000',
  '5000+'
] as const;

export type CompanySize = typeof COMPANY_SIZES[number];
