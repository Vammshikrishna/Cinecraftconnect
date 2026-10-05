import { supabase } from '@/integrations/supabase/client';

export interface ProfileExtras {
  user_id: string;
  instagram_url: string | null;
  youtube_url: string | null;
  social_links: Record<string, any> | null;
  union_membership: string[] | null;
  day_rate_min: number | null;
  day_rate_max: number | null;
}

/** Reads the visibility-protected extras of a profile. Returns null when hidden or absent. */
export async function fetchProfileExtras(userId: string): Promise<ProfileExtras | null> {
  const { data } = await (supabase as any)
    .from('profile_extras')
    .select('user_id, instagram_url, youtube_url, social_links, union_membership, day_rate_min, day_rate_max')
    .eq('user_id', userId)
    .maybeSingle();
  return (data as ProfileExtras) || null;
}

/** Merges extras onto a profile object so existing rendering code keeps working. */
export function mergeProfileExtras<T extends Record<string, any>>(profile: T, extras: ProfileExtras | null): T {
  const merged: any = { ...profile };
  merged.instagram_url = extras?.instagram_url ?? null;
  merged.youtube_url = extras?.youtube_url ?? null;
  merged.union_membership = extras?.union_membership ?? [];
  merged.day_rate_min = extras?.day_rate_min ?? null;
  merged.day_rate_max = extras?.day_rate_max ?? null;
  merged.social_links = {
    ...(extras?.social_links || {}),
    // accept_direct_pitches is now a public profiles column; keep the legacy path populated.
    accept_direct_pitches: (profile as any).accept_direct_pitches ?? true,
  };
  return merged as T;
}

/** Saves the caller's own extras. */
export async function saveOwnProfileExtras(userId: string, values: Partial<Omit<ProfileExtras, 'user_id'>>) {
  return (supabase as any)
    .from('profile_extras')
    .upsert({ user_id: userId, ...values, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
}
