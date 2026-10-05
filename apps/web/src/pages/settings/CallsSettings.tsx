import { useUserSettings } from '@/hooks/useUserSettings';
import { SettingsPageHeader, SettingsRadioRows, SettingsSection, SettingsToggleRow } from '@/components/settings/SettingsUI';

/** Calls: who can call you and how you join (same options as the mobile app; ringtone and picture-in-picture are phone-only). */
const CallsSettings = () => {
  const { settings, updateSetting } = useUserSettings();
  const s = settings || {};
  return (
    <>
      <SettingsPageHeader title="Calls" description="Voice and video calls." />

      <SettingsSection title="Who can call you">
        <SettingsRadioRows
          value={(s.allow_incoming_calls || 'everyone') as 'everyone' | 'connections' | 'nobody'}
          onChange={(v) => updateSetting('allow_incoming_calls', v)}
          options={[
            { value: 'everyone', label: 'Everyone' },
            { value: 'connections', label: 'Connections only' },
            { value: 'nobody', label: 'Nobody' },
          ]}
        />
      </SettingsSection>

      <SettingsSection title="When you join a call">
        <SettingsToggleRow title="Join with microphone off" checked={!!s.call_mute_mic_on_join} onCheckedChange={(v) => updateSetting('call_mute_mic_on_join', v)} />
        <SettingsToggleRow title="Join with camera off" checked={!!s.call_video_off_on_join} onCheckedChange={(v) => updateSetting('call_video_off_on_join', v)} />
        <SettingsToggleRow title="Data saver" description="Lower video quality to use less data" checked={!!s.call_data_saver} onCheckedChange={(v) => updateSetting('call_data_saver', v)} />
      </SettingsSection>
    </>
  );
};

export default CallsSettings;
