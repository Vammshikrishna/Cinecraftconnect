import { useEffect, useState } from 'react';
import { useGlobalCall } from '@/contexts/CallContext';

/**
 * Whether a call or an audio space is already running in a room (started by anyone). Used so the room offers
 * "Join" instead of "Start a call / Start an audio space" — starting a new one would end the running one.
 * Re-checks when the room changes, when our own call state changes, and every few seconds while the page is open.
 */
export const useActiveRoomCall = (roomType: 'discussion' | 'project' | 'direct', roomId: string | null | undefined) => {
  const { findActiveCall, callState } = useGlobalCall();
  const [active, setActive] = useState<{ mode: 'call' | 'audio_space' } | null>(null);

  useEffect(() => {
    if (!roomId) {
      setActive(null);
      return;
    }
    let cancelled = false;
    const check = async () => {
      const result = await findActiveCall(roomType, roomId);
      if (!cancelled) setActive(result);
    };
    check();
    const timer = setInterval(check, 6000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [roomType, roomId, callState.isActive]);

  return active;
};
