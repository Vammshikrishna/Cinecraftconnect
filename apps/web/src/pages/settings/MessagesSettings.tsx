import { useUserSettings } from '@/hooks/useUserSettings';
import { SettingsPageHeader, SettingsRadioRows, SettingsSection } from '@/components/settings/SettingsUI';

const MessagesSettings = () => {
  const { settings, updateSetting } = useUserSettings();
  return (
    <>
      <SettingsPageHeader title="Messages" description="Who can send you direct messages." />
      <SettingsSection>
        <SettingsRadioRows
          value={(settings?.allow_messages_from || 'everyone') as 'everyone' | 'connections' | 'nobody'}
          onChange={(v) => updateSetting('allow_messages_from', v)}
          options={[
            { value: 'everyone', label: 'Everyone' },
            { value: 'connections', label: 'Connections only' },
            { value: 'nobody', label: 'Nobody', description: 'People you already talk to can still reply' },
          ]}
        />
      </SettingsSection>
    </>
  );
};

export default MessagesSettings;
