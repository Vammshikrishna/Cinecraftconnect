import { useCallback, useEffect, useState } from 'react';
import { Bell, Trash2, Plus, BellRing, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { describeAlert, DEPARTMENTS, JOB_TYPES, JOB_TYPE_LABELS, WORK_MODES, WORK_MODE_LABELS, type JobAlertCriteria } from '@cinecraft/core';

interface AlertRow extends JobAlertCriteria {
  id: string;
  is_active: boolean;
}

interface Props {
  /** Pre-fills the form from whatever the person is currently searching for. */
  prefill?: JobAlertCriteria;
  triggerButton?: React.ReactNode;
  defaultOpen?: boolean;
}

const db = supabase as any;
const ANY = 'any';

/** Saved searches: a notification when a new job matches (the match runs in the database when a job is published). */
export const JobAlertsDialog = ({ prefill, triggerButton, defaultOpen = false }: Props) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [open, setOpen] = useState(defaultOpen);
  const [alerts, setAlerts] = useState<AlertRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ keywords: '', job_type: ANY, work_mode: ANY, department: ANY, location: '', min_salary: '' });

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await db.from('job_alerts').select('*').eq('user_id', user.id).order('created_at', { ascending: false });
    setAlerts((data || []) as AlertRow[]);
    setLoading(false);
  }, [user?.id]);

  useEffect(() => {
    if (!open) return;
    load();
    setForm({
      keywords: prefill?.keywords || '',
      job_type: prefill?.job_type || ANY,
      work_mode: prefill?.work_mode || ANY,
      department: prefill?.department || ANY,
      location: prefill?.location || '',
      min_salary: prefill?.min_salary ? String(prefill.min_salary) : '',
    });
  }, [open]);

  const create = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await db.from('job_alerts').insert({
      user_id: user.id,
      keywords: form.keywords.trim() || null,
      job_type: form.job_type === ANY ? null : form.job_type,
      work_mode: form.work_mode === ANY ? null : form.work_mode,
      department: form.department === ANY ? null : form.department,
      location: form.location.trim() || null,
      min_salary: form.min_salary ? Number(form.min_salary) : null,
    });
    setSaving(false);
    if (error) {
      toast({ title: 'Could not save the alert', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Alert saved', description: "We'll notify you when a matching job is posted." });
    load();
  };

  const toggle = async (a: AlertRow) => {
    setAlerts((prev) => prev.map((x) => (x.id === a.id ? { ...x, is_active: !x.is_active } : x)));
    const { error } = await db.from('job_alerts').update({ is_active: !a.is_active }).eq('id', a.id);
    if (error) load();
  };

  const remove = async (a: AlertRow) => {
    setAlerts((prev) => prev.filter((x) => x.id !== a.id));
    const { error } = await db.from('job_alerts').delete().eq('id', a.id);
    if (error) load();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {triggerButton || (
          <Button variant="ghost" className="rounded-xl border border-border/50 hover:bg-muted/50 h-11 px-4 text-xs font-bold whitespace-nowrap">
            <Bell className="w-4 h-4 mr-2" /> Job alerts
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[560px] max-h-[85vh] overflow-y-auto w-[95vw]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><BellRing className="w-5 h-5" /> Job alerts</DialogTitle>
          <DialogDescription>Get notified the moment a job that fits you is posted. You can keep up to 10 alerts.</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {loading ? (
            <div className="py-4 flex justify-center"><Loader2 className="w-5 h-5 animate-spin" /></div>
          ) : alerts.length === 0 ? (
            <p className="text-sm text-muted-foreground">You have no alerts yet.</p>
          ) : (
            alerts.map((a) => (
              <div key={a.id} className="flex items-center gap-3 rounded-2xl border border-border/60 p-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold truncate">{describeAlert(a)}</p>
                  <p className="text-[11px] text-muted-foreground">{a.is_active ? 'Active' : 'Paused'}</p>
                </div>
                <Switch checked={a.is_active} onCheckedChange={() => toggle(a)} />
                <Button variant="ghost" size="icon" className="text-red-500 hover:bg-red-500/10" onClick={() => remove(a)}><Trash2 className="w-4 h-4" /></Button>
              </div>
            ))
          )}
        </div>

        <div className="rounded-2xl border border-dashed border-border p-4 space-y-3 mt-2">
          <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">New alert</p>
          <div className="space-y-1.5">
            <Label className="text-xs">Keywords</Label>
            <Input placeholder="e.g. focus puller, colorist" value={form.keywords} onChange={(e) => setForm({ ...form, keywords: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Job type</Label>
              <Select value={form.job_type} onValueChange={(v) => setForm({ ...form, job_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={ANY}>Any</SelectItem>
                  {JOB_TYPES.map((t) => <SelectItem key={t} value={t}>{JOB_TYPE_LABELS[t]}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Work mode</Label>
              <Select value={form.work_mode} onValueChange={(v) => setForm({ ...form, work_mode: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={ANY}>Any</SelectItem>
                  {WORK_MODES.map((m) => <SelectItem key={m} value={m}>{WORK_MODE_LABELS[m]}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Department</Label>
              <Select value={form.department} onValueChange={(v) => setForm({ ...form, department: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={ANY}>Any</SelectItem>
                  {DEPARTMENTS.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Location</Label>
              <Input placeholder="City" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
            </div>
            <div className="space-y-1.5 col-span-2">
              <Label className="text-xs">Minimum pay (top of the range must reach this)</Label>
              <Input type="number" min={0} value={form.min_salary} onChange={(e) => setForm({ ...form, min_salary: e.target.value })} />
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
