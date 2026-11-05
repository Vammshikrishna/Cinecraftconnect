import { useCallback, useEffect, useState } from 'react';
import { FileText } from 'lucide-react';
import { friendlyError } from '@cinecraft/core';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { confirmDialog } from '@/lib/confirmDialog';
import TransparencyData, { type TransparencyNumbers } from '@/components/safety/TransparencyData';

interface Report {
  id: string; title: string; summary: string; period_start: string; period_end: string; status: 'draft' | 'published';
  created_by: string; published_at: string | null; data: TransparencyNumbers;
}

const day = (d: Date) => d.toISOString().slice(0, 10);

/** Make, check and publish the public transparency report. Drafts are private; publishing needs a different super admin. */
export const TransparencyManager = () => {
  const { toast } = useToast();
  const [reports, setReports] = useState<Report[]>([]);
  const [open, setOpen] = useState<string | null>(null);
  const [start, setStart] = useState(day(new Date(Date.now() - 91 * 86400000)));
  const [end, setEnd] = useState(day(new Date(Date.now() - 86400000)));
  const [edit, setEdit] = useState<{ title: string; summary: string }>({ title: '', summary: '' });
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const { data, error } = await (supabase as any).from('transparency_reports').select('*').order('period_end', { ascending: false });
    if (error) toast({ title: 'Could not load the reports', description: friendlyError(error), variant: 'destructive' });
    else setReports((data as Report[]) || []);
  }, [toast]);
  useEffect(() => { void load(); }, [load]);

  const call = async (fn: string, args: Record<string, unknown>, done: string) => {
    setBusy(true);
    const { data, error } = await (supabase as any).rpc(fn, args);
    setBusy(false);
    if (error) { toast({ title: 'That did not work', description: friendlyError(error), variant: 'destructive' }); return null; }
    toast({ title: done });
    await load();
    return data;
  };

  const create = async () => {
    const id = await call('staff_create_transparency_draft', { p_start: start, p_end: end }, 'Draft made from the current figures');
    if (id) setOpen(id as string);
  };

  const toggle = (r: Report) => {
    if (open === r.id) { setOpen(null); return; }
    setOpen(r.id);
    setEdit({ title: r.title, summary: r.summary });
  };

  return (
    <section aria-labelledby="tr-title" className="space-y-6">
      <header>
        <h2 id="tr-title" className="text-xl font-bold tracking-tight flex items-center gap-2"><FileText className="h-5 w-5 text-primary" /> Transparency report</h2>
        <p className="text-sm text-muted-foreground mt-1 max-w-2xl">A public report of how reports were handled in a period: numbers only, counts of one to four shown as "&lt;5". Make a draft, write a short summary, and have a different super admin publish it at <span className="font-mono">/transparency</span>. A published report cannot be edited; correct it with a new one.</p>
      </header>

      <div className="rounded-2xl border border-border bg-card p-5 flex flex-wrap items-end gap-4">
        <div className="space-y-1.5"><Label htmlFor="tr-start">From</Label><Input id="tr-start" type="date" value={start} onChange={(e) => setStart(e.target.value)} className="h-10 rounded-xl" /></div>
        <div className="space-y-1.5"><Label htmlFor="tr-end">To (a day that has ended)</Label><Input id="tr-end" type="date" value={end} onChange={(e) => setEnd(e.target.value)} className="h-10 rounded-xl" /></div>
        <Button className="h-10 rounded-xl font-semibold" disabled={busy} onClick={create}>Make a draft</Button>
      </div>

      {reports.length === 0 ? (
        <p className="text-sm text-muted-foreground">No reports yet.</p>
      ) : (
        <ul className="space-y-3">
          {reports.map((r) => (
            <li key={r.id} className="rounded-2xl border border-border bg-card">
              <button className="w-full text-left px-5 py-4 flex flex-wrap items-center gap-3" onClick={() => toggle(r)} aria-expanded={open === r.id}>
                <span className="font-semibold flex-1 min-w-0 truncate">{r.title}</span>
                <Badge variant="outline" className={r.status === 'published' ? 'rounded-full border-emerald-500/40 text-emerald-600 bg-emerald-500/10' : 'rounded-full'}>{r.status === 'published' ? 'Published' : 'Draft'}</Badge>
              </button>
              {open === r.id && (
                <div className="border-t border-border p-5 space-y-5">
                  {r.status === 'draft' ? (
                    <div className="space-y-3">
                      <div className="space-y-1.5"><Label htmlFor="tr-t">Title</Label><Input id="tr-t" value={edit.title} onChange={(e) => setEdit({ ...edit, title: e.target.value })} className="h-10 rounded-xl" maxLength={160} /></div>
                      <div className="space-y-1.5"><Label htmlFor="tr-s">Summary (what the numbers mean, in plain words)</Label><Textarea id="tr-s" value={edit.summary} onChange={(e) => setEdit({ ...edit, summary: e.target.value })} className="rounded-xl min-h-[120px]" maxLength={5000} /></div>
                    </div>
                  ) : (
                    r.summary && <p className="text-sm whitespace-pre-wrap">{r.summary}</p>
                  )}
                  <TransparencyData data={r.data} />
                  {r.status === 'draft' && (
                    <div className="flex flex-wrap gap-2">
                      <Button variant="outline" className="h-10 rounded-xl" disabled={busy} onClick={() => call('staff_edit_transparency_draft', { p_id: r.id, p_title: edit.title, p_summary: edit.summary }, 'Saved')}>Save wording</Button>
                      <Button className="h-10 rounded-xl font-semibold" disabled={busy} onClick={async () => {
                        if (!(await confirmDialog('Publish this report? It becomes public at /transparency and cannot be edited afterwards. Save your wording first.'))) return;
                        await call('staff_publish_transparency_report', { p_id: r.id }, 'Published');
                      }}>Publish</Button>
                      <Button variant="ghost" className="h-10 rounded-xl text-destructive" disabled={busy} onClick={async () => {
                        if (!(await confirmDialog('Delete this draft?'))) return;
                        setOpen(null);
                        await call('staff_delete_transparency_draft', { p_id: r.id }, 'Draft deleted');
                      }}>Delete draft</Button>
                    </div>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};

export default TransparencyManager;
