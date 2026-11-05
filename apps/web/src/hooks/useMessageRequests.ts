import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { splitRequests, parseSenderState, EMPTY_SENDER_STATE, type MessageRequestRow, type SenderRequestState } from '@/lib/messageRequests';

/** Requests waiting for me (database parts GF and GM).
 *  Part GM: get_message_requests_v2 returns main / hidden / deleted lists. Before it is run the hook falls back to the old
 *  get_message_requests (only the main list). Before part GF is run both fail and this quietly returns nothing. */
export const useMessageRequests = () => {
  const { user } = useAuth();
  const [rows, setRows] = useState<MessageRequestRow[]>([]);
  const [hasV2, setHasV2] = useState(false);

  const refresh = useCallback(async () => {
    if (!user?.id) { setRows([]); return; }
    try {
      const v2 = await (supabase as any).rpc('get_message_requests_v2');
      if (!v2.error && Array.isArray(v2.data)) {
        setRows(v2.data as MessageRequestRow[]);
        setHasV2(true);
        return;
      }
      setHasV2(false);
      const { data, error } = await (supabase as any).rpc('get_message_requests');
      setRows(!error && Array.isArray(data) ? (data as MessageRequestRow[]) : []);
    } catch { setRows([]); setHasV2(false); }
  }, [user?.id]);

  useEffect(() => { refresh(); }, [refresh]);

  useEffect(() => {
    if (!user?.id) return;
    const id = Math.random().toString(36).slice(2);
    const ch = supabase
      .channel(`message_requests_${user.id}_${id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'direct_messages', filter: `receiver_id=eq.${user.id}` }, () => { refresh(); })
      .subscribe();
    const onLocal = () => { refresh(); };
    window.addEventListener('chat_list_update', onLocal);
    window.addEventListener('message_requests_changed', onLocal);
    return () => {
      supabase.removeChannel(ch);
      window.removeEventListener('chat_list_update', onLocal);
      window.removeEventListener('message_requests_changed', onLocal);
    };
  }, [user?.id, refresh]);

  const split = useMemo(() => splitRequests(rows), [rows]);
  return {
    requests: split.main,
    hiddenRequests: split.hidden,
    deletedRequests: split.deleted,
    requestPartnerIds: split.requestPartnerIds,
    pendingUnread: split.pendingUnread,
    /** true when part GM is installed (Hidden requests and Recently deleted exist) */
    hasV2,
    refresh,
  };
};

export type RequestAction = 'accept' | 'delete' | 'decline' | 'ignore' | 'restore';

export const respondToMessageRequest = async (senderId: string, action: RequestAction): Promise<boolean> => {
  // 'delete' is stored as 'decline' (understood by part GF and part GM alike)
  const sent = action === 'delete' ? 'decline' : action;
  const { data, error } = await (supabase as any).rpc('respond_message_request', { p_sender: senderId, p_action: sent });
  if (error || data !== true) return false;
  window.dispatchEvent(new CustomEvent('message_requests_changed'));
  window.dispatchEvent(new CustomEvent('chat_list_update', { detail: {} }));
  return true;
};

/** For the person who wrote first: are they still waiting, and how many messages are left? */
export const useSenderRequestState = (partnerId: string | undefined, refreshKey: number) => {
  const { user } = useAuth();
  const [state, setState] = useState<SenderRequestState>(EMPTY_SENDER_STATE);
  useEffect(() => {
    if (!user?.id || !partnerId) { setState(EMPTY_SENDER_STATE); return; }
    let cancelled = false;
    (async () => {
      try {
        const { data, error } = await (supabase as any).rpc('get_dm_request_state', { p_partner: partnerId });
        if (!cancelled) setState(error ? EMPTY_SENDER_STATE : parseSenderState(data));
      } catch { if (!cancelled) setState(EMPTY_SENDER_STATE); }
    })();
    return () => { cancelled = true; };
  }, [user?.id, partnerId, refreshKey]);
  return state;
};
