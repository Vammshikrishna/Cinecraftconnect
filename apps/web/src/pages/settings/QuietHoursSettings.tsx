import { useUserSettings } from '@/hooks/useUserSettings';
import { useEffect, useRef, useState } from 'react';
import { validateQuietHours } from '@/components/settings/settingsLogic';
import { Input } from '@/components/ui/input';
import { SettingsPageHeader, SettingsSection, SettingsToggleRow, SettingsLoading } from '@/components/settings/SettingsUI';

const QuietHoursSettings = () => {
  const { settings, updateSetting, loading } = useUserSettings();
  const s = settings || {};
  const [start, setStart] = useState('22:00');
  const [end, setEnd] = useState('08:00');
  useEffect(() => {
    if (settings?.dnd_start_time) setStart(settings.dnd_start_time);
    if (settings?.dnd_end_time) setEnd(settings.dnd_end_time);
  }, [settings?.dnd_start_time, settings?.dnd_end_time]);
  const error = validateQuietHours(start, end);
  const saveTimer = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => () => clearTimeout(saveTimer.current), []);
  const change = (key: 'dnd_start_time' | 'dnd_end_time', v: string) => {
    const nextStart = key === 'dnd_start_time' ? v : start;
    const nextEnd = key === 'dnd_end_time' ? v : end;
    if (key === 'dnd_start_time') setStart(v); else setEnd(v);
    // only invalid windows are held back; wait for typing in the time field to settle before saving
    clearTimeout(saveTimer.current);
    if (!validateQuietHours(nextStart, nextEnd)) saveTimer.current = setTimeout(() => updateSetting(key, v), 600);
  };
  if (loading) return <SettingsLoading />;
  return (
    <>
      <SettingsPageHeader title="Quiet hours" description="Pause notification sounds and pop-ups during these hours." />
      <SettingsSection>
        <SettingsToggleRow title="Turn on quiet hours" checked={!!s.dnd_enabled} onCheckedChange={(v) => updateSetting('dnd_enabled', v)} />
        {s.dnd_enabled && (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3.5 animate-in fade-in duration-150">
            <label htmlFor="quiet-start" className="text-base flex-1">From</label>
            <Input id="quiet-start" type="time" className="w-28" value={start} aria-invalid={!!error} aria-describedby={error ? 'quiet-error' : undefined} onChange={(e) => change('dnd_start_time', e.target.value)} />
            <label htmlFor="quiet-end" className="text-base">to</label>
            <Input id="quiet-end" type="time" className="w-28" value={end} aria-invalid={!!error} aria-describedby={error ? 'quiet-error' : undefined} onChange={(e) => change('dnd_end_time', e.target.value)} />
          </div>
        )}
        {s.dnd_enabled && error && (
          <p id="quiet-error" role="alert" className="px-4 pb-3 text-sm text-destructive">{error} Your last valid hours stay in effect.</p>
        )}
      </SettingsSection>
    </>
  );
};

export default QuietHoursSettings;
