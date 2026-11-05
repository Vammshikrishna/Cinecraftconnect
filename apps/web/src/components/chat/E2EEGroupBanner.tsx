import { Lock, KeyRound, ShieldAlert } from 'lucide-react';
import { canJoinEncryptedGroup } from '@cinecraft/core';
import { Button } from '@/components/ui/button';
import { useE2EEBackup } from '@/contexts/E2EEBackupContext';
import { useE2EEActions } from '@/hooks/useE2EEActions';

/**
 * Top of an encrypted room or project space. Everyone in the group shares one key, so a member must have encrypted
 * messages turned on (and unlocked on this device) to read and write here.
 */
export const E2EEGroupBanner = ({ label }: { label: 'room' | 'space' }) => {
  const { e2eeEnabled, hasLocalKey, isChecking } = useE2EEBackup();
  const { turnOn, unlock, busy } = useE2EEActions();
  if (isChecking || e2eeEnabled === null) return null;

  const gate = canJoinEncryptedGroup({ selfEnabled: !!e2eeEnabled, selfHasKeys: hasLocalKey });
  if (gate.ok) {
    return (
      <div className="shrink-0 flex items-center justify-center gap-1.5 px-4 py-1.5 text-[12px] text-muted-foreground border-b border-border/50" role="status">
        <Lock className="h-3 w-3 shrink-0" aria-hidden="true" />
        <span>Messages in this {label} are end-to-end encrypted. Only members can read them.</span>
      </div>
    );
  }

  const needsTurnOn = gate.reason === 'turn_on';
  return (
    <div className="shrink-0 flex items-center gap-3 px-4 py-2 border-b border-amber-500/30 bg-amber-500/10 text-xs" role="status">
      {needsTurnOn
        ? <ShieldAlert className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden="true" />
        : <KeyRound className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden="true" />}
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-foreground leading-tight">
          {needsTurnOn ? `This ${label} is end-to-end encrypted` : 'Unlock your encrypted messages'}
        </p>
        <p className="text-muted-foreground leading-snug">
          {needsTurnOn
            ? 'Turn on encrypted messages to read and send messages here.'
            : 'Enter your PIN to read and send messages here.'}
        </p>
      </div>
      {needsTurnOn
        ? <Button size="sm" disabled={busy} onClick={() => { void turnOn(); }}>Turn on</Button>
        : <Button size="sm" onClick={unlock}>Unlock</Button>}
    </div>
  );
};
