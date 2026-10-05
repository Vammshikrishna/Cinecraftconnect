import { useUserSettings } from '@/hooks/useUserSettings';
import { SettingsPageHeader, SettingsSection, SettingsToggleRow } from '@/components/settings/SettingsUI';

const SoundSettings = () => {
  const { settings, updateSetting } = useUserSettings();
  const s = settings || {};
  return (
    <>
      <SettingsPageHeader title="Sound" description="In-app sounds and chimes." />
      <SettingsSection>
        <SettingsToggleRow title="Sound effects" description="Clicks and small sounds in the app" checked={s.sound_effects !== false} onCheckedChange={(v) => updateSetting('sound_effects', v)} />
        <SettingsToggleRow title="Message and call chimes" description="Play a sound for new messages and calls" checked={s.notification_sounds !== false} onCheckedChange={(v) => updateSetting('notification_sounds', v)} />
      </SettingsSection>
    </>
  );
};

export default SoundSettings;
