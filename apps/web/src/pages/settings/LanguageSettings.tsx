import { useUserSettings } from '@/hooks/useUserSettings';
import { setLanguage } from '@/hooks/useT';
import { LANGUAGES, toLang } from '@cinecraft/core';
import { SettingsPageHeader, SettingsRadioRows, SettingsSection, SettingsLoading } from '@/components/settings/SettingsUI';

const LanguageSettings = () => {
  const { settings, updateSetting, loading } = useUserSettings();
  if (loading) return <SettingsLoading />;
  return (
    <>
      <SettingsPageHeader title="Language" description="The language CineCraft uses for menus and sign-in. Posts and messages stay in the language they were written in." />
      <SettingsSection>
        <SettingsRadioRows
          value={toLang(settings?.language)}
          onChange={(v) => { setLanguage(v); updateSetting('language', v); }}
          options={LANGUAGES}
        />
      </SettingsSection>
    </>
  );
};

export default LanguageSettings;
