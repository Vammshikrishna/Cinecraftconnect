import { useUserSettings } from '@/hooks/useUserSettings';
import { SettingsPageHeader, SettingsRadioRows, SettingsSection } from '@/components/settings/SettingsUI';

const RequestsSettings = () => {
  const { settings, updateSetting } = useUserSettings();
  return (
    <>
      <SettingsPageHeader title="Connection requests" description="Who can send you a connection request." />
      <SettingsSection>
        <SettingsRadioRows
          value={(settings?.allow_connection_requests || 'everyone') as 'everyone' | 'mutuals' | 'nobody'}
          onChange={(v) => updateSetting('allow_connection_requests', v)}
          options={[
            { value: 'everyone', label: 'Everyone' },
            { value: 'mutuals', label: 'Mutual connections only' },
            { value: 'nobody', label: 'Nobody' },
          ]}
        />
      </SettingsSection>
    </>
  );
};

export default RequestsSettings;
