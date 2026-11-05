import { getSupabaseClient } from '@cinecraft/api';

export interface E2EEProfileInfo {
  id: string;
  public_key: string | null;
  /** true when the person turned encrypted messages on */
  e2ee_enabled: boolean;
}

/**
 * Reads the public key and the opt-in flag for some people.
 * Until part AN is run the column does not exist; then everyone counts as opted in (how the app behaved before
 * encrypted messages became opt-in), so nothing is silently sent as plain text during a deploy.
 */
export const fetchE2EEProfileInfo = async (ids: string[]): Promise<Map<string, E2EEProfileInfo>> => {
  const out = new Map<string, E2EEProfileInfo>();
  if (ids.length === 0) return out;
  const supabase: any = getSupabaseClient();

  const { data, error } = await supabase.from('profiles').select('id, public_key, e2ee_enabled').in('id', ids);
  if (!error) {
    for (const p of (data || []) as any[]) out.set(p.id, { id: p.id, public_key: p.public_key || null, e2ee_enabled: !!p.e2ee_enabled });
    return out;
  }

  if (/e2ee_enabled|42703|column/i.test(`${error.message} ${error.code}`)) {
    const legacy = await supabase.from('profiles').select('id, public_key').in('id', ids);
    if (legacy.error) throw legacy.error;
    for (const p of (legacy.data || []) as any[]) out.set(p.id, { id: p.id, public_key: p.public_key || null, e2ee_enabled: !!p.public_key });
    return out;
  }
  throw error;
};
