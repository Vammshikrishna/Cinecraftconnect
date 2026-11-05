import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Trash2, Plus, Workflow, Zap } from 'lucide-react';
import { friendlyError } from '@cinecraft/core';
import ConfirmDialog from '../shared/ConfirmDialog';

const TARGETS = ['post', 'comment', 'user', 'job', 'listing', 'room'] as const;
const ACTIONS = ['dismiss', 'warn', 'takedown', 'shadowban', 'ban'] as const;

interface Rule { id: string; name: string; enabled: boolean; conditions: any; actions: any }
interface Bundle { id: string; name: string; action: string; note: string; also_warn: boolean; position: number }

const describeRule = (r: Rule) => {
  const c = r.conditions || {};
  const a = r.actions || {};
  const when: string[] = [];
  if (c.target_types?.length) when.push(`on ${c.target_types.join(' or ')}`);
  if (c.min_reports) when.push(`with ${c.min_reports}+ open reports`);
  if (c.author_max_age_days) when.push(`by an account under ${c.author_max_age_days} days old`);
  if (c.has_link === true) when.push('that contains a link');
  if (c.contains?.length) when.push(`containing: ${c.contains.join(', ')}`);
  const then: string[] = [];
  if (a.set_priority) then.push(`set priority to ${a.set_priority}`);
  if (a.auto_hide) then.push('hide it until staff look');
  return `A report ${when.join(' ') || 'of any kind'} → ${then.join(' and ') || 'nothing'}.`;
};

