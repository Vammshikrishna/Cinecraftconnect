import { useEffect, useState } from 'react';
import { Loader2, FileText } from 'lucide-react';
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
  vendorId: string;
  vendorName: string;
  serviceId?: string | null;
  serviceTitle?: string | null;
  onRequested: () => void;
}

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** Ask a vendor for a quote: dates, location and a short brief. The vendor replies with a price in My Quotes. */
export const QuoteRequestDialog = ({ open, onOpenChange, vendorId, vendorName, serviceId, serviceTitle, onRequested }: Props) => {
  const { toast } = useToast();
  const today = iso(new Date());
  const [form, setForm] = useState({ start: today, end: today, location: '', brief: '', crew: '', budget: '' });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) setForm({ start: today, end: today, location: '', brief: '', crew: '', budget: '' });
  }, [open]);

  const submit = async () => {
    if (form.brief.trim().length < 10) return toast({ title: 'Tell the vendor what you need', description: 'At least 10 characters.', variant: 'destructive' });
    if (form.end < form.start) return toast({ title: 'Check your dates', description: 'The end date cannot be before the start date.', variant: 'destructive' });
    setBusy(true);
    const { data, error } = await (supabase as any).rpc('request_vendor_quote', {
      p_vendor_id: vendorId,
      p_service_id: serviceId || null,
      p_start: form.start,
      p_end: form.end,
      p_location: form.location.trim() || null,
      p_brief: form.brief.trim(),
      p_crew: form.crew ? Number(form.crew) : null,
      p_budget: form.budget ? Number(form.budget) : null,
    });
    setBusy(false);
    if (error || data?.success === false) {
      toast({ title: 'Could not send the request', description: error?.message || data?.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Request sent', description: `${vendorName} will reply with a quote. You'll be notified.` });
    onOpenChange(false);
    onRequested();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] w-[95vw] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><FileText className="w-5 h-5" /> Request a quote</DialogTitle>
          <DialogDescription>{vendorName}{serviceTitle ? ` · ${serviceTitle}` : ''}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label className="text-xs">From</Label><Input type="date" min={today} value={form.start} onChange={(e) => setForm({ ...form, start: e.target.value, end: e.target.value > form.end ? e.target.value : form.end })} /></div>
            <div className="space-y-1.5"><Label className="text-xs">To</Label><Input type="date" min={form.start} value={form.end} onChange={(e) => setForm({ ...form, end: e.target.value })} /></div>
          </div>
          <div className="space-y-1.5"><Label className="text-xs">Location</Label><Input placeholder="Where is the shoot?" maxLength={200} value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} /></div>
          <div className="space-y-1.5">
            <Label className="text-xs">What do you need? *</Label>
            <Textarea className="min-h-[100px]" maxLength={1500} value={form.brief} onChange={(e) => setForm({ ...form, brief: e.target.value })} placeholder="Type of production, what you need from them, special requirements…" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label className="text-xs">Crew size (optional)</Label><Input type="number" min={1} value={form.crew} onChange={(e) => setForm({ ...form, crew: e.target.value })} /></div>
            <div className="space-y-1.5"><Label className="text-xs">Budget ₹ (optional)</Label><Input type="number" min={0} value={form.budget} onChange={(e) => setForm({ ...form, budget: e.target.value })} /></div>
          </div>
          <Button className="w-full h-12 rounded-xl font-bold" onClick={submit} disabled={busy}>
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Send request'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
