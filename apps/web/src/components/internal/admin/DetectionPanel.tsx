import { useCallback, useEffect, useState } from 'react';
import { ScanSearch } from 'lucide-react';
import { friendlyError } from '@cinecraft/core';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { confirmDialog } from '@/lib/confirmDialog';
import { REASON_LABEL } from '@/components/safety/TransparencyData';

interface Rule {
  id: string; name: string; kind: 'keyword' | 'regex'; pattern: string; reason: string; severity: 'low' | 'medium' | 'high' | 'urgent'; hide: boolean;
  applies_to: string[]; new_account_days: number | null; enabled: boolean; hits_30d: number; upheld_30d: number; dismissed_30d: number;
}
interface Setting { key: string; label: string; value: number; default: number; min: number; max: number }
interface Detection {
  days: number; by_source: Record<string, { opened: number; upheld: number; dismissed: number }>;
}
interface Qa {
  sampled: number; pending: number; agreed: number; disagreed: number;
  by_person: { name: string; reviewed: number; disagreed: number }[];
  disagreements: { report_id: string; note: string | null; original_status: string; reviewed_at: string; original_name: string; reviewer_name: string }[];
}

const WHERE = ['post', 'comment', 'listing', 'job'];
const SOURCE: Record<string, string> = { user: 'Reported by people', auto_text: 'Matched a rule', auto_signal: 'Listing signals' };
const blank = (): Omit<Rule, 'hits_30d' | 'upheld_30d' | 'dismissed_30d'> => ({
  id: '', name: '', kind: 'regex', pattern: '', reason: 'spam', severity: 'medium', hide: false, applies_to: [...WHERE], new_account_days: null, enabled: true,
});

