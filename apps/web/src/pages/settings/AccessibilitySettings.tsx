import { useUserSettings } from '@/hooks/useUserSettings';
import { SettingsPageHeader, SettingsSection, SettingsToggleRow } from '@/components/settings/SettingsUI';

const AccessibilitySettings = () => {
  const { settings, updateSetting } = useUserSettings();
  const s = settings || {};
  return (
    <>
      <SettingsPageHeader title="Accessibility" description="Make CineCraft easier to see and use." />
      <SettingsSection>
        <SettingsToggleRow title="High contrast" description="Stronger text and borders" checked={!!s.high_contrast} onCheckedChange={(v) => updateSetting('high_contrast', v)} />
        <SettingsToggleRow title="Reduce motion" description="Turn off animations and transitions" checked={!!s.reduce_motion} onCheckedChange={(v) => updateSetting('reduce_motion', v)} />
      </SettingsSection>
    </>
  );
};

export default AccessibilitySettings;
