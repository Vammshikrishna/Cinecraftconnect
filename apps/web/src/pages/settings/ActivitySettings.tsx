import { useUserSettings } from '@/hooks/useUserSettings';
import { SettingsPageHeader, SettingsSection, SettingsToggleRow } from '@/components/settings/SettingsUI';

const ActivitySettings = () => {
  const { settings, updateSetting } = useUserSettings();
  const s = settings || {};
  return (
    <>
      <SettingsPageHeader title="Activity status" description="What people can see about your activity." />
      <SettingsSection>
        <SettingsToggleRow title="Show activity status" description="Let people see when you are online and active this week" checked={s.show_online_status !== false} onCheckedChange={(v) => updateSetting('show_online_status', v)} />
        <SettingsToggleRow title="Read receipts" description="Let people know when you have seen their messages" checked={s.read_receipts !== false} onCheckedChange={(v) => updateSetting('read_receipts', v)} />
      </SettingsSection>
    </>
  );
};

export default ActivitySettings;
