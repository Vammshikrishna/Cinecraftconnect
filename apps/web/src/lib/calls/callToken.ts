import { supabase } from '@/integrations/supabase/client';

/** Name the call service shows for me. One rule, so a token fetched early matches the one the call screen asks for. */
export const callParticipantName = (
  profile: { full_name?: string | null } | null | undefined,
  user: { id: string; email?: string | null },
) => profile?.full_name?.trim() || user.email?.split('@')[0] || user.id;

const inflight = new Map<string, Promise<any>>();

/**
 * Asks for the call token. The first call for a room starts the request, and later calls for the same room and name
 * share it, so the call can ask while the database is still being updated and the call screen finds it ready.
 */
export function fetchCallToken(roomName: string, participantName: string): Promise<any> {
  const key = `${roomName}|${participantName}`;
  const existing = inflight.get(key);
  if (existing) return existing;
  const request = supabase.functions.invoke('livekit-token', { body: { roomName, participantName } });
  inflight.set(key, request);
  // a failed answer must not be reused, and a token should not be shared for long
  request.then((r: any) => { if (r?.error) inflight.delete(key); }, () => inflight.delete(key));
  setTimeout(() => inflight.delete(key), 20000);
  return request;
}

let warmed = false;

/** Wakes the token function so the first call of a session does not wait for it to start up. */
export function warmCallService() {
  if (warmed) return;
  warmed = true;
  // signed in, so the gateway lets it through; the function answers { ok: true } without making a token
  supabase.functions.invoke('livekit-token', { body: { warm: true } }).catch(() => { warmed = false; });
}
