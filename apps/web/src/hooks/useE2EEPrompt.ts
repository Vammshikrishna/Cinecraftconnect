import { useEffect } from 'react';
import { useE2EEBackup } from '@/contexts/E2EEBackupContext';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Call on screens that are about messages (chat list, a conversation, an encrypted room or space).
 * It asks the E2EE context to show the PIN screen when one is needed (create a PIN, or unlock this device).
 * Pages that are not about messages never call it, so the dialog never interrupts them.
 * The dialog only opens for people who turned encrypted messages on.
 */
export const useE2EEPrompt = (enabled = true) => {
  const { requestPrompt, cancelPrompt } = useE2EEBackup();
  const { user } = useAuth();
  useEffect(() => {
    if (!enabled) return;
    requestPrompt();
    // leaving the screen takes the request back, so the PIN screen only ever shows on message screens
    return () => cancelPrompt();
  }, [enabled, user?.id]); // eslint-disable-line react-hooks/exhaustive-deps
};
