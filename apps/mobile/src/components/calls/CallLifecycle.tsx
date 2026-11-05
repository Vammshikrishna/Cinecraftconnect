import { useEffect, useRef, useCallback } from 'react';
import { Alert } from 'react-native';
import { getSupabaseClient } from '@cinecraft/api';
import { useGlobalCall } from '../../contexts/CallContext';
import { useLiveCall } from '../../hooks/useLiveCall';
import { startRingback, stopRingback, playBusyTone } from '../../services/liveCall';
import { resetCallTrack, updateCallTrack } from '../../services/callService';
import { announceCallEnded, normalizeCallRoomType } from '../../services/callSession';

/**
 * App-wide supervisor for the running call. It lives here (not in a screen) because the call keeps running while the
 * user is on the full call screen, the in-room Call tab, the Chat tab or the floating bubble, and all of those need
 * the same behaviour: ringing tone, no-answer timeout, hang-up when the other person leaves a 1-to-1 call, ending
 * the call when it was declined/cancelled elsewhere, and a clear message when the call could not start.
 */
const RECONNECT_GRACE_MS = 20000;

export const CallLifecycle = () => {
  const { callState, endCall, updateCallState } = useGlobalCall();
  const live = useLiveCall();

  const endedRef = useRef(false);
  const hadRemoteRef = useRef(false);
  const durationRef = useRef(0);
  durationRef.current = callState.callDuration;

  // New call: reset the per-call flags.
  useEffect(() => {
    if (callState.isActive) {
      endedRef.current = false;
      hadRemoteRef.current = false;
      resetCallTrack(callState.roomId);
    }
  }, [callState.isActive, callState.roomId]);

  // Caller / answered tracking (web's callerRef / answeredRef) so a call nobody picked up is posted as "Missed call".
  useEffect(() => {
    if (!callState.isActive) return;
    updateCallTrack(callState.roomId, { caller: live.isCaller, answered: live.remoteCount > 0 });
  }, [callState.isActive, callState.roomId, live.isCaller, live.remoteCount]);

  const hangUp = useCallback(() => {
    if (endedRef.current || !callState.isActive || !callState.roomId) return;
    endedRef.current = true;
    const isSpace = live.mode === 'audio_space';
    // In a space only the host's departure is announced in the chat; a listener leaving is silent.
    if (!isSpace || live.myRole === 'host') {
      void announceCallEnded({
        roomType: callState.roomType,
        roomId: callState.roomId,
        partnerId: callState.partnerId,
        durationSecs: durationRef.current,
        kind: isSpace ? 'space' : 'call',
      });
    }
    endCall();
  }, [callState.isActive, callState.roomId, callState.roomType, callState.partnerId, endCall, live.mode, live.myRole]);

  // Setup failed (no mic permission, no network, not allowed in this room): tell the user and clean up.
  useEffect(() => {
    if (live.phase !== 'failed' || endedRef.current) return;
    endedRef.current = true;
    Alert.alert('Call could not start', live.message || 'Could not connect the call. Please try again.');
    endCall();
  }, [live.phase, live.message, endCall]);

  // Outgoing "ringing…" tone: only the caller hears it, and only until someone joins.
  useEffect(() => {
    const ringing =
      callState.isActive &&
      live.mode !== 'audio_space' &&
      live.isCaller &&
      live.remoteCount === 0 &&
      !callState.partnerReconnecting &&
      (live.phase === 'connecting' || live.phase === 'connected');
    if (ringing) startRingback();
    else stopRingback();
    return () => stopRingback();
  }, [callState.isActive, callState.partnerReconnecting, live.mode, live.isCaller, live.remoteCount, live.phase]);

  // Nobody joined within 45s (same window as the server-side call expiry): hang up like a missed call.
  useEffect(() => {
    // An audio space may sit with only the host for a long time while people arrive.
    if (!callState.isActive || live.mode === 'audio_space' || live.phase !== 'connected' || live.remoteCount > 0) return;
    const t = setTimeout(() => {
      if (endedRef.current) return;
      playBusyTone();
      Alert.alert('No answer', 'Nobody joined the call.');
      hangUp();
    }, 45000);
    return () => clearTimeout(t);
  }, [callState.isActive, live.mode, live.phase, live.remoteCount, hangUp]);

  // 1-to-1 call: when the other person hangs up, end ours too, like a phone call.
  useEffect(() => {
    if (!callState.isActive) return;
    if (live.remoteCount > 0) {
      hadRemoteRef.current = true;
      return;
    }
    // The other person may only have dropped (reload, a few seconds without network): wait the 20 s grace before
    // ending. A real hang-up arrives as the call_ended broadcast below and ends the call at once.
    if (hadRemoteRef.current && normalizeCallRoomType(callState.roomType) === 'direct' && live.mode !== 'audio_space' && live.phase === 'connected') {
      updateCallState({ partnerReconnecting: true });
      const t = setTimeout(hangUp, RECONNECT_GRACE_MS);
      return () => {
        clearTimeout(t);
        updateCallState({ partnerReconnecting: false });
      };
    }
  }, [callState.isActive, callState.roomType, live.mode, live.remoteCount, live.phase, hangUp, updateCallState]);

  // The web app / other devices tell us when a call was declined or cancelled.
  useEffect(() => {
    if (!callState.isActive || !callState.roomId || live.mode === 'audio_space') return;
    const roomId = callState.roomId;
    const roomType = callState.roomType;
    const supabase = getSupabaseClient();
    const channel = supabase.channel('global-call-invites-broadcast');
    const matches = (payload: any) => {
      const p = payload?.roomId || '';
      // the channel is open to every signed-in person: only a full room id counts, never a short or partial one
      return typeof p === 'string' && p.length >= 20 && (p === roomId || p === payload?.cleanId || String(roomId).includes(p));
    };
    const onEnd = ({ payload }: any) => {
      if (!endedRef.current && matches(payload) && live.remoteCount === 0) hangUp();
    };
    // The other person pressed hang-up in a 1:1 call: end at once (no grace, that is only for a mere disconnect).
    const onPartnerHangup = ({ payload }: any) => {
      if (!endedRef.current && hadRemoteRef.current && matches(payload) && normalizeCallRoomType(roomType) === 'direct') hangUp();
    };
    channel
      .on('broadcast', { event: 'call_declined' }, onEnd)
      .on('broadcast', { event: 'call_cancelled' }, onEnd)
      .on('broadcast', { event: 'call_ended' }, onPartnerHangup)
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [callState.isActive, callState.roomId, callState.roomType, live.mode, live.remoteCount, hangUp]);

  return null;
};
