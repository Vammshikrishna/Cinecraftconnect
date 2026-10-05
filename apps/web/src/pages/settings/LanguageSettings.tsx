import { useUserSettings } from '@/hooks/useUserSettings';
import { SettingsPageHeader, SettingsRadioRows, SettingsSection } from '@/components/settings/SettingsUI';

const LanguageSettings = () => {
  const { settings, updateSetting } = useUserSettings();
  return (
    <>
      <SettingsPageHeader title="Language" description="The language CineCraft uses for you." />
      <SettingsSection>
        <SettingsRadioRows
          value={settings?.language || 'en'}
          onChange={(v) => updateSetting('language', v)}
          options={[
            { value: 'en', label: 'English' },
            { value: 'hi', label: 'हिन्दी' },
            { value: 'es', label: 'Español' },
            { value: 'fr', label: 'Français' },
            { value: 'de', label: 'Deutsch' },
          ]}
        />
      </SettingsSection>
    </>
  );
};

export default LanguageSettings;
