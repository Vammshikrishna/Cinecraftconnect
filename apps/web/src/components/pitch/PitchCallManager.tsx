import { useCallback, useEffect, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { Megaphone, Inbox, Pencil, Copy, Lock, Unlock, Eye, Loader2, PlusCircle, Trash2 } from 'lucide-react';
import { confirmDialog } from '@/lib/confirmDialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CardSkeleton } from '@/components/ui/enhanced-skeleton';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useAppNavigation } from '@/contexts/NavigationContext';
import {
    closePitchCall, reopenPitchCall, duplicatePitchCall, friendlyError,
    countSubmissionsByCall, ownCallState, isDirectPitchCall,
    type CallSubmissionCounts, type OwnCallState,
} from '@cinecraft/core';

const STATE_LABEL: Record<OwnCallState, { label: string; cls: string }> = {
    open: { label: 'Open', cls: 'text-green-500 bg-green-500/10' },
    expired: { label: 'Deadline passed', cls: 'text-amber-500 bg-amber-500/10' },
    closed: { label: 'Closed', cls: 'text-muted-foreground bg-muted' },
    draft: { label: 'Draft', cls: 'text-blue-500 bg-blue-500/10' },
};

/** The place where a call creator manages their own pitch calls: see each one, open its pitches, close, re-open, copy, edit. */
export const PitchCallManager = ({ onCreate }: { onCreate?: () => void }) => {
    const { user } = useAuth();
    const { toast } = useToast();
    const { push } = useAppNavigation();
    const [calls, setCalls] = useState<any[]>([]);
    const [counts, setCounts] = useState<Record<string, CallSubmissionCounts>>({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);
    const [busyId, setBusyId] = useState<string | null>(null);

    const load = useCallback(async () => {
        if (!user) { setLoading(false); return; }
        setError(false);
        try {
            const { data, error: callsError } = await supabase
                .from('pitch_calls')
                .select('*')
                .eq('creator_id', user.id)
                .order('created_at', { ascending: false });
            if (callsError) throw callsError;
            const mine = (data || []).filter((c: any) => !isDirectPitchCall(c.attachments));
            setCalls(mine);
            if (mine.length) {
                const { data: subs, error: subsError } = await supabase
                    .from('pitch_submissions')
                    .select('pitch_call_id, status')
                    .in('pitch_call_id', mine.map((c: any) => c.id));
                if (subsError) throw subsError;
                setCounts(countSubmissionsByCall(subs as any));
            } else {
                setCounts({});
            }
        } catch {
            setError(true);
        } finally {
            setLoading(false);
        }
    }, [user?.id]);

    useEffect(() => { load(); }, [load]);

    const toggleOpen = async (call: any) => {
        const state = ownCallState(call);
        const closing = state === 'open';
        if (closing && !window.confirm('Close this call? Writers will not be able to send new pitches. Pitches already sent stay with you.')) return;
        setBusyId(call.id);
        try {
            if (closing) {
                await closePitchCall(supabase, call.id);
                toast({ title: 'Call closed' });
            } else {
                const deadline = await reopenPitchCall(supabase, call);
                toast({ title: 'Call re-opened', description: deadline ? `Deadline: ${deadline}` : undefined });
            }
            await load();
        } catch (e: any) {
            toast({ title: 'Could not update the call', description: friendlyError(e), variant: 'destructive' });
        } finally { setBusyId(null); }
    };

    /** A call nobody pitched to can be deleted once it is not open. Calls that received pitches stay (the writers' pitches belong to them too). */
    const removeCall = async (call: any) => {
        if (!user) return;
        if (!await confirmDialog('This permanently deletes the call. This cannot be undone.', { title: 'Delete this pitch call?', confirmLabel: 'Delete call' })) return;
        setBusyId(call.id);
        try {
            const { data, error: delError } = await supabase.from('pitch_calls').delete().eq('id', call.id).eq('creator_id', user.id).select('id');
            if (delError) throw delError;
            if (!data || data.length === 0) {
                toast({ title: 'Deleting is not available yet', description: 'It will work as soon as the database update is applied.', variant: 'destructive' });
            } else {
                toast({ title: 'Pitch call deleted' });
                await load();
            }
        } catch (e: any) {
            toast({ title: 'Could not delete the call', description: friendlyError(e), variant: 'destructive' });
        } finally { setBusyId(null); }
    };

    const copy = async (call: any) => {
        if (!user) return;
        setBusyId(call.id);
        try {
            const id = await duplicatePitchCall(supabase, call, user.id);
            toast({ title: 'Copy created', description: 'Set a deadline and adjust it as you like.' });
            push(`/pitch/${id}`);
        } catch (e: any) {
            toast({ title: 'Could not copy the call', description: friendlyError(e), variant: 'destructive' });
        } finally { setBusyId(null); }
    };

    if (loading) return <div className="grid gap-3">{[1, 2, 3].map(i => <CardSkeleton key={i} />)}</div>;

    if (error) return (
        <div className="text-center py-16">
            <p className="font-bold text-foreground/80">Could not load your pitch calls</p>
            <Button variant="outline" className="mt-4 rounded-full" onClick={() => { setLoading(true); load(); }}>Try again</Button>
        </div>
    );

    if (calls.length === 0) return (
        <div className="text-center py-20">
            <div className="h-16 w-16 rounded-2xl bg-muted/30 border border-border/40 flex items-center justify-center mx-auto mb-4">
                <Megaphone className="h-8 w-8 text-muted-foreground/40" />
            </div>
            <p className="font-bold text-foreground/80">You have not posted a pitch call yet</p>
            <p className="text-sm text-muted-foreground mt-1">Post one and manage it here.</p>
            {onCreate && (
                <Button className="mt-5 rounded-full font-bold px-6" onClick={onCreate}>
                    <PlusCircle className="h-4 w-4 mr-2" /> Post a Pitch Call
                </Button>
            )}
        </div>
    );

    return (
        <div className="space-y-3">
            {calls.map((call) => {
                const state = ownCallState(call);
                const c = counts[call.id] || { total: 0, fresh: 0, shortlisted: 0 };
                const busy = busyId === call.id;
                return (
                    <div key={call.id} className="bg-card border border-border/50 rounded-2xl p-5">
                        <div className="flex items-start justify-between gap-3">
                            <button className="min-w-0 text-left" onClick={() => push(`/pitch/${call.id}`)}>
                                <p className="font-black text-sm text-foreground leading-tight hover:underline">{call.title}</p>
                                <p className="text-xs text-muted-foreground mt-1">
                                    {call.deadline ? `Deadline ${format(parseISO(String(call.deadline).slice(0, 10)), 'd MMM yyyy')}` : 'No deadline'}
                                </p>
                            </button>
                            <Badge className={`text-[12px] font-bold shrink-0 ${STATE_LABEL[state].cls}`}>{STATE_LABEL[state].label}</Badge>
                        </div>

                        <div className="grid grid-cols-4 gap-2 mt-4 text-center">
                            {[
                                { label: 'Pitches', value: c.total },
                                { label: 'New', value: c.fresh },
                                { label: 'Shortlisted', value: c.shortlisted },
                                { label: 'Views', value: call.view_count ?? 0 },
                            ].map((s) => (
                                <div key={s.label} className="rounded-xl bg-muted/30 py-2">
                                    <p className="text-lg font-black">{s.value}</p>
                                    <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground/70">{s.label}</p>
                                </div>
                            ))}
                        </div>

                        <div className="flex flex-wrap gap-2 mt-4">
                            <Button size="sm" className="rounded-full gap-1.5" onClick={() => push(`/pitch?tab=inbox&pitchCallId=${call.id}`)}>
                                <Inbox className="h-3.5 w-3.5" /> Review pitches{c.fresh > 0 ? ` (${c.fresh} new)` : ''}
                            </Button>
                            <Button size="sm" variant="outline" className="rounded-full gap-1.5" onClick={() => push(`/pitch/${call.id}`)}>
                                <Pencil className="h-3.5 w-3.5" /> Edit
                            </Button>
                            {state !== 'draft' && (
                                <Button size="sm" variant="outline" className="rounded-full gap-1.5" disabled={busy} onClick={() => toggleOpen(call)}>
                                    {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : state === 'open' ? <Lock className="h-3.5 w-3.5" /> : <Unlock className="h-3.5 w-3.5" />}
                                    {state === 'open' ? 'Close call' : 'Re-open'}
                                </Button>
                            )}
                            <Button size="sm" variant="ghost" className="rounded-full gap-1.5 text-muted-foreground" disabled={busy} onClick={() => copy(call)}>
                                <Copy className="h-3.5 w-3.5" /> Copy
                            </Button>
                            <Button size="sm" variant="ghost" className="rounded-full gap-1.5 text-muted-foreground" onClick={() => push(`/pitch/${call.id}`)}>
                                <Eye className="h-3.5 w-3.5" /> View
                            </Button>
                            {state !== 'open' && c.total === 0 && (
                                <Button size="sm" variant="ghost" className="rounded-full gap-1.5 text-red-500" disabled={busy} onClick={() => removeCall(call)} aria-label={`Delete ${call.title || 'this pitch call'}`}>
                                    <Trash2 className="h-3.5 w-3.5" /> Delete
                                </Button>
                            )}
                        </div>
                    </div>
                );
            })}
        </div>
    );
};
