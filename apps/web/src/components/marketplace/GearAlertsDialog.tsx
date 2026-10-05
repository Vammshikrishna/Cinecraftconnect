import { useCallback, useEffect, useState } from 'react';
import { Bell, BellRing, Loader2, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { EQUIPMENT_CATEGORIES, LOCATION_CATEGORIES, VENDOR_CATEGORIES } from '@/types/marketplace';

interface Alert { id: string; kind: 'gear' | 'service'; category: string | null; keyword: string | null; max_price: number | null }
const db = supabase as any;
const ANY = 'any';
const describe = (a: Alert) =>
  [a.kind === 'service' ? 'Vendor service' : 'Gear', a.keyword ? `“${a.keyword}”` : null, a.category, a.max_price ? `up to ₹${a.max_price}/day` : null].filter(Boolean).join(' · ');

/** Gear alerts: a notification when a listing that matches is posted (the match runs in the database). */
export const GearAlertsDialog = ({ triggerButton }: { triggerButton?: React.ReactNode }) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ kind: 'gear' as 'gear' | 'service', keyword: '', category: ANY, max_price: '' });

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await db.from('gear_alerts').select('id, kind, category, keyword, max_price').eq('user_id', user.id).order('created_at', { ascending: false });
    setAlerts(data || []);
    setLoading(false);
  }, [user?.id]);

  useEffect(() => {
    if (open) {
      load();
      setForm((f) => ({ ...f, keyword: '', category: ANY, max_price: '' }));
    }
  }, [open]);

  const create = async () => {
    if (!user) return;
    if (!form.keyword.trim() && form.category === ANY && !form.max_price) {
      toast({ title: 'Add something to match', description: 'Enter a keyword, a category or a maximum price.', variant: 'destructive' });
      return;
    }
    setSaving(true);
    const { error } = await db.from('gear_alerts').insert({
      user_id: user.id,
      kind: form.kind,
      keyword: form.keyword.trim() || null,
      category: form.category === ANY ? null : form.category,
      max_price: form.max_price ? Number(form.max_price) : null,
    });
    setSaving(false);
    if (error) {
      toast({ title: 'Could not save the alert', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Alert saved', description: form.kind === 'service' ? "We'll notify you when a matching service is added." : "We'll notify you when matching gear is listed." });
    setForm((f) => ({ ...f, keyword: '', category: ANY, max_price: '' }));
    load();
  };

  const remove = async (a: Alert) => {
    setAlerts((p) => p.filter((x) => x.id !== a.id));
    const { error } = await db.from('gear_alerts').delete().eq('id', a.id);
    if (error) load();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {triggerButton || (
          <Button variant="outline" className="gap-2 rounded-xl h-10 px-4 font-bold text-sm shrink-0">
            <Bell size={16} /> <span>Alerts</span>
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[520px] max-h-[85vh] overflow-y-auto w-[95vw]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><BellRing className="w-5 h-5" /> Alerts</DialogTitle>
          <DialogDescription>Get notified when gear, a location or a service you are looking for is listed. Up to 10 alerts.</DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          {loading ? (
            <div className="py-4 flex justify-center"><Loader2 className="w-5 h-5 animate-spin" /></div>
          ) : alerts.length === 0 ? (
            <p className="text-sm text-muted-foreground">You have no alerts yet.</p>
          ) : (
            alerts.map((a) => (
              <div key={a.id} className="flex items-center gap-3 rounded-2xl border border-border/60 p-3">
                <p className="flex-1 text-sm font-bold min-w-0 truncate">{describe(a)}</p>
                <Button variant="ghost" size="icon" className="text-red-500 hover:bg-red-500/10" onClick={() => remove(a)}><Trash2 className="w-4 h-4" /></Button>
              </div>
            ))
          )}
        </div>

        <div className="rounded-2xl border border-dashed border-border p-4 space-y-3 mt-2">
          <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">New alert</p>
          <div className="grid grid-cols-2 gap-2">
            {(['gear', 'service'] as const).map((k) => (
              <Button key={k} type="button" variant={form.kind === k ? 'default' : 'outline'} className="rounded-xl h-9 text-xs font-bold" onClick={() => setForm({ ...form, kind: k, category: ANY })}>
                {k === 'gear' ? 'Gear & locations' : 'Vendor services'}
              </Button>
            ))}
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Keyword</Label>
            <Input placeholder="e.g. ARRI, anamorphic, gimbal" value={form.keyword} onChange={(e) => setForm({ ...form, keyword: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Category</Label>
              <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={ANY}>Any</SelectItem>
                  {(form.kind === 'service' ? [...VENDOR_CATEGORIES] : [...EQUIPMENT_CATEGORIES, ...LOCATION_CATEGORIES]).map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Max {form.kind === 'service' ? 'day rate' : 'price per day'} (₹)</Label>
              <Input type="number" min={0} value={form.max_price} onChange={(e) => setForm({ ...form, max_price: e.target.value })} />
            </div>
          </div>
          <Button className="w-full rounded-xl" onClick={create} disabled={saving || alerts.length >= 10}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Plus className="w-4 h-4 mr-1.5" /> Save alert</>}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
