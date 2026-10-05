import { useEffect, useMemo, useState } from 'react';
import { Loader2, CalendarDays } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  listing: { id: string; title: string; price_per_day: number; price_per_week?: number | null; is_bundle?: boolean | null };
  onRequested: () => void;
}

const db = supabase as any;
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const dayCount = (start: string, end: string) => Math.round((new Date(end).getTime() - new Date(start).getTime()) / 86400000) + 1;
const fmt = (d: string) => new Date(d).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });

/** The same arithmetic as the database (which is the source of truth): weekly rate for full weeks, daily for the rest. */
export const estimateBookingPrice = (l: { price_per_day: number; price_per_week?: number | null }, days: number): number =>
  l.price_per_week && days >= 7 ? Math.floor(days / 7) * l.price_per_week + (days % 7) * l.price_per_day : days * l.price_per_day;

export const BookingRequestDialog = ({ open, onOpenChange, listing, onRequested }: Props) => {
  const { toast } = useToast();
  const today = iso(new Date());
  const [start, setStart] = useState(today);
  const [end, setEnd] = useState(today);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [booked, setBooked] = useState<{ start_date: string; end_date: string }[]>([]);

  useEffect(() => {
    if (!open) return;
    setStart(today);
    setEnd(today);
    setMessage('');
    db.rpc('listing_booked_ranges', { p_listing_id: listing.id }).then(({ data }: any) => setBooked(data || []));
  }, [open, listing.id]);

  const days = start && end && end >= start ? dayCount(start, end) : 0;
  const total = useMemo(() => (days > 0 ? estimateBookingPrice(listing, days) : 0), [days, listing]);
  const clash = booked.find((b) => b.start_date <= end && b.end_date >= start);

  const submit = async () => {
    if (!days) return toast({ title: 'Check your dates', description: 'The end date cannot be before the start date.', variant: 'destructive' });
    if (days > 90) return toast({ title: 'Too long', description: 'Bookings can be at most 90 days.', variant: 'destructive' });
    if (clash) return toast({ title: 'Dates not available', description: 'These dates are already booked.', variant: 'destructive' });
    setBusy(true);
    // The server checks availability, works out the price and sets the owner.
    const { data, error } = await db.rpc('request_booking', { p_listing_id: listing.id, p_start: start, p_end: end, p_message: message.trim() || null });
    setBusy(false);
    if (error || data?.success === false) {
      toast({ title: 'Could not request booking', description: error?.message || data?.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Booking requested', description: `The owner will confirm your ${days}-day request. We'll notify you.` });
    onOpenChange(false);
    onRequested();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px] w-[95vw]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><CalendarDays className="w-5 h-5" /> Request booking</DialogTitle>
          <DialogDescription>{listing.title}{listing.is_bundle ? ' (bundle: every item in it is reserved together)' : ''}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">From</Label>
              <Input type="date" min={today} value={start} onChange={(e) => { setStart(e.target.value); if (e.target.value > end) setEnd(e.target.value); }} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">To (last day)</Label>
              <Input type="date" min={start || today} value={end} onChange={(e) => setEnd(e.target.value)} />
            </div>
          </div>

          {booked.length > 0 && (
            <div className="rounded-xl border border-border/60 p-3 text-xs space-y-1">
              <p className="font-black uppercase tracking-widest text-muted-foreground text-[10px]">Already booked</p>
              {booked.slice(0, 6).map((b, i) => (
                <p key={i} className={clash === b ? 'text-red-500 font-bold' : 'text-muted-foreground'}>
                  {fmt(b.start_date)}{b.end_date !== b.start_date ? ` – ${fmt(b.end_date)}` : ''}
                </p>
              ))}
            </div>
          )}

          <div className="space-y-1.5">
            <Label className="text-xs">Message to the owner (optional)</Label>
            <Textarea className="min-h-[70px]" maxLength={500} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="What are you shooting? Any pickup or delivery needs?" />
          </div>

          <div className="rounded-2xl bg-primary/5 border border-primary/20 p-4 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{days || 0} day{days === 1 ? '' : 's'}</p>
              <p className="text-2xl font-black text-primary">₹{total.toLocaleString()}</p>
            </div>
            <p className="text-[11px] text-muted-foreground max-w-[170px] text-right">Estimate. The owner confirms the request; you pay them directly.</p>
          </div>

          <Button className="w-full h-12 rounded-xl font-bold" onClick={submit} disabled={busy || !days || !!clash}>
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : clash ? 'Dates not available' : 'Send request'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
