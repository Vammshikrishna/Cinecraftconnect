import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { BackButton } from '@/components/common/BackButton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { AvailabilityBadge } from '@/components/network/AvailabilityBadge';
import { Plus, Trash2, Users } from 'lucide-react';

const db = supabase as any;

/** My private crew shortlists. */
const Shortlists = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [lists, setLists] = useState<any[]>([]);
  const [name, setName] = useState('');

  const load = useCallback(async () => {
    const { data } = await db.rpc('my_shortlists');
    setLists(data || []);
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  const create = async () => {
    if (!user || !name.trim()) return;
    const { error } = await db.from('crew_shortlists').insert({ owner_id: user.id, name: name.trim() });
    if (error) return toast({ title: 'Could not create the shortlist', description: error.message, variant: 'destructive' });
    setName('');
    load();
  };
  const removeList = async (id: string) => {
    if (!window.confirm('Delete this shortlist? The people are not affected.')) return;
    const { error } = await db.from('crew_shortlists').delete().eq('id', id);
    if (error) return toast({ title: 'Could not delete', description: error.message, variant: 'destructive' });
    load();
  };
  const removeMember = async (listId: string, personId: string) => {
    const { error } = await db.from('crew_shortlist_members').delete().eq('shortlist_id', listId).eq('person_id', personId);
    if (error) return toast({ title: 'Could not remove', description: error.message, variant: 'destructive' });
    load();
  };

  return (
    <div className="min-h-screen bg-background pt-20 pb-36">
      <div className="max-w-4xl mx-auto px-4 md:px-8 space-y-6">
        <BackButton label="BACK" />
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight flex items-center gap-2"><Users className="h-7 w-7 text-primary" /> Crew shortlists</h1>
          <p className="text-muted-foreground">Private lists of people you may hire, with a note about each. Add people from their profile.</p>
        </div>
        <div className="flex gap-2 max-w-md">
          <Input value={name} onChange={e => setName(e.target.value)} placeholder="New shortlist, e.g. Short film - camera team" maxLength={80} onKeyDown={e => e.key === 'Enter' && create()} />
          <Button onClick={create} disabled={!name.trim()}><Plus className="h-4 w-4 mr-1" />Create</Button>
        </div>

        {lists.length === 0 ? (
          <p className="text-center text-muted-foreground py-16">No shortlists yet.</p>
        ) : lists.map(l => (
          <Card key={l.id} className="bg-card/40 overflow-hidden">
            <div className="p-4 flex items-center justify-between border-b">
              <h2 className="font-semibold">{l.name} <span className="text-sm text-muted-foreground font-normal">· {l.members.length}</span></h2>
              <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => removeList(l.id)}><Trash2 className="h-4 w-4" /></Button>
            </div>
            {l.members.length === 0 ? <p className="p-4 text-sm text-muted-foreground">Empty. Open a profile and tap Shortlist.</p> : (
              <div className="divide-y">
                {l.members.map((m: any) => (
                  <div key={m.id} className="p-3 flex items-center gap-3">
                    <Link to={`/profile/${m.id}`}><Avatar className="h-10 w-10"><AvatarImage src={m.avatar_url || undefined} /><AvatarFallback>{(m.full_name || '?')[0]}</AvatarFallback></Avatar></Link>
                    <div className="min-w-0 flex-1">
                      <Link to={`/profile/${m.id}`} className="font-semibold text-sm hover:text-primary">{m.full_name}</Link>
                      <p className="text-xs text-muted-foreground truncate">{[m.craft, m.location].filter(Boolean).join(' · ')}</p>
                      {m.note && <p className="text-xs italic mt-0.5">“{m.note}”</p>}
                    </div>
                    <AvailabilityBadge status={m.availability} />
                    <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => removeMember(l.id, m.id)}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                ))}
              </div>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
};

export default Shortlists;
