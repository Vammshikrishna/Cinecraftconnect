import { Lock, LockOpen, KeyRound } from 'lucide-react';
import { dmBanner, type DmPolicyReason } from '@cinecraft/core';
import { Button } from '@/components/ui/button';
import { useE2EEActions } from '@/hooks/useE2EEActions';

/**
 * One line at the top of a conversation that always tells the truth about whether it is encrypted.
 * Encrypted: a quiet note. Not encrypted: says why, so nobody believes a chat is private when it is not.
 * Locked: a button to enter the PIN.
 */
export const E2EEChatBanner = ({ reason, partnerName }: { reason: DmPolicyReason; partnerName?: string }) => {
  const { turnOn, unlock, busy } = useE2EEActions();
  const banner = dmBanner(reason, partnerName || 'this person');

  if (banner.kind === 'encrypted') {
    return (
      <div className="shrink-0 flex items-center justify-center gap-1.5 px-4 py-1.5 text-[12px] text-muted-foreground border-b border-border/50" role="status">
        <Lock className="h-3 w-3 shrink-0" aria-hidden="true" />
        <span>{banner.title}. {banner.detail}</span>
      </div>
    );
  }

  const locked = banner.kind === 'locked';
  return (
    <div
      className={`shrink-0 flex items-center gap-3 px-4 py-2 border-b text-xs ${locked ? 'bg-amber-500/10 border-amber-500/30' : 'bg-muted/50 border-border/50'}`}
      role="status"
    >
      {locked ? <KeyRound className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden="true" /> : <LockOpen className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />}
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-foreground leading-tight">{banner.title}</p>
        <p className="text-muted-foreground leading-snug">{banner.detail}</p>
      </div>
      {banner.action === 'unlock' && <Button size="sm" onClick={unlock}>Unlock</Button>}
      {banner.action === 'turn_on' && <Button size="sm" variant="outline" disabled={busy} onClick={() => { void turnOn(); }}>Turn on</Button>}
    </div>
  );
};
