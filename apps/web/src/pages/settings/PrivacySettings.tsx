import { useUserSettings } from '@/hooks/useUserSettings';
import { useBlockedUsers } from '@/hooks/useBlockedUsers';
import { SettingsLinkRow, SettingsPageHeader, SettingsRadioRows, SettingsSection, SettingsToggleRow, useScrollToHash } from '@/components/settings/SettingsUI';

const PrivacySettings = () => {
  const { settings, loading, updateSetting } = useUserSettings();
  const { blocked } = useBlockedUsers();
  useScrollToHash(!loading);
  const s = settings || {};

  return (
    <>
      <SettingsPageHeader title="Account privacy" description="Who can see your work and reach you." />

      <SettingsSection title="Who can see your profile details" description="Your name, photo, craft and bio are always visible. This controls your work, skills, credits and contact links.">
        <SettingsRadioRows
          value={(s.profile_visibility || 'public') as 'public' | 'connections' | 'private'}
          onChange={(v) => updateSetting('profile_visibility', v)}
          options={[
            { value: 'public', label: 'Public', description: 'Anyone on CineCraft' },
            { value: 'connections', label: 'Connections', description: 'Only people you are connected with' },
            { value: 'private', label: 'Private', description: 'Only you' },
          ]}
        />
      </SettingsSection>

      <SettingsSection title="Contact details on your profile">
        <SettingsToggleRow title="Show email" checked={!!s.show_email} onCheckedChange={(v) => updateSetting('show_email', v)} />
        <SettingsToggleRow title="Show location" checked={s.show_location !== false} onCheckedChange={(v) => updateSetting('show_location', v)} />
      </SettingsSection>

      <SettingsSection title="Blocked">
        <SettingsLinkRow title="Blocked accounts" value={String(blocked.length)} to="/settings/blocked" />
      </SettingsSection>
    </>
  );
};

export default PrivacySettings;
