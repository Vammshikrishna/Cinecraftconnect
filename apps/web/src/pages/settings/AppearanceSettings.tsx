import { useTheme } from '@/components/theme-provider';
import { useUserSettings } from '@/hooks/useUserSettings';
import { SettingsPageHeader, SettingsSection, SettingsRadioRows, useScrollToHash } from '@/components/settings/SettingsUI';

const AppearanceSettings = () => {
  const { settings, loading, updateSetting } = useUserSettings();
  const { theme, setTheme } = useTheme();
  useScrollToHash(!loading);

  return (
    <>
      <SettingsPageHeader title="Appearance" description="How CineCraft looks for you." />

      <SettingsSection title="Theme">
        <SettingsRadioRows
          value={(theme || 'system') as 'system' | 'light' | 'dark'}
          onChange={(v) => { setTheme(v); updateSetting('theme', v); }}
          options={[
            { value: 'system', label: 'System default', description: 'Follows your device setting' },
            { value: 'light', label: 'Light' },
            { value: 'dark', label: 'Dark' },
          ]}
        />
      </SettingsSection>

      <SettingsSection title="Text size">
        <SettingsRadioRows
          value={(settings?.font_size || 'medium') as 'small' | 'medium' | 'large'}
          onChange={(v) => updateSetting('font_size', v)}
          options={[
            { value: 'small', label: 'Small' },
            { value: 'medium', label: 'Default' },
            { value: 'large', label: 'Large' },
          ]}
        />
      </SettingsSection>
    </>
  );
};

export default AppearanceSettings;
