import { useState, useEffect, useCallback, useMemo } from 'react';
import { DeviceEventEmitter } from 'react-native';
import { getSupabaseClient } from '@cinecraft/api';
import { resolveCurrentUserId, getCurrentUserIdSync } from '../services/offlineCache';
import {
  splitRequests,
  parseSenderState,
  EMPTY_SENDER_STATE,
  MESSAGE_REQUESTS_CHANGED,
  type MessageRequestRow,
  type SenderRequestState,
} from '../utils/messageRequests';

/** Requests waiting for me. If the RPC is missing or fails this quietly returns nothing (feature off). */
export const useMessageRequests = () => {
  const [userId, setUserId] = useState<string | null>(getCurrentUserIdSync());
  const [rows, setRows] = useState<MessageRequestRow[]>([]);
  const [hasV2, setHasV2] = useState(false);

  useEffect(() => {
    let alive = true;
    resolveCurrentUserId().then((id) => { if (alive && id) setUserId(id); }).catch(() => { });
    return () => { alive = false; };
  }, []);

  const refresh = useCallback(async () => {
    if (!userId) { setRows([]); return; }
    try {
      // part GM: main / hidden / deleted lists; before it is run fall back to the old function (main list only)
      const v2 = await (getSupabaseClient() as any).rpc('get_message_requests_v2');
      if (!v2.error && Array.isArray(v2.data)) {
        setRows(v2.data as MessageRequestRow[]);
        setHasV2(true);
        return;
      }
      setHasV2(false);
      const { data, error } = await (getSupabaseClient() as any).rpc('get_message_requests');
      setRows(!error && Array.isArray(data) ? (data as MessageRequestRow[]) : []);
    } catch { setRows([]); setHasV2(false); }
  }, [userId]);

  useEffect(() => { refresh(); }, [refresh]);

  useEffect(() => {
    if (!userId) return;
    let ch: any;
    try {
      const sb = getSupabaseClient() as any;
      ch = sb
        .channel(`message_requests_${userId}_${Math.random().toString(36).slice(2)}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'direct_messages', filter: `receiver_id=eq.${userId}` }, () => { refresh(); })
        .subscribe();
    } catch { /* realtime off: the list refreshes on open */ }
    const sub = DeviceEventEmitter.addListener(MESSAGE_REQUESTS_CHANGED, () => { refresh(); });
    return () => {
      sub.remove();
      try { if (ch) (getSupabaseClient() as any).removeChannel(ch); } catch { }
    };
  }, [userId, refresh]);

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
  try {
    // 'delete' is stored as 'decline' (understood by part GF and part GM alike)
    const sent = action === 'delete' ? 'decline' : action;
    const { data, error } = await (getSupabaseClient() as any).rpc('respond_message_request', { p_sender: senderId, p_action: sent });
    if (error || data !== true) return false;
    DeviceEventEmitter.emit(MESSAGE_REQUESTS_CHANGED);
    return true;
  } catch { return false; }
};

/** For the person who wrote first: are they still waiting, and how many messages are left? */
export const useSenderRequestState = (partnerId: string | undefined | null, refreshKey: number) => {
  const [state, setState] = useState<SenderRequestState>(EMPTY_SENDER_STATE);
  useEffect(() => {
    if (!partnerId) { setState(EMPTY_SENDER_STATE); return; }
    let cancelled = false;
    (async () => {
      try {
        const { data, error } = await (getSupabaseClient() as any).rpc('get_dm_request_state', { p_partner: partnerId });
        if (!cancelled) setState(error ? EMPTY_SENDER_STATE : parseSenderState(data));
      } catch { if (!cancelled) setState(EMPTY_SENDER_STATE); }
    })();
    return () => { cancelled = true; };
  }, [partnerId, refreshKey]);
  return state;
};
