import { useEffect, useState } from 'react';
import { Lock, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { useE2EEBackup } from '@/contexts/E2EEBackupContext';
import { useE2EEActions } from '@/hooks/useE2EEActions';

const key = (userId: string) => `e2ee_offer_dismissed_${userId}`;

/**
 * Shown at the top of the chat list to people who have not turned encrypted messages on.
 * "Not now" hides it for good (they can still turn it on in Settings > Messages or from any chat banner).
 */
export const E2EEOfferCard = () => {
  const { user } = useAuth();
  const { e2eeEnabled } = useE2EEBackup();
  const { turnOn, busy } = useE2EEActions();
  const [dismissed, setDismissed] = useState(true); // hidden until we know

  useEffect(() => {
    if (!user) return;
    try { setDismissed(localStorage.getItem(key(user.id)) === '1'); } catch { setDismissed(false); }
  }, [user?.id]);

  if (!user || e2eeEnabled !== false || dismissed) return null;

  const hide = () => {
    setDismissed(true);
    try { localStorage.setItem(key(user.id), '1'); } catch { /* storage unavailable: it will simply show again next time */ }
  };

  return (
    <div className="mx-2 mt-2 rounded-2xl border border-primary/20 bg-primary/5 p-3 relative" role="region" aria-label="Encrypted messages">
      <button type="button" onClick={hide} aria-label="Dismiss" className="absolute right-2 top-2 h-8 w-8 flex items-center justify-center rounded-full text-muted-foreground hover:bg-muted">
        <X className="h-4 w-4" />
      </button>
      <div className="flex items-start gap-3 pr-8">
        <div className="h-9 w-9 shrink-0 rounded-full bg-primary/10 text-primary flex items-center justify-center"><Lock className="h-4 w-4" /></div>
        <div className="min-w-0">
          <p className="text-sm font-semibold leading-tight">Turn on encrypted messages</p>
          <p className="text-xs text-muted-foreground mt-0.5 leading-snug">
            Keep your private chats readable only by you and the other person. You will create a 6-digit PIN to restore chats on a new device.
          </p>
          <div className="flex gap-2 mt-2.5">
            <Button size="sm" disabled={busy} onClick={() => { void turnOn(); }}>Turn on</Button>
            <Button size="sm" variant="ghost" onClick={hide}>Not now</Button>
          </div>
        </div>
      </div>
    </div>
  );
};
