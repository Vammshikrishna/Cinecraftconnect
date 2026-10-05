import { useUserSettings } from '@/hooks/useUserSettings';
import { SettingsPageHeader, SettingsSection, SettingsToggleRow, useScrollToHash } from '@/components/settings/SettingsUI';

const NotificationsSettings = () => {
  const { settings, loading, updateSetting } = useUserSettings();
  useScrollToHash(!loading);
  const s = settings || {};
  const pushOn = s.push_notifications !== false;

  return (
    <>
      <SettingsPageHeader title="Notifications" description="Choose what you hear about and how." />

      <SettingsSection title="Ways to get notified">
        <SettingsToggleRow title="Push notifications" description="On this browser and your phone" checked={pushOn} onCheckedChange={(v) => updateSetting('push_notifications', v)} />
        <SettingsToggleRow title="Email" description="Updates and summaries by email" checked={s.email_notifications !== false} onCheckedChange={(v) => updateSetting('email_notifications', v)} />
      </SettingsSection>

      <SettingsSection title="What you get notified about">
        <SettingsToggleRow title="Messages" checked={s.message_notifications !== false} onCheckedChange={(v) => updateSetting('message_notifications', v)} />
        <SettingsToggleRow title="Comments and mentions" checked={s.comment_notifications !== false} onCheckedChange={(v) => updateSetting('comment_notifications', v)} />
        <SettingsToggleRow title="Project updates" checked={s.project_notifications !== false} onCheckedChange={(v) => updateSetting('project_notifications', v)} />
        <SettingsToggleRow title="Job alerts" checked={s.job_alerts !== false} onCheckedChange={(v) => updateSetting('job_alerts', v)} />
      </SettingsSection>
    </>
  );
};

export default NotificationsSettings;
