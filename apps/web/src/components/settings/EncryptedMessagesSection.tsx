import { useE2EEBackup } from '@/contexts/E2EEBackupContext';
import { useE2EEActions } from '@/hooks/useE2EEActions';
import { SettingsLinkRow, SettingsNote, SettingsSection, SettingsToggleRow } from '@/components/settings/SettingsUI';

/** Settings > Messages: the opt-in switch for end-to-end encryption, with an honest explanation of what it covers. */
export const EncryptedMessagesSection = () => {
  const { e2eeEnabled, hasLocalKey, isSetupRequired } = useE2EEBackup();
  const { turnOn, turnOff, unlock, busy } = useE2EEActions();

  const status =
    e2eeEnabled === null ? 'Checking…'
    : !e2eeEnabled ? 'Off. Your chats are normal chats that CineCraft can process (search, safety checks).'
    : !hasLocalKey ? 'On, but locked on this device. Enter your PIN to read and send encrypted messages here.'
    : isSetupRequired ? 'On. Create a recovery PIN so you can restore your chats on a new device.'
    : 'On and unlocked on this device.';

  return (
    <>
      <SettingsSection title="Encrypted messages" description="Protect your private conversations so only the people in them can read them.">
        <SettingsToggleRow
          title="End-to-end encrypted messages"
          description={status}
          checked={!!e2eeEnabled}
          disabled={busy || e2eeEnabled === null}
          onCheckedChange={(on) => { void (on ? turnOn() : turnOff()); }}
        />
        {e2eeEnabled && !hasLocalKey && (
          <SettingsLinkRow title="Unlock on this device" description="Enter your 6-digit recovery PIN" onClick={unlock} />
        )}
        {e2eeEnabled && hasLocalKey && isSetupRequired && (
          <SettingsLinkRow title="Create recovery PIN" description="Needed to restore chats on a new device" onClick={unlock} />
        )}
      </SettingsSection>
      <SettingsNote>
        A chat is encrypted only when both people have this on. Encrypted rooms and project spaces need it on for every
        member. Public discussion rooms are never encrypted. Each conversation shows whether it is encrypted.
      </SettingsNote>
    </>
  );
};