/** Automatic detection and workload settings: the rules that open cases by themselves, limits, targets, and how well it works. */
export const DetectionPanel = () => {
  const { toast } = useToast();
  const [rules, setRules] = useState<Rule[]>([]);
  const [settings, setSettings] = useState<Setting[]>([]);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [stats, setStats] = useState<Detection | null>(null);
  const [qa, setQa] = useState<Qa | null>(null);
  const [editing, setEditing] = useState<ReturnType<typeof blank> | null>(null);
  const [test, setTest] = useState({ type: 'post', text: '' });
  const [testResult, setTestResult] = useState<{ matched: boolean; rules: string[]; reason: string | null; severity: string | null; hide: boolean } | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const db = supabase as any;
    const [r, s, d, q] = await Promise.all([db.rpc('staff_list_screen_rules'), db.rpc('staff_safety_settings'), db.rpc('staff_detection_stats', { p_days: 30 }), db.rpc('staff_qa_overview', { p_days: 30 })]);
    const err = r.error || s.error;
    if (err) toast({ title: 'Could not load this page', description: friendlyError(err), variant: 'destructive' });
    if (!r.error) setRules((r.data as Rule[]) || []);
    if (!s.error) { setSettings(s.data as Setting[]); setDraft(Object.fromEntries((s.data as Setting[]).map((x) => [x.key, String(x.value)]))); }
    if (!d.error) setStats(d.data as Detection);
    if (!q.error) setQa(q.data as Qa);
  }, [toast]);
  useEffect(() => { void load(); }, [load]);

  const saveRule = async () => {
    if (!editing) return;
    setBusy(true);
    const { error } = await (supabase as any).rpc('staff_save_screen_rule', {
      p_id: editing.id || null, p_name: editing.name, p_kind: editing.kind, p_pattern: editing.pattern, p_reason: editing.reason, p_severity: editing.severity,
      p_hide: editing.hide, p_applies_to: editing.applies_to, p_new_account_days: editing.new_account_days, p_enabled: editing.enabled,
    });
    setBusy(false);
    if (error) { toast({ title: 'Could not save the rule', description: friendlyError(error), variant: 'destructive' }); return; }
    toast({ title: 'Rule saved' });
    setEditing(null);
    void load();
  };
  const toggle = async (r: Rule) => {
    const { error } = await (supabase as any).rpc('staff_save_screen_rule', {
      p_id: r.id, p_name: r.name, p_kind: r.kind, p_pattern: r.pattern, p_reason: r.reason, p_severity: r.severity, p_hide: r.hide,
      p_applies_to: r.applies_to, p_new_account_days: r.new_account_days, p_enabled: !r.enabled,
    });
    if (error) toast({ title: 'Could not change it', description: friendlyError(error), variant: 'destructive' }); else void load();
  };
  const remove = async (r: Rule) => {
    if (!(await confirmDialog(`Delete the rule "${r.name}"?`))) return;
    const { error } = await (supabase as any).rpc('staff_delete_screen_rule', { p_id: r.id });
    if (error) toast({ title: 'Could not delete it', description: friendlyError(error), variant: 'destructive' }); else void load();
  };
  const runTest = async () => {
    const { data, error } = await (supabase as any).rpc('staff_test_screen_text', { p_type: test.type, p_text: test.text });
    if (error) { toast({ title: 'Could not test it', description: friendlyError(error), variant: 'destructive' }); return; }
    setTestResult(data);
  };
  const saveSetting = async (s: Setting) => {
    const n = Number(draft[s.key]);
    if (!Number.isInteger(n)) { toast({ title: 'Enter a whole number', variant: 'destructive' }); return; }
    const { error } = await (supabase as any).rpc('staff_set_safety_setting', { p_key: s.key, p_value: n });
    if (error) { toast({ title: 'Could not save it', description: friendlyError(error), variant: 'destructive' }); return; }
    toast({ title: 'Saved' });
    void load();
  };

  return (
    <section aria-labelledby="det-title" className="space-y-10">
      <header>
        <h2 id="det-title" className="text-xl font-bold tracking-tight flex items-center gap-2"><ScanSearch className="h-5 w-5 text-primary" /> Detection and workload</h2>
        <p className="text-sm text-muted-foreground mt-1 max-w-2xl">Rules that open a case by themselves when a post, comment, listing or job matches, limits on how fast new accounts can post, response targets and second review. Nothing is removed automatically: a person always decides.</p>
      </header>

      {stats && (
        <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
          {Object.entries(stats.by_source).map(([k, v]) => (
            <div key={k} className="rounded-2xl border border-border bg-card p-4">
              <p className="text-xs text-muted-foreground">{SOURCE[k] || k} (30 days)</p>
              <p className="text-2xl font-bold tabular-nums mt-1">{v.opened}</p>
              <p className="text-xs text-muted-foreground">{v.upheld} led to action · {v.dismissed} dismissed</p>
            </div>
          ))}
        </div>
      )}

      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-sm font-semibold">Screening rules</h3>
          <Button size="sm" className="h-9 rounded-lg" onClick={() => setEditing(blank())}>New rule</Button>
        </div>
        <ul className="rounded-2xl border border-border bg-card divide-y divide-border">
          {rules.map((r) => (
            <li key={r.id} className="px-5 py-3.5 space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`font-semibold ${r.enabled ? '' : 'text-muted-foreground line-through'}`}>{r.name}</span>
                <Badge variant="outline" className="rounded-full capitalize">{r.severity}</Badge>
                <Badge variant="outline" className="rounded-full">{REASON_LABEL[r.reason] || r.reason}</Badge>
                {r.hide && <Badge variant="outline" className="rounded-full">Hides until reviewed</Badge>}
                <span className="ml-auto text-xs text-muted-foreground">{r.hits_30d} hits · {r.upheld_30d} right · {r.dismissed_30d} wrong</span>
              </div>
              <p className="text-xs text-muted-foreground font-mono break-all">{r.pattern}</p>
              <p className="text-xs text-muted-foreground">On {r.applies_to.join(', ')}{r.new_account_days ? ` · only accounts under ${r.new_account_days} days old` : ''}</p>
              <div className="flex gap-2 pt-1">
                <Button size="sm" variant="outline" className="h-8 rounded-lg" onClick={() => setEditing({ id: r.id, name: r.name, kind: r.kind, pattern: r.pattern, reason: r.reason, severity: r.severity, hide: r.hide, applies_to: r.applies_to, new_account_days: r.new_account_days, enabled: r.enabled })}>Edit</Button>
                <Button size="sm" variant="ghost" className="h-8 rounded-lg" onClick={() => toggle(r)}>{r.enabled ? 'Turn off' : 'Turn on'}</Button>
                <Button size="sm" variant="ghost" className="h-8 rounded-lg text-destructive" onClick={() => remove(r)}>Delete</Button>
              </div>
            </li>
          ))}
        </ul>

        {editing && (
          <div className="rounded-2xl border border-primary/30 bg-card p-5 space-y-4">
            <h4 className="text-sm font-semibold">{editing.id ? 'Edit the rule' : 'New rule'}</h4>
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-1.5"><Label htmlFor="r-name">Name</Label><Input id="r-name" value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} className="h-10 rounded-xl" maxLength={80} /></div>
              <div className="space-y-1.5"><Label htmlFor="r-kind">Match by</Label>
                <select id="r-kind" value={editing.kind} onChange={(e) => setEditing({ ...editing, kind: e.target.value as 'keyword' | 'regex' })} className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm">
                  <option value="keyword">A word or phrase</option><option value="regex">A pattern (regular expression)</option>
                </select></div>
            </div>
            <div className="space-y-1.5"><Label htmlFor="r-pat">{editing.kind === 'keyword' ? 'Word or phrase' : 'Pattern'}</Label><Input id="r-pat" value={editing.pattern} onChange={(e) => setEditing({ ...editing, pattern: e.target.value })} className="h-10 rounded-xl font-mono" maxLength={500} /></div>
            <div className="grid sm:grid-cols-3 gap-4">
              <div className="space-y-1.5"><Label htmlFor="r-reason">Reason</Label>
                <select id="r-reason" value={editing.reason} onChange={(e) => setEditing({ ...editing, reason: e.target.value })} className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm">
                  {Object.entries(REASON_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select></div>
              <div className="space-y-1.5"><Label htmlFor="r-sev">Priority</Label>
                <select id="r-sev" value={editing.severity} onChange={(e) => setEditing({ ...editing, severity: e.target.value as Rule['severity'] })} className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm">
                  {['low', 'medium', 'high', 'urgent'].map((s) => <option key={s} value={s}>{s}</option>)}
                </select></div>
              <div className="space-y-1.5"><Label htmlFor="r-age">Only accounts younger than (days)</Label>
                <Input id="r-age" inputMode="numeric" placeholder="Any age" value={editing.new_account_days ?? ''} onChange={(e) => setEditing({ ...editing, new_account_days: e.target.value.trim() ? Number(e.target.value) : null })} className="h-10 rounded-xl" /></div>
            </div>
            <fieldset className="flex flex-wrap gap-4">
              <legend className="text-xs font-medium mb-1.5">Applies to</legend>
              {WHERE.map((w) => (
                <label key={w} className="flex items-center gap-2 text-sm capitalize"><input type="checkbox" checked={editing.applies_to.includes(w)} onChange={(e) => setEditing({ ...editing, applies_to: e.target.checked ? [...editing.applies_to, w] : editing.applies_to.filter((x) => x !== w) })} /> {w}</label>
              ))}
            </fieldset>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={editing.hide} onChange={(e) => setEditing({ ...editing, hide: e.target.checked })} /> Hide a post or comment from others until a person has looked</label>
            <div className="flex gap-2">
              <Button className="rounded-xl font-semibold" disabled={busy || editing.name.trim().length < 3 || editing.pattern.trim().length < 2 || editing.applies_to.length === 0} onClick={saveRule}>Save rule</Button>
              <Button variant="ghost" className="rounded-xl" onClick={() => setEditing(null)}>Cancel</Button>
            </div>
          </div>
        )}

        <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
          <h4 className="text-sm font-semibold">Try some text</h4>
          <div className="flex flex-wrap gap-3">
            <select aria-label="Where it would appear" value={test.type} onChange={(e) => setTest({ ...test, type: e.target.value })} className="h-10 rounded-xl border border-input bg-background px-3 text-sm capitalize">
              {WHERE.map((w) => <option key={w} value={w}>{w}</option>)}
            </select>
          </div>
          <Textarea value={test.text} onChange={(e) => setTest({ ...test, text: e.target.value })} aria-label="Text to test" placeholder="Paste a message to see which rules it would match. Nothing is saved." className="rounded-xl min-h-[80px]" />
          <Button variant="outline" className="rounded-xl" disabled={test.text.trim().length < 2} onClick={runTest}>Test</Button>
          {testResult && (
            <p className="text-sm">{testResult.matched ? `Would open a ${testResult.severity} case (${REASON_LABEL[testResult.reason || ''] || testResult.reason}) from: ${testResult.rules.join(', ')}${testResult.hide ? '. It would be hidden until reviewed.' : '.'}` : 'No rule matches this text.'}</p>
          )}
          <p className="text-xs text-muted-foreground">Rules about new accounts are not applied in the test, because there is no account.</p>
        </div>
      </div>

      <div className="space-y-3">
        <h3 className="text-sm font-semibold">Limits, targets and sampling</h3>
        <div className="rounded-2xl border border-border bg-card divide-y divide-border">
          {settings.map((s) => (
            <div key={s.key} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
              <label htmlFor={s.key} className="text-sm">{s.label}</label>
              <div className="flex items-center gap-2">
                <Input id={s.key} inputMode="numeric" className="h-9 w-24 rounded-lg text-right" value={draft[s.key] ?? ''} onChange={(e) => setDraft({ ...draft, [s.key]: e.target.value })} />
                <Button size="sm" variant="outline" className="h-9 rounded-lg" disabled={draft[s.key] === String(s.value)} onClick={() => saveSetting(s)}>Save</Button>
              </div>
            </div>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">Staff accounts and system jobs are never limited. A limit that is hit shows the person "you are making … too quickly".</p>
      </div>

      {qa && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold">Second review (30 days)</h3>
          <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
            {[['Sampled', qa.sampled], ['Waiting', qa.pending], ['Agreed', qa.agreed], ['Disagreed', qa.disagreed]].map(([k, v]) => (
              <div key={k as string} className="rounded-2xl border border-border bg-card p-4"><p className="text-xs text-muted-foreground">{k}</p><p className="text-2xl font-bold tabular-nums mt-1">{v}</p></div>
            ))}
          </div>
          {qa.disagreements.length > 0 && (
            <ul className="rounded-2xl border border-border bg-card divide-y divide-border">
              {qa.disagreements.map((d) => (
                <li key={d.report_id} className="px-5 py-3 text-sm space-y-0.5">
                  <p><span className="font-semibold">{d.reviewer_name}</span> disagreed with <span className="font-semibold">{d.original_name}</span> ({d.original_status === 'resolved' ? 'action taken' : 'dismissed'}) · {new Date(d.reviewed_at).toLocaleDateString()}</p>
                  {d.note && <p className="text-muted-foreground">{d.note}</p>}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
};

export default DetectionPanel;
