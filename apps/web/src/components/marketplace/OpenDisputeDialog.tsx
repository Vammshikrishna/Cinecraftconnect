import { useEffect, useState } from 'react';
import { friendlyError } from '@cinecraft/core';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

export const DISPUTE_REASONS: Array<{ id: string; label: string }> = [
  { id: 'not_delivered', label: 'It was not delivered or provided' },
  { id: 'not_as_described', label: 'It was not as described' },
  { id: 'damaged', label: 'It was damaged or not returned' },
  { id: 'no_show', label: 'The other person did not show up' },
  { id: 'payment', label: 'We disagree about payment' },
  { id: 'scam', label: 'I think this is a scam' },
  { id: 'other', label: 'Something else' },
];

/** Opens a dispute about a booking or an accepted quote. The other side has five days to answer; the team then decides. */
export const OpenDisputeDialog = ({ open, onOpenChange, kind, refId, title, onOpened }: {
  open: boolean; onOpenChange: (o: boolean) => void; kind: 'booking' | 'quote'; refId: string; title: string; onOpened?: (id: string) => void;
}) => {
  const { toast } = useToast();
  const [reason, setReason] = useState('not_as_described');
  const [text, setText] = useState('');
  const [amount, setAmount] = useState('');
  const [busy, setBusy] = useState(false);
  // the amount is optional, but when given it must be a real, positive number
  const amountBad = amount.trim() !== '' && !(Number.isFinite(Number(amount)) && Number(amount) > 0);

  useEffect(() => { if (open) { setReason('not_as_described'); setText(''); setAmount(''); } }, [open]);

  const send = async () => {
    setBusy(true);
    const { data, error } = await (supabase as any).rpc('open_marketplace_dispute', {
      p_kind: kind, p_ref: refId, p_reason: reason, p_description: text, p_amount: amount.trim() ? Number(amount) : null,
    });
    setBusy(false);
    if (error) { toast({ title: 'Could not open the dispute', description: friendlyError(error), variant: 'destructive' }); return; }
    toast({ title: 'Dispute opened', description: 'The other side has 5 days to answer. Then our team will decide.' });
    onOpenChange(false);
    onOpened?.(data as string);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px] w-[95vw]">
        <DialogHeader>
          <DialogTitle>Report a problem</DialogTitle>
          <DialogDescription>{title}. Opening a dispute tells the other side and our team. Try messaging them first if you have not.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <fieldset className="space-y-2">
            <legend className="text-xs font-medium mb-1">What went wrong</legend>
            {DISPUTE_REASONS.map((r) => (
              <label key={r.id} className="flex items-center gap-2.5 text-sm cursor-pointer">
                <input type="radio" name="dispute-reason" checked={reason === r.id} onChange={() => setReason(r.id)} /> {r.label}
              </label>
            ))}
          </fieldset>
          <div className="space-y-1.5">
            <Label htmlFor="dp-text" className="text-xs">What happened (20 characters or more)</Label>
            <Textarea id="dp-text" value={text} onChange={(e) => setText(e.target.value)} maxLength={2000} className="min-h-[110px] rounded-xl" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="dp-amt" className="text-xs">Amount you are asking for, in ₹ (optional)</Label>
            <Input id="dp-amt" type="number" min={0} value={amount} onChange={(e) => setAmount(e.target.value)} aria-invalid={amountBad} className="h-10 rounded-xl" />
            {amountBad && <p className="text-xs text-destructive mt-1">Enter an amount above 0, or leave it empty.</p>}
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={send} disabled={busy || amountBad || text.trim().length < 20} className="rounded-xl font-semibold">{busy ? 'Sending' : 'Open dispute'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default OpenDisputeDialog;
