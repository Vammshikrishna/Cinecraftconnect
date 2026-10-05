import { useUserSettings } from '@/hooks/useUserSettings';
import { Input } from '@/components/ui/input';
import { SettingsPageHeader, SettingsSection, SettingsToggleRow } from '@/components/settings/SettingsUI';

const QuietHoursSettings = () => {
  const { settings, updateSetting } = useUserSettings();
  const s = settings || {};
  return (
    <>
      <SettingsPageHeader title="Quiet hours" description="Pause notification sounds and pop-ups during these hours." />
      <SettingsSection>
        <SettingsToggleRow title="Quiet hours" checked={!!s.dnd_enabled} onCheckedChange={(v) => updateSetting('dnd_enabled', v)} />
        {s.dnd_enabled && (
          <div className="flex items-center gap-3 px-4 py-3.5">
            <span className="text-[15px] flex-1">From</span>
            <Input type="time" className="w-32" value={s.dnd_start_time || '22:00'} onChange={(e) => updateSetting('dnd_start_time', e.target.value)} />
            <span className="text-[15px]">to</span>
            <Input type="time" className="w-32" value={s.dnd_end_time || '08:00'} onChange={(e) => updateSetting('dnd_end_time', e.target.value)} />
          </div>
        )}
      </SettingsSection>
    </>
  );
};

export default QuietHoursSettings;
