import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved?: () => void;
}

const STATUSES = [
  { id: 'open', label: 'Open to work', sub: 'Show an "Open to work" badge' },
  { id: 'booked', label: 'Booked', sub: 'Working now; show until a date' },
  { id: 'not_looking', label: 'Not looking', sub: 'No badge' },
] as const;

/** Crew availability: status, rate range, cities and who can see it. */
export const AvailabilityDialog = ({ open, onOpenChange, onSaved }: Props) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [status, setStatus] = useState<'open' | 'booked' | 'not_looking'>('not_looking');
  const [bookedUntil, setBookedUntil] = useState('');
  const [rateMin, setRateMin] = useState('');
  const [rateMax, setRateMax] = useState('');
  const [currency, setCurrency] = useState('INR');
  const [cities, setCities] = useState('');
  const [note, setNote] = useState('');
  const [visibility, setVisibility] = useState<'everyone' | 'connections'>('everyone');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !user) return;
    (supabase as any).from('profile_availability').select('*').eq('user_id', user.id).maybeSingle().then(({ data }: any) => {
      if (!data) return;
      setStatus(data.status);
      setBookedUntil(data.booked_until || '');
      setRateMin(data.rate_min != null ? String(data.rate_min) : '');
      setRateMax(data.rate_max != null ? String(data.rate_max) : '');
      setCurrency(data.rate_currency || 'INR');
      setCities((data.cities || []).join(', '));
      setNote(data.note || '');
      setVisibility(data.visibility || 'everyone');
    });
  }, [open, user]);

  const save = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await (supabase as any).from('profile_availability').upsert({
      user_id: user.id,
      status,
      booked_until: status === 'booked' && bookedUntil ? bookedUntil : null,
      rate_min: rateMin ? parseInt(rateMin, 10) : null,
      rate_max: rateMax ? parseInt(rateMax, 10) : null,
      rate_currency: currency || 'INR',
      cities: cities.split(',').map(c => c.trim()).filter(Boolean),
      note: note.trim() || null,
      visibility,
    }, { onConflict: 'user_id' });
    setSaving(false);
    if (error) {
      toast({ title: 'Could not save', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Availability saved' });
    onSaved?.();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Your availability</DialogTitle>
          <DialogDescription>Let producers and crew know when you can take work.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid gap-2">
            {STATUSES.map(s => (
              <button
                key={s.id}
                onClick={() => setStatus(s.id)}
                className={cn('text-left rounded-lg border px-3 py-2 transition-colors', status === s.id ? 'border-primary bg-primary/10' : 'hover:bg-muted')}
              >
                <p className="text-sm font-semibold">{s.label}</p>
                <p className="text-xs text-muted-foreground">{s.sub}</p>
              </button>
            ))}
          </div>

          {status === 'booked' && (
            <div className="space-y-1">
              <Label>Booked until</Label>
              <Input type="date" value={bookedUntil} onChange={e => setBookedUntil(e.target.value)} />
            </div>
          )}

          <div className="space-y-1">
            <Label>Rate per day (optional)</Label>
            <div className="flex gap-2">
              <Input className="w-20" value={currency} maxLength={3} onChange={e => setCurrency(e.target.value.toUpperCase())} />
              <Input type="number" min={0} placeholder="Min" value={rateMin} onChange={e => setRateMin(e.target.value)} />
              <Input type="number" min={0} placeholder="Max" value={rateMax} onChange={e => setRateMax(e.target.value)} />
            </div>
          </div>

          <div className="space-y-1">
            <Label>Cities you can work in</Label>
            <Input placeholder="Hyderabad, Mumbai, Chennai" value={cities} onChange={e => setCities(e.target.value)} />
          </div>

          <div className="space-y-1">
            <Label>Note (optional)</Label>
            <Textarea rows={2} maxLength={200} value={note} onChange={e => setNote(e.target.value)} placeholder="Own ARRI Alexa Mini, available for shorts and ads" className="resize-none" />
          </div>

          <div className="space-y-1">
            <Label>Who can see this</Label>
            <div className="flex gap-2">
              {([['everyone', 'Everyone'], ['connections', 'Connections only']] as const).map(([k, l]) => (
                <button key={k} onClick={() => setVisibility(k)}
                  className={cn('px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors', visibility === k ? 'bg-primary text-primary-foreground border-primary' : 'hover:bg-muted')}>
                  {l}
                </button>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={save} disabled={saving}>{saving ? 'Saving...' : 'Save'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
