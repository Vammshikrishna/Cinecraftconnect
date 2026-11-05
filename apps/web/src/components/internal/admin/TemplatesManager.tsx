import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Trash2, Plus, MessageSquareText } from 'lucide-react';
import { friendlyError } from '@cinecraft/core';
import ConfirmDialog from '../shared/ConfirmDialog';

interface Template { id: string; kind: 'reason' | 'reply'; title: string; body: string }

/** The saved wording staff pick from when they give a reason. Admins edit it here. */
const TemplatesManager = () => {
  const { toast } = useToast();
  const [items, setItems] = useState<Template[]>([]);
  const [kind, setKind] = useState<'reason' | 'reply'>('reason');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [saving, setSaving] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<Template | null>(null);

  const load = useCallback(async () => {
    const { data, error } = await (supabase as any).from('mod_templates').select('id, kind, title, body').order('kind').order('title');
    if (error) toast({ title: 'Could not load saved reasons', description: friendlyError(error), variant: 'destructive' });
    setItems((data as Template[]) || []);
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  const add = async () => {
    if (!title.trim() || body.trim().length < 5) return;
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await (supabase as any).from('mod_templates').insert({ kind, title: title.trim(), body: body.trim(), created_by: user?.id });
    setSaving(false);
    if (error) { toast({ title: 'Could not save', description: error.message.includes('duplicate') ? 'A saved reason with that title already exists.' : error.message, variant: 'destructive' }); return; }
    setTitle('');
    setBody('');
    toast({ title: kind === 'reply' ? 'Saved. It shows up in the support reply box.' : 'Saved. It shows up the next time staff open a reason box.' });
    load();
  };

  const remove = async (id: string) => {
    const { error } = await (supabase as any).from('mod_templates').delete().eq('id', id);
    if (error) { toast({ title: 'Could not delete', description: friendlyError(error), variant: 'destructive' }); return; }
    load();
  };

  return (
    <div className="space-y-4 bg-card/50 border border-border/50 rounded-2xl p-6">
      <h2 className="text-xl font-black flex items-center gap-2">
        <MessageSquareText className="text-primary" /> {kind === 'reply' ? 'Saved replies' : 'Saved reasons'}
      </h2>
      <div className="flex gap-2" role="group" aria-label="Which saved wording">
        {(['reason', 'reply'] as const).map((k) => (
          <button
            key={k}
            type="button"
            aria-pressed={kind === k}
            onClick={() => setKind(k)}
            className={`h-8 px-4 rounded-full text-xs font-bold border transition ${kind === k ? 'bg-primary text-primary-foreground border-primary' : 'bg-muted/40 border-border text-muted-foreground hover:text-foreground'}`}
          >
            {k === 'reason' ? 'Reasons' : 'Support replies'}
          </button>
        ))}
      </div>
      <p className="text-muted-foreground text-sm">
        {kind === 'reply'
          ? 'Ready-made replies for the support desk. Staff pick one in the reply box and can edit it before sending. {{name}} becomes the person\'s first name.'
          : 'Ready-made wording for the reason box. It is sent to the person, so keep it clear and polite.'}
      </p>

      <div className="grid gap-2 md:grid-cols-[200px_1fr_auto] items-start">
        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Short title" maxLength={60} />
        <Textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="The wording" rows={2} maxLength={500} />
        <Button onClick={add} disabled={saving || !title.trim() || body.trim().length < 5}><Plus className="w-4 h-4 mr-1" /> Add</Button>
      </div>

      <div className="divide-y divide-border/40 rounded-xl border border-border/40">
        {items.filter((i) => i.kind === kind).map((t) => (
          <div key={t.id} className="flex items-start justify-between gap-3 px-4 py-3">
            <div className="min-w-0">
              <p className="text-sm font-bold">{t.title}</p>
              <p className="text-xs text-muted-foreground break-words">{t.body}</p>
            </div>
            <Button aria-label={`Delete ${t.title}`} variant="ghost" size="icon" className="shrink-0 text-muted-foreground hover:text-destructive" onClick={() => setPendingDelete(t)}>
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        ))}
        {items.filter((i) => i.kind === kind).length === 0 && <p className="px-4 py-6 text-sm text-center text-muted-foreground italic">{kind === 'reply' ? 'No saved replies yet.' : 'No saved reasons yet.'}</p>}
      </div>
      <ConfirmDialog
        open={!!pendingDelete}
        title={pendingDelete?.kind === 'reply' ? 'Delete this saved reply?' : 'Delete this saved reason?'}
        description={`"${pendingDelete?.title ?? ''}" will no longer be offered in the ${pendingDelete?.kind === 'reply' ? 'support reply' : 'reason'} box. This cannot be undone.`}
        confirmLabel="Delete"
        destructive
        onCancel={() => setPendingDelete(null)}
        onConfirm={async () => {
          const d = pendingDelete;
          setPendingDelete(null);
          if (d) await remove(d.id);
        }}
      />
    </div>
  );
};

export default TemplatesManager;