/** Admin tools that make the queue run itself: automation rules, and the one-click action bundles. */
const GovernanceTuning = () => {
  const { toast } = useToast();
  const [rules, setRules] = useState<Rule[]>([]);
  const [bundles, setBundles] = useState<Bundle[]>([]);

  // new rule
  const [name, setName] = useState('');
  const [types, setTypes] = useState<string[]>([]);
  const [minReports, setMinReports] = useState('');
  const [maxAge, setMaxAge] = useState('');
  const [hasLink, setHasLink] = useState(false);
  const [words, setWords] = useState('');
  const [priority, setPriority] = useState('');
  const [hide, setHide] = useState(false);

  // new bundle
  const [bName, setBName] = useState('');
  const [bAction, setBAction] = useState<string>('takedown');
  const [bNote, setBNote] = useState('');
  const [bWarn, setBWarn] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<{ kind: 'rule' | 'bundle'; id: string; name: string } | null>(null);

  const load = useCallback(async () => {
    const db: any = supabase;
    const [r, b] = await Promise.all([
      db.from('gov_rules').select('id, name, enabled, conditions, actions').order('created_at'),
      db.from('mod_bundles').select('id, name, action, note, also_warn, position').order('position'),
    ]);
    if (r.error) toast({ title: 'Could not load rules', description: friendlyError(r.error), variant: 'destructive' });
    setRules(r.data || []);
    setBundles(b.data || []);
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  const addRule = async () => {
    const conditions: any = {};
    if (types.length) conditions.target_types = types;
    if (minReports) conditions.min_reports = Number(minReports);
    if (maxAge) conditions.author_max_age_days = Number(maxAge);
    if (hasLink) conditions.has_link = true;
    const kw = words.split(',').map((w) => w.trim()).filter(Boolean);
    if (kw.length) conditions.contains = kw;
    const actions: any = {};
    if (priority) actions.set_priority = priority;
    if (hide) actions.auto_hide = true;
    if (!name.trim() || Object.keys(actions).length === 0) {
      toast({ title: 'Give the rule a name and at least one thing to do', variant: 'destructive' });
      return;
    }
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await (supabase as any).from('gov_rules').insert({ name: name.trim(), conditions, actions, created_by: user?.id });
    if (error) { toast({ title: 'Could not save the rule', description: error.message.includes('duplicate') ? 'A rule with that name exists.' : error.message, variant: 'destructive' }); return; }
    setName(''); setTypes([]); setMinReports(''); setMaxAge(''); setHasLink(false); setWords(''); setPriority(''); setHide(false);
    toast({ title: 'Rule saved. It applies to new reports.' });
    load();
  };

  const toggleRule = async (r: Rule, enabled: boolean) => {
    setRules((prev) => prev.map((x) => (x.id === r.id ? { ...x, enabled } : x)));
    const { error } = await (supabase as any).from('gov_rules').update({ enabled }).eq('id', r.id);
    if (error) { toast({ title: 'Could not change the rule', description: friendlyError(error), variant: 'destructive' }); load(); }
  };

  const removeRule = async (id: string) => {
    const { error } = await (supabase as any).from('gov_rules').delete().eq('id', id);
    if (error) toast({ title: 'Could not delete', description: friendlyError(error), variant: 'destructive' });
    load();
  };

  const addBundle = async () => {
    if (!bName.trim() || bNote.trim().length < 5) return;
    const { error } = await (supabase as any).from('mod_bundles').insert({ name: bName.trim(), action: bAction, note: bNote.trim(), also_warn: bWarn, position: bundles.length + 1 });
    if (error) { toast({ title: 'Could not save', description: error.message.includes('duplicate') ? 'A bundle with that name exists.' : error.message, variant: 'destructive' }); return; }
    setBName(''); setBNote(''); setBWarn(false);
    toast({ title: 'Saved. It appears in the case view and review mode.' });
    load();
  };

  const removeBundle = async (id: string) => {
    const { error } = await (supabase as any).from('mod_bundles').delete().eq('id', id);
    if (error) toast({ title: 'Could not delete', description: friendlyError(error), variant: 'destructive' });
    load();
  };

  const toggleType = (t: string) => setTypes((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));

  return (
    <div className="space-y-8">
      <section className="space-y-4 bg-card/50 border border-border/50 rounded-2xl p-6">
        <h2 className="text-xl font-black flex items-center gap-2"><Workflow className="text-primary" /> Automation rules</h2>
        <p className="text-muted-foreground text-sm">
          Rules look at each new report and can raise its priority or hide the content from others until staff have looked.
          Hidden content comes back by itself if the report is dismissed.
        </p>

        <div className="divide-y divide-border/40 rounded-xl border border-border/40">
          {rules.map((r) => (
            <div key={r.id} className="flex items-start justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <p className="text-sm font-bold">{r.name}</p>
                <p className="text-xs text-muted-foreground">{describeRule(r)}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Switch checked={r.enabled} onCheckedChange={(v) => toggleRule(r, v)} aria-label={`Turn ${r.name} ${r.enabled ? 'off' : 'on'}`} />
                <Button aria-label={`Delete ${r.name}`} variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive" onClick={() => setPendingDelete({ kind: 'rule', id: r.id, name: r.name })}><Trash2 className="w-4 h-4" /></Button>
              </div>
            </div>
          ))}
          {rules.length === 0 && <p className="px-4 py-6 text-sm text-center text-muted-foreground italic">No rules yet.</p>}
        </div>

        <div className="rounded-xl border border-border/40 p-4 space-y-3">
          <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">New rule</p>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name, for example: Links from new accounts" maxLength={80} />
          <div className="flex flex-wrap gap-2" role="group" aria-label="Applies to">
            {TARGETS.map((t) => (
              <button key={t} type="button" aria-pressed={types.includes(t)} onClick={() => toggleType(t)}
                className={`text-xs font-bold px-3 py-1.5 rounded-full border ${types.includes(t) ? 'bg-primary text-primary-foreground border-primary' : 'bg-card text-muted-foreground border-border'}`}>{t}</button>
            ))}
            <span className="text-[12px] text-muted-foreground self-center">(none ticked = any)</span>
          </div>
          <div className="grid gap-2 md:grid-cols-3">
            <Input type="number" min={1} value={minReports} onChange={(e) => setMinReports(e.target.value)} placeholder="Open reports at least" />
            <Input type="number" min={1} value={maxAge} onChange={(e) => setMaxAge(e.target.value)} placeholder="Author account under N days" />
            <label className="flex items-center gap-2 text-sm"><Switch checked={hasLink} onCheckedChange={setHasLink} /> Contains a link</label>
          </div>
          <Input value={words} onChange={(e) => setWords(e.target.value)} placeholder="Contains any of these words (comma separated)" />
          <div className="flex flex-wrap items-center gap-4">
            <select aria-label="Set priority" value={priority} onChange={(e) => setPriority(e.target.value)} className="h-9 rounded-md border border-border bg-background px-3 text-sm">
              <option value="">Do not change priority</option>
              <option value="low">Set priority: low</option>
              <option value="medium">Set priority: medium</option>
              <option value="high">Set priority: high</option>
              <option value="urgent">Set priority: urgent</option>
            </select>
            <label className="flex items-center gap-2 text-sm"><Switch checked={hide} onCheckedChange={setHide} /> Hide posts and comments until reviewed</label>
            <Button onClick={addRule}><Plus className="w-4 h-4 mr-1" /> Add rule</Button>
          </div>
        </div>
      </section>

      <section className="space-y-4 bg-card/50 border border-border/50 rounded-2xl p-6">
        <h2 className="text-xl font-black flex items-center gap-2"><Zap className="text-primary" /> Quick actions</h2>
        <p className="text-muted-foreground text-sm">One click in the case view or review mode: the action, the wording sent to the person, and optionally a warning to the author.</p>

        <div className="divide-y divide-border/40 rounded-xl border border-border/40">
          {bundles.map((b) => (
            <div key={b.id} className="flex items-start justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <p className="text-sm font-bold">{b.name} <span className="ml-2 text-[12px] uppercase font-black text-muted-foreground">{b.action}{b.also_warn ? ' + warn' : ''}</span></p>
                <p className="text-xs text-muted-foreground break-words">{b.note}</p>
              </div>
              <Button aria-label={`Delete ${b.name}`} variant="ghost" size="icon" className="shrink-0 text-muted-foreground hover:text-destructive" onClick={() => setPendingDelete({ kind: 'bundle', id: b.id, name: b.name })}><Trash2 className="w-4 h-4" /></Button>
            </div>
          ))}
          {bundles.length === 0 && <p className="px-4 py-6 text-sm text-center text-muted-foreground italic">No quick actions yet.</p>}
        </div>

        <div className="rounded-xl border border-border/40 p-4 space-y-3">
          <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">New quick action</p>
          <div className="grid gap-2 md:grid-cols-[1fr_160px]">
            <Input value={bName} onChange={(e) => setBName(e.target.value)} placeholder="Name, for example: Spam: remove + warn" maxLength={60} />
            <select aria-label="Action" value={bAction} onChange={(e) => setBAction(e.target.value)} className="h-9 rounded-md border border-border bg-background px-3 text-sm">
              {ACTIONS.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
          <Textarea value={bNote} onChange={(e) => setBNote(e.target.value)} rows={2} maxLength={500} placeholder="The wording the person receives" />
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 text-sm"><Switch checked={bWarn} onCheckedChange={setBWarn} /> Also warn the author (adds a strike)</label>
            <Button onClick={addBundle} disabled={!bName.trim() || bNote.trim().length < 5}><Plus className="w-4 h-4 mr-1" /> Add</Button>
          </div>
        </div>
      </section>
      <ConfirmDialog
        open={!!pendingDelete}
        title={pendingDelete?.kind === 'rule' ? 'Delete this automation rule?' : 'Delete this quick action?'}
        description={`"${pendingDelete?.name ?? ''}" will stop working straight away. This cannot be undone.`}
        confirmLabel="Delete"
        destructive
        onCancel={() => setPendingDelete(null)}
        onConfirm={async () => {
          const d = pendingDelete;
          setPendingDelete(null);
          if (!d) return;
          if (d.kind === 'rule') await removeRule(d.id); else await removeBundle(d.id);
        }}
      />
    </div>
  );
};

export default GovernanceTuning;
