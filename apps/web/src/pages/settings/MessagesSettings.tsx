import { useUserSettings } from '@/hooks/useUserSettings';
import { SettingsPageHeader, SettingsRadioRows, SettingsSection, SettingsLoading } from '@/components/settings/SettingsUI';
import { EncryptedMessagesSection } from '@/components/settings/EncryptedMessagesSection';

const MessagesSettings = () => {
  const { settings, updateSetting, loading } = useUserSettings();
  if (loading) return <SettingsLoading />;
  return (
    <>
      <SettingsPageHeader title="Messages" description="Who can message you, and how your chats are protected." />
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
      <EncryptedMessagesSection />
    </>
  );
};

export default MessagesSettings;
