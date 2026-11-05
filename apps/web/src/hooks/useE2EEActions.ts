import { useCallback, useState } from 'react';
import { toast } from '@/hooks/use-toast';
import { friendlyError } from '@cinecraft/core';
import { useE2EEBackup } from '@/contexts/E2EEBackupContext';
import { confirmDialog } from '@/lib/confirmDialog';

/**
 * The two things a person can do with encrypted messages, with the explanations they need first.
 * Used by the Settings switch and by the chat banners so the wording and the safety steps are identical.
 */
export const useE2EEActions = () => {
  const { enableE2EE, disableE2EE, openPrompt } = useE2EEBackup();
  const [busy, setBusy] = useState(false);

  const turnOn = useCallback(async (): Promise<boolean> => {
    const ok = await confirmDialog(
      'Messages with people who also turn it on will be end-to-end encrypted: only the two of you can read them, not even CineCraft. You will create a 6-digit PIN so you can restore your chats on a new device. If you forget the PIN and lose this device, those messages cannot be recovered.',
      { title: 'Turn on encrypted messages?', confirmLabel: 'Turn on', destructive: false },
    );
    if (!ok) return false;
    setBusy(true);
    try {
      await enableE2EE();
      return true;
    } catch (e: any) {
      toast.error('Could not turn on encrypted messages', friendlyError(e));
      return false;
    } finally {
      setBusy(false);
    }
  }, [enableE2EE]);

  const turnOff = useCallback(async (): Promise<boolean> => {
    const ok = await confirmDialog(
      'New messages will be sent without end-to-end encryption, and people will see that you turned it off. Your keys and PIN backup are kept, so your old encrypted messages stay readable and you can turn it on again any time.',
      { title: 'Turn off encrypted messages?', confirmLabel: 'Turn off', destructive: true },
    );
    if (!ok) return false;
    setBusy(true);
    try {
      await disableE2EE();
      toast.success('Encrypted messages are off');
      return true;
    } catch (e: any) {
      toast.error('Could not turn off encrypted messages', friendlyError(e));
      return false;
    } finally {
      setBusy(false);
    }
  }, [disableE2EE]);

  return { turnOn, turnOff, unlock: openPrompt, busy };
};
