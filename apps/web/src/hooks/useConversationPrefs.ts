import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { ChatPrefs, canPinChat, readLocalPrefs, writeLocalPrefs, MAX_PINNED_CHATS } from '@/lib/conversationPrefs';

const EVENT = 'cc:convo-prefs';

/**
 * Per-person Mute and Pin for direct chats. Saved in conversation_prefs (supabase/manual/part_ge_chat_prefs.sql);
 * until that table exists the choice is kept in this browser only.
 */
export function useConversationPrefs() {
  const { user } = useAuth();
  const userId = user?.id;
  const [prefs, setPrefs] = useState<ChatPrefs>(() => readLocalPrefs(userId));

  useEffect(() => {
    setPrefs(readLocalPrefs(userId));
    if (!userId) return;
    let cancelled = false;
    (async () => {
      const { data, error } = await (supabase as any).from('conversation_prefs').select('partner_id, muted, pinned').eq('user_id', userId);
      if (cancelled || error || !data) return; // table missing: keep the local copy
      const next: ChatPrefs = {};
      for (const r of data) next[r.partner_id] = { muted: !!r.muted, pinned: !!r.pinned };
      writeLocalPrefs(userId, next);
      setPrefs(next);
    })();
    const onChange = () => setPrefs(readLocalPrefs(userId));
    window.addEventListener(EVENT, onChange);
    return () => { cancelled = true; window.removeEventListener(EVENT, onChange); };
  }, [userId]);

  const save = useCallback(async (partnerId: string, patch: { muted?: boolean; pinned?: boolean }): Promise<{ ok: boolean; message?: string }> => {
    if (!userId) return { ok: false, message: 'Sign in first' };
    const current = readLocalPrefs(userId);
    const merged = { muted: !!current[partnerId]?.muted, pinned: !!current[partnerId]?.pinned, ...patch };
    const { error } = await (supabase as any).from('conversation_prefs').upsert({ user_id: userId, partner_id: partnerId, ...merged }, { onConflict: 'user_id,partner_id' });
    const missing = !!error && (error.code === 'PGRST205' || error.code === '42P01' || /does not exist|schema cache/i.test(error.message || ''));
    if (error && !missing) {
      return { ok: false, message: /pin up to 3/i.test(error.message || '') ? `You can pin up to ${MAX_PINNED_CHATS} chats` : 'Could not save that. Try again.' };
    }
    const next = { ...current, [partnerId]: merged };
    writeLocalPrefs(userId, next);
    setPrefs(next);
    window.dispatchEvent(new Event(EVENT));
    return { ok: true };
  }, [userId]);

  const toggleMute = useCallback((partnerId: string) => save(partnerId, { muted: !prefs[partnerId]?.muted }), [save, prefs]);

  const togglePin = useCallback(async (partnerId: string) => {
    if (!prefs[partnerId]?.pinned && !canPinChat(prefs, partnerId)) {
      return { ok: false, message: `You can pin up to ${MAX_PINNED_CHATS} chats. Unpin one first.` };
    }
    return save(partnerId, { pinned: !prefs[partnerId]?.pinned });
  }, [save, prefs]);

  return { prefs, toggleMute, togglePin };
}
