import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Check, Loader2, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';

const db = supabase as any;
const today = () => new Date().toISOString().slice(0, 10);

interface Base { open: boolean; onOpenChange: (o: boolean) => void; targetId: string; targetName: string }

/** Ask someone to hold their dates for a role. They accept, decline or counter; accepted dates become Tentative in their calendar. */
export const RequestDatesDialog = ({ open, onOpenChange, targetId, targetName }: Base) => {
  const { toast } = useToast();
  const [start, setStart] = useState(today());
  const [end, setEnd] = useState(today());
  const [role, setRole] = useState('');
  const [rate, setRate] = useState('');
  const [currency, setCurrency] = useState('INR');
  const [project, setProject] = useState('');
  const [note, setNote] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (open) { setStart(today()); setEnd(today()); setRole(''); setRate(''); setProject(''); setNote(''); }
  }, [open]);

  const send = async () => {
    setSending(true);
    const { error } = await db.rpc('request_date_hold', {
      p_target: targetId, p_start: start, p_end: end, p_role: role.trim(), p_rate: rate ? parseInt(rate, 10) : null,
      p_currency: currency || 'INR', p_note: note.trim() || null, p_project_title: project.trim() || null,
    });
    setSending(false);
    if (error) return toast({ title: 'Could not send the request', description: error.message, variant: 'destructive' });
    toast({ title: 'Request sent', description: `${targetName} will be notified.` });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Hold {targetName}'s dates</DialogTitle>
          <DialogDescription>They can accept, decline or send a counter offer.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1"><Label>From</Label><Input type="date" min={today()} value={start} onChange={e => { setStart(e.target.value); if (end < e.target.value) setEnd(e.target.value); }} /></div>
            <div className="space-y-1"><Label>To</Label><Input type="date" min={start} value={end} onChange={e => setEnd(e.target.value)} /></div>
          </div>
          <div className="space-y-1"><Label>Role you need</Label><Input value={role} onChange={e => setRole(e.target.value)} placeholder="Director of Photography" maxLength={80} /></div>
          <div className="space-y-1">
            <Label>Rate per day (optional)</Label>
            <div className="flex gap-2">
              <Input className="w-20" value={currency} maxLength={3} onChange={e => setCurrency(e.target.value.toUpperCase())} />
              <Input type="number" min={0} value={rate} onChange={e => setRate(e.target.value)} placeholder="Amount" />
            </div>
          </div>
          <div className="space-y-1"><Label>Project (optional)</Label><Input value={project} onChange={e => setProject(e.target.value)} maxLength={120} /></div>
          <div className="space-y-1"><Label>Note (optional)</Label><Textarea rows={3} maxLength={500} value={note} onChange={e => setNote(e.target.value)} className="resize-none" /></div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={send} disabled={sending || !role.trim()}>{sending ? 'Sending...' : 'Send request'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

/** A personal invitation to one of my project spaces. */
export const InviteToProjectDialog = ({ open, onOpenChange, targetId, targetName }: Base) => {
  const { toast } = useToast();
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [space, setSpace] = useState<string | null>(null);
  const [role, setRole] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true); setSpace(null); setRole(''); setMessage('');
    db.rpc('my_invitable_projects').then(({ data }: any) => { setProjects(data || []); setLoading(false); });
  }, [open]);

  const send = async () => {
    if (!space) return;
    setSending(true);
    const { error } = await db.rpc('invite_to_project', { p_space: space, p_invitee: targetId, p_crew_role: role.trim() || null, p_message: message.trim() || null });
    setSending(false);
    if (error) return toast({ title: 'Could not send the invitation', description: error.message, variant: 'destructive' });
    toast({ title: 'Invitation sent', description: `${targetName} will be notified.` });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Invite {targetName} to a project</DialogTitle>
          <DialogDescription>They join the project space once they accept.</DialogDescription>
        </DialogHeader>
        {loading ? <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
          : projects.length === 0 ? <p className="text-sm text-muted-foreground text-center py-4">You do not manage any project space yet. Create one first, then invite people.</p>
          : (
            <div className="space-y-3">
              <div className="max-h-44 overflow-y-auto space-y-1">
                {projects.map(p => (
                  <button key={p.id} onClick={() => setSpace(p.id)} className={cn('w-full flex items-center justify-between rounded-lg border px-3 py-2 text-left text-sm', space === p.id ? 'border-primary bg-primary/10' : 'hover:bg-muted')}>
                    <span className="font-medium line-clamp-1">{p.name}</span>{space === p.id && <Check className="h-4 w-4 text-primary" />}
                  </button>
                ))}
              </div>
              <Input value={role} onChange={e => setRole(e.target.value)} placeholder="Role, e.g. Editor (optional)" maxLength={80} />
              <Textarea rows={3} maxLength={300} value={message} onChange={e => setMessage(e.target.value)} placeholder="Message (optional)" className="resize-none" />
            </div>
          )}
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={send} disabled={!space || sending}>{sending ? 'Sending...' : 'Send invitation'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const RELATIONS: [string, string][] = [['worked_with', 'We worked together'], ['managed', 'I managed them'], ['hired', 'I hired them'], ['mentored', 'I mentored them']];

/** A few honest lines about working with someone. They approve it before it shows on their profile. */
export const RecommendDialog = ({ open, onOpenChange, targetId, targetName, onDone }: Base & { onDone?: () => void }) => {
  const { toast } = useToast();
  const [relationship, setRelationship] = useState('worked_with');
  const [project, setProject] = useState('');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (open) { setRelationship('worked_with'); setProject(''); setBody(''); }
  }, [open]);

  const send = async () => {
    setSending(true);
    const { error } = await db.rpc('write_recommendation', { p_subject: targetId, p_relationship: relationship, p_body: body.trim(), p_project_title: project.trim() || null });
    setSending(false);
    if (error) return toast({ title: 'Could not send the recommendation', description: error.message, variant: 'destructive' });
    toast({ title: 'Recommendation sent', description: `${targetName} will approve it before it shows on their profile.` });
    onOpenChange(false);
    onDone?.();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Recommend {targetName}</DialogTitle>
          <DialogDescription>Only connections can recommend. {targetName} approves it first.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="flex flex-wrap gap-1.5">
            {RELATIONS.map(([k, l]) => (
              <button key={k} onClick={() => setRelationship(k)} className={cn('px-3 py-1 rounded-full text-xs font-semibold border', relationship === k ? 'bg-primary text-primary-foreground border-primary' : 'text-muted-foreground hover:bg-muted')}>{l}</button>
            ))}
          </div>
          <Input value={project} onChange={e => setProject(e.target.value)} placeholder="Project (optional)" maxLength={120} />
          <Textarea rows={5} maxLength={600} value={body} onChange={e => setBody(e.target.value)} placeholder="What was it like working with them? (20 to 600 characters)" className="resize-none" />
          <p className="text-xs text-muted-foreground text-right">{body.length}/600</p>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={send} disabled={sending || body.trim().length < 20}>{sending ? 'Sending...' : 'Send'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

/** Save someone into one of my private crew shortlists, with a note. */
export const AddToShortlistDialog = ({ open, onOpenChange, targetId, targetName }: Base) => {
  const { toast } = useToast();
  const [lists, setLists] = useState<any[]>([]);
  const [member, setMember] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [note, setNote] = useState('');

  const load = async () => {
    setLoading(true);
    const { data } = await db.rpc('my_shortlists');
    const ls = (data || []) as any[];
    setLists(ls);
    const map: Record<string, boolean> = {};
    ls.forEach(l => { if ((l.members || []).some((m: any) => m.id === targetId)) map[l.id] = true; });
    setMember(map);
    setLoading(false);
  };
  useEffect(() => {
    if (open) { setNote(''); setName(''); load(); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const toggle = async (listId: string) => {
    const on = !member[listId];
    setMember(m => ({ ...m, [listId]: on }));
    const { error } = on
      ? await db.from('crew_shortlist_members').insert({ shortlist_id: listId, person_id: targetId, note: note.trim() || null })
      : await db.from('crew_shortlist_members').delete().eq('shortlist_id', listId).eq('person_id', targetId);
    if (error && error.code !== '23505') {
      setMember(m => ({ ...m, [listId]: !on }));
      toast({ title: 'Could not update the shortlist', description: error.message, variant: 'destructive' });
    }
  };

  const create = async () => {
    const { data: me } = await supabase.auth.getUser();
    if (!me.user || !name.trim()) return;
    const { data, error } = await db.from('crew_shortlists').insert({ owner_id: me.user.id, name: name.trim() }).select('id').single();
    if (error) return toast({ title: 'Could not create the shortlist', description: error.message, variant: 'destructive' });
    await db.from('crew_shortlist_members').insert({ shortlist_id: data.id, person_id: targetId, note: note.trim() || null });
    setName('');
    load();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Shortlist {targetName}</DialogTitle>
          <DialogDescription>Private to you.</DialogDescription>
        </DialogHeader>
        <Input value={note} onChange={e => setNote(e.target.value)} placeholder="Note about them (optional)" maxLength={300} />
        {loading ? <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div> : (
          <div className="max-h-52 overflow-y-auto space-y-1">
            {lists.length === 0 && <p className="text-sm text-muted-foreground text-center py-3">No shortlists yet. Create one below.</p>}
            {lists.map(l => (
              <button key={l.id} onClick={() => toggle(l.id)} className={cn('w-full flex items-center justify-between rounded-lg border px-3 py-2 text-left text-sm', member[l.id] ? 'border-primary bg-primary/10' : 'hover:bg-muted')}>
                <span className="font-medium line-clamp-1">{l.name} <span className="text-xs text-muted-foreground font-normal">· {(l.members || []).length}</span></span>
                {member[l.id] && <Check className="h-4 w-4 text-primary shrink-0" />}
              </button>
            ))}
          </div>
        )}
        <div className="flex gap-2 pt-2 border-t">
          <Input value={name} onChange={e => setName(e.target.value)} placeholder="New shortlist, e.g. Short film - camera team" maxLength={80} onKeyDown={e => e.key === 'Enter' && create()} />
          <Button onClick={create} disabled={!name.trim()}><Plus className="h-4 w-4" /></Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
