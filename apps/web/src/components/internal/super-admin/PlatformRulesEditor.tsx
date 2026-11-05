import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pencil, Plus, SlidersHorizontal } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { friendlyError } from '@cinecraft/core';

interface Rule {
  id: string;
  key: string;
  value: unknown;
  category: string | null;
  description: string | null;
  updated_at: string | null;
  updated_by_name: string | null;
}

/**
 * The numbers and switches that moderation runs on (thresholds, limits, durations). Each change needs a reason, and the
 * old value is kept in the audit ledger.
 */
export const PlatformRulesEditor = () => {
  const { toast } = useToast();
  const [rules, setRules] = useState<Rule[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<{ key: string; isNew: boolean } | null>(null);
  const [keyText, setKeyText] = useState('');
  const [valueText, setValueText] = useState('');
  const [descText, setDescText] = useState('');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const { data, error } = await (supabase as any).rpc('staff_list_platform_rules');
    if (error) toast({ title: 'Could not load rules', description: friendlyError(error), variant: 'destructive' });
    setRules((data || []) as Rule[]);
    setLoading(false);
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  const grouped = useMemo(() => {
    const m = new Map<string, Rule[]>();
    rules.forEach((r) => m.set(r.category || 'general', [...(m.get(r.category || 'general') || []), r]));
    return [...m.entries()];
  }, [rules]);

  const open = (r?: Rule) => {
    setEditing({ key: r?.key || '', isNew: !r });
    setKeyText(r?.key || '');
    setValueText(r ? JSON.stringify(r.value, null, 2) : '');
    setDescText(r?.description || '');
    setReason('');
  };

  let parsed: { ok: true; value: unknown } | { ok: false } = { ok: false };
  try { parsed = valueText.trim() ? { ok: true, value: JSON.parse(valueText) } : { ok: false }; } catch { parsed = { ok: false }; }
  const canSave = parsed.ok && keyText.trim().length > 0 && reason.trim().length >= 5;

  const save = async () => {
    if (!parsed.ok) return;
    setSaving(true);
    const { error } = await (supabase as any).rpc('staff_set_platform_rule', {
      p_key: keyText.trim(),
      p_value: parsed.value,
      p_description: descText.trim() || null,
      p_reason: reason.trim(),
    });
    setSaving(false);
    if (error) return toast({ title: 'Could not save the rule', description: friendlyError(error), variant: 'destructive' });
    toast({ title: 'Rule saved' });
    setEditing(null);
    load();
  };

  if (loading) return <div className="flex justify-center py-16"><LoadingSpinner size="lg" /></div>;

  return (
    <section aria-labelledby="rules-title" className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="rules-title" className="text-xl font-bold tracking-tight flex items-center gap-2"><SlidersHorizontal className="h-5 w-5 text-primary" /> Platform rules</h2>
          <p className="text-sm text-muted-foreground mt-1">The thresholds and limits moderation runs on. Every change needs a reason and is logged with the old value.</p>
        </div>
        <Button className="h-10 rounded-xl gap-1.5 font-semibold" onClick={() => open()}><Plus className="h-4 w-4" /> New rule</Button>
      </header>

      {grouped.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card py-14 text-center text-sm text-muted-foreground">No rules are defined yet.</div>
      ) : (
        grouped.map(([category, list]) => (
          <div key={category}>
            <h3 className="text-sm font-semibold capitalize text-muted-foreground mb-2">{category}</h3>
            <ul className="rounded-2xl border border-border bg-card divide-y divide-border overflow-hidden">
              {list.map((r) => (
                <li key={r.id} className="flex items-start gap-4 px-4 py-3.5">
                  <div className="min-w-0 flex-1">
                    <p className="font-mono text-sm font-medium">{r.key}</p>
                    {r.description && <p className="text-sm text-muted-foreground mt-0.5">{r.description}</p>}
                    <pre className="mt-2 rounded-lg bg-muted/60 px-3 py-2 text-xs overflow-x-auto">{JSON.stringify(r.value)}</pre>
                    {r.updated_at && <p className="text-xs text-muted-foreground mt-1.5">Changed {new Date(r.updated_at).toLocaleDateString()}{r.updated_by_name ? ` by ${r.updated_by_name}` : ''}</p>}
                  </div>
                  <Button size="sm" variant="secondary" className="h-9 rounded-lg gap-1.5 shrink-0" onClick={() => open(r)}><Pencil className="h-3.5 w-3.5" /> Edit</Button>
                </li>
              ))}
            </ul>
          </div>
        ))
      )}

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing?.isNew ? 'New rule' : 'Change rule'}</DialogTitle>
            <DialogDescription>The value is JSON, for example 3, true, or {'{"max": 5}'}.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="space-y-1.5"><Label htmlFor="pr-key">Name</Label><Input id="pr-key" value={keyText} onChange={(e) => setKeyText(e.target.value)} disabled={!editing?.isNew} className="h-11 rounded-xl font-mono text-sm" /></div>
            <div className="space-y-1.5">
              <Label htmlFor="pr-value">Value</Label>
              <Textarea id="pr-value" value={valueText} onChange={(e) => setValueText(e.target.value)} aria-invalid={!!valueText && !parsed.ok} className="rounded-xl min-h-[100px] font-mono text-xs" />
              {!!valueText && !parsed.ok && <p className="text-xs text-destructive" role="alert">That is not valid JSON.</p>}
            </div>
            <div className="space-y-1.5"><Label htmlFor="pr-desc">What it does</Label><Input id="pr-desc" value={descText} onChange={(e) => setDescText(e.target.value)} className="h-11 rounded-xl" /></div>
            <div className="space-y-1.5"><Label htmlFor="pr-reason">Why are you changing it?</Label><Textarea id="pr-reason" value={reason} onChange={(e) => setReason(e.target.value)} className="rounded-xl min-h-[70px]" /></div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
            <Button onClick={save} disabled={!canSave || saving} className="rounded-xl font-semibold">{saving ? 'Saving' : 'Save rule'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
};

export default PlatformRulesEditor;
