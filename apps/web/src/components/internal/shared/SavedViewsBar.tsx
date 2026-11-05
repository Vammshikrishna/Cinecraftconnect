import { useCallback, useEffect, useState } from 'react';
import { Bookmark, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { cleanViewName, isMissingDbObject } from './deskLogic';

interface View { id: string; name: string; filter: unknown }

interface Props {
  /** which table the views belong to, for example "admin.tickets" */
  scope: string;
  /** the filter on screen now (saved as it is) */
  current: unknown;
  /** true when the filter on screen is the plain default, so there is nothing worth saving */
  isDefault: boolean;
  /** the filter of a saved view is handed back as stored; the caller reads it safely */
  onApply: (filter: unknown) => void;
}

/**
 * Saved views for an admin table: pick a saved filter, save the one on screen under a name, delete one you no longer use.
 * Needs supabase/manual/part_gb_admin_saved_views.sql; until then it says so and the filters keep working.
 */
const SavedViewsBar = ({ scope, current, isDefault, onApply }: Props) => {
  const { toast } = useToast();
  const [views, setViews] = useState<View[]>([]);
  const [state, setState] = useState<'loading' | 'ready' | 'missing'>('loading');
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const { data, error } = await (supabase as any).from('staff_saved_views').select('id, name, filter').eq('scope', scope).order('name');
    if (error) {
      setState(isMissingDbObject(error) ? 'missing' : 'ready');
      return;
    }
    setViews((data || []) as View[]);
    setState('ready');
  }, [scope]);

  useEffect(() => { void load(); }, [load]);

  const save = async () => {
    const clean = cleanViewName(name);
    if (!clean) return;
    setBusy(true);
    const { error } = await (supabase as any).from('staff_saved_views').insert({ scope, name: clean, filter: current });
    setBusy(false);
    if (error) {
      toast({
        title: 'Could not save the view',
        description: /duplicate|unique/i.test(error.message || '') ? 'You already have a view with that name.' : (error.message || 'Try again in a moment.'),
        variant: 'destructive',
      });
      return;
    }
    toast({ title: 'View saved', description: clean });
    setName('');
    setNaming(false);
    void load();
  };

  const remove = async (v: View) => {
    const { error } = await (supabase as any).from('staff_saved_views').delete().eq('id', v.id);
    if (error) { toast({ title: 'Could not delete the view', description: error.message, variant: 'destructive' }); return; }
    setViews((list) => list.filter((x) => x.id !== v.id));
  };

  if (state === 'loading') return null;
  if (state === 'missing') {
    return (
      <p className="text-[12px] text-muted-foreground" role="note">
        Saved views are not switched on yet. Run <span className="font-mono">supabase/manual/part_gb_admin_saved_views.sql</span>; the filters still work without it.
      </p>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Saved views">
      <span className="text-[12px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-1"><Bookmark className="w-3 h-3" aria-hidden="true" /> Saved views</span>
      {views.length === 0 && !naming && <span className="text-[12px] text-muted-foreground">None yet.</span>}
      {views.map((v) => (
        <span key={v.id} className="inline-flex items-center rounded-full border border-border bg-muted/40 text-xs font-bold">
          <button type="button" className="h-8 pl-3 pr-2 hover:text-primary" onClick={() => onApply(v.filter)}>{v.name}</button>
          <button type="button" aria-label={`Delete the saved view ${v.name}`} className="h-8 pr-2.5 pl-1 text-muted-foreground hover:text-destructive" onClick={() => remove(v)}>
            <Trash2 className="w-3 h-3" />
          </button>
        </span>
      ))}
      {naming ? (
        <span className="inline-flex items-center gap-1.5">
          <Input
            autoFocus
            aria-label="Name for this view"
            placeholder="Name this view"
            className="h-8 w-44 text-xs"
            maxLength={60}
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') void save(); if (e.key === 'Escape') setNaming(false); }}
          />
          <Button size="sm" className="h-8 rounded-full text-xs" disabled={busy || !cleanViewName(name)} onClick={save}>Save</Button>
          <Button size="icon" variant="ghost" className="h-8 w-8" aria-label="Cancel" onClick={() => { setNaming(false); setName(''); }}><X className="w-3.5 h-3.5" /></Button>
        </span>
      ) : (
        <Button size="sm" variant="outline" className="h-8 rounded-full text-xs font-bold" disabled={isDefault} title={isDefault ? 'Pick a filter first' : undefined} onClick={() => setNaming(true)}>
          Save view
        </Button>
      )}
    </div>
  );
};

export default SavedViewsBar;
