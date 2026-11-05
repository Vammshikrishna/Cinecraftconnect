import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

const STATUSES = [
  { id: 'open', label: 'Open to work', sub: 'Show an "Open to work" badge' },
  { id: 'booked', label: 'Booked', sub: 'Working now; show until a date' },
  { id: 'not_looking', label: 'Not looking', sub: 'No badge' },
] as const;

type Status = 'open' | 'booked' | 'not_looking';
type Visibility = 'everyone' | 'connections';

/** Crew availability (status, rate range, cities, who can see it): one set of state, used by the dialog and by Edit profile. */
export function useAvailability(enabled: boolean) {
  const { user } = useAuth();
  const [status, setStatus] = useState<Status>('not_looking');
  const [bookedUntil, setBookedUntil] = useState('');
  const [rateMin, setRateMin] = useState('');
  const [rateMax, setRateMax] = useState('');
  const [currency, setCurrency] = useState('INR');
  const [cities, setCities] = useState('');
  const [note, setNote] = useState('');
  const [visibility, setVisibility] = useState<Visibility>('everyone');
  // saving only happens once the saved values were read, so a failed read can never overwrite them with blanks
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!enabled || !user) return;
    let alive = true;
    (supabase as any).from('profile_availability').select('*').eq('user_id', user.id).maybeSingle().then(({ data, error }: any) => {
      if (!alive || error) return;
      if (data) {
        setStatus(data.status);
        setBookedUntil(data.booked_until || '');
        setRateMin(data.rate_min != null ? String(data.rate_min) : '');
        setRateMax(data.rate_max != null ? String(data.rate_max) : '');
        setCurrency(data.rate_currency || 'INR');
        setCities((data.cities || []).join(', '));
        setNote(data.note || '');
        setVisibility(data.visibility || 'everyone');
      }
      setLoaded(true);
    });
    return () => { alive = false; };
  }, [enabled, user?.id]);

  /** Saves to the database. Returns the error, or null when it worked (or when there was nothing to save). */
  const save = useCallback(async (): Promise<{ message: string } | null> => {
    if (!user || !enabled || !loaded) return null;
    const { error } = await (supabase as any).from('profile_availability').upsert({
      user_id: user.id,
      status,
      booked_until: status === 'booked' && bookedUntil ? bookedUntil : null,
      rate_min: rateMin ? parseInt(rateMin, 10) : null,
      rate_max: rateMax ? parseInt(rateMax, 10) : null,
      rate_currency: currency || 'INR',
      cities: cities.split(',').map((c) => c.trim()).filter(Boolean),
      note: note.trim() || null,
      visibility,
    }, { onConflict: 'user_id' });
    return error ? { message: error.message } : null;
  }, [user?.id, enabled, loaded, status, bookedUntil, rateMin, rateMax, currency, cities, note, visibility]);

  return {
    status, setStatus, bookedUntil, setBookedUntil, rateMin, setRateMin, rateMax, setRateMax,
    currency, setCurrency, cities, setCities, note, setNote, visibility, setVisibility, loaded, save,
  };
}

export type AvailabilityState = ReturnType<typeof useAvailability>;

/** The fields themselves. Every button is type="button", so it is safe inside a form. */
export const AvailabilityFields = ({ a }: { a: AvailabilityState }) => (
  <div className="space-y-4">
    <div className="grid gap-2">
      {STATUSES.map((s) => (
        <button
          type="button"
          key={s.id}
          onClick={() => a.setStatus(s.id)}
          aria-pressed={a.status === s.id}
          className={cn('text-left rounded-lg border px-3 py-2 transition-colors', a.status === s.id ? 'border-primary bg-primary/10' : 'hover:bg-muted')}
        >
          <p className="text-sm font-semibold">{s.label}</p>
          <p className="text-xs text-muted-foreground">{s.sub}</p>
        </button>
      ))}
    </div>

    {a.status === 'booked' && (
      <div className="space-y-1">
        <Label>Booked until</Label>
        <Input type="date" value={a.bookedUntil} onChange={(e) => a.setBookedUntil(e.target.value)} />
      </div>
    )}

    <div className="space-y-1">
      <Label>Rate per day (optional)</Label>
      <div className="flex gap-2">
        <Input className="w-20" value={a.currency} maxLength={3} onChange={(e) => a.setCurrency(e.target.value.toUpperCase())} aria-label="Currency" />
        <Input type="number" min={0} placeholder="Min" value={a.rateMin} onChange={(e) => a.setRateMin(e.target.value)} aria-label="Minimum rate" />
        <Input type="number" min={0} placeholder="Max" value={a.rateMax} onChange={(e) => a.setRateMax(e.target.value)} aria-label="Maximum rate" />
      </div>
    </div>

    <div className="space-y-1">
      <Label>Cities you can work in</Label>
      <Input placeholder="Hyderabad, Mumbai, Chennai" value={a.cities} onChange={(e) => a.setCities(e.target.value)} />
    </div>

    <div className="space-y-1">
      <Label>Note (optional)</Label>
      <Textarea rows={2} maxLength={200} value={a.note} onChange={(e) => a.setNote(e.target.value)} placeholder="Own ARRI Alexa Mini, available for shorts and ads" className="resize-none" />
    </div>

    <div className="space-y-1">
      <Label>Who can see this</Label>
      <div className="flex gap-2">
        {([['everyone', 'Everyone'], ['connections', 'Connections only']] as const).map(([k, l]) => (
          <button
            type="button"
            key={k}
            onClick={() => a.setVisibility(k)}
            aria-pressed={a.visibility === k}
            className={cn('px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors', a.visibility === k ? 'bg-primary text-primary-foreground border-primary' : 'hover:bg-muted')}
          >
            {l}
          </button>
        ))}
      </div>
    </div>
  </div>
);
