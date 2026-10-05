import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { format, formatDistanceToNow } from 'date-fns';
import { Loader2, Send, Star, LifeBuoy, CheckCircle2 } from 'lucide-react';
import { TICKET_CATEGORY_LABEL } from '@cinecraft/core';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useSignedStorageUrl } from '@/lib/signedStorageUrl';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { HelpBack, StatusBadge } from '@/components/help/HelpParts';
import { cn } from '@/lib/utils';

const db = supabase as any;

const Attachment = ({ refPath }: { refPath: string }) => {
  const src = useSignedStorageUrl(refPath, ['support']);
  if (!src) return <div className="h-24 w-24 rounded-xl bg-muted animate-pulse" />;
  return (
    <a href={src} target="_blank" rel="noopener noreferrer" className="block h-24 w-24 rounded-xl overflow-hidden border">
      <img src={src} alt="Attachment" className="h-full w-full object-cover" />
    </a>
  );
};

/** One request: the whole conversation, reply, close / reopen, and "how did we do?" once it is resolved. */
const HelpTicketPage = () => {
  const { id = '' } = useParams();
  const { user } = useAuth();
  const { toast } = useToast();
  const [ticket, setTicket] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const [rating, setRating] = useState(0);
  const [ratingNote, setRatingNote] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    const [t, m] = await Promise.all([
      db.from('support_tickets').select('*').eq('id', id).maybeSingle(),
      db.from('support_ticket_messages').select('id, sender_id, content, created_at').eq('ticket_id', id).order('created_at', { ascending: true }),
    ]);
    setTicket(t.data || null);
    setMessages(m.data || []);
    setLoading(false);
  }, [id]);

  useEffect(() => {
    load();
    const ch = supabase.channel(`ticket_${id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'support_ticket_messages', filter: `ticket_id=eq.${id}` }, () => load())
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'support_tickets', filter: `id=eq.${id}` }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [id, load]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages.length]);

  const run = async (fn: string, args: any, ok?: string) => {
    const { error } = await db.rpc(fn, args);
    if (error) toast({ title: 'Could not complete', description: error.message, variant: 'destructive' });
    else if (ok) toast({ title: ok });
    load();
  };

  const send = async () => {
    if (!reply.trim() || !user) return;
    setSending(true);
    const { error } = await db.from('support_ticket_messages').insert({ ticket_id: id, sender_id: user.id, content: reply.trim() });
    setSending(false);
    if (error) return toast({ title: 'Could not send', description: error.message, variant: 'destructive' });
    setReply('');
    load();
  };

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  if (!ticket) {
    return (<><HelpBack to="/settings/help/requests" label="Your requests" /><p className="text-muted-foreground">This request was not found.</p></>);
  }

  const closed = ticket.status === 'closed';
  const done = ticket.status === 'resolved' || closed;
  const attachments: string[] = ticket.attachments?.length ? ticket.attachments : (ticket.attachment_url ? [ticket.attachment_url] : []);

  return (
    <>
      <HelpBack to="/settings/help/requests" label="Your requests" />
      <div className="mb-5">
        <div className="flex items-center gap-2 mb-1.5">
          <StatusBadge status={ticket.status} />
          <span className="text-xs text-muted-foreground">{TICKET_CATEGORY_LABEL[ticket.category] || ticket.category} · #{ticket.id.slice(0, 8)}</span>
        </div>
        <h2 className="text-xl font-bold leading-snug">{ticket.subject}</h2>
        <p className="text-xs text-muted-foreground mt-1">Opened {format(new Date(ticket.created_at), 'd MMM yyyy, h:mm a')}</p>
      </div>

      {!ticket.first_response_at && !done && (
        <div className="rounded-2xl border bg-primary/5 border-primary/20 p-4 mb-5 flex gap-3">
          <LifeBuoy className="h-5 w-5 text-primary shrink-0 mt-0.5" />
          <p className="text-sm">We have your request. We usually reply within 24 hours, and you will get a notification when we do.</p>
        </div>
      )}

      {/* conversation */}
      <div className="space-y-4 mb-6">
        <div className="flex justify-end">
          <div className="max-w-[85%] rounded-2xl rounded-br-md bg-primary text-primary-foreground px-4 py-3">
            <p className="text-[15px] whitespace-pre-wrap break-words">{ticket.message}</p>
            {attachments.length > 0 && <div className="flex gap-2 mt-3 flex-wrap">{attachments.map(a => <Attachment key={a} refPath={a} />)}</div>}
            <p className="text-[11px] opacity-70 mt-1.5">{formatDistanceToNow(new Date(ticket.created_at), { addSuffix: true })}</p>
          </div>
        </div>

        {messages.map(m => {
          const mine = m.sender_id === user?.id;
          return (
            <div key={m.id} className={cn('flex', mine ? 'justify-end' : 'justify-start')}>
              <div className={cn('max-w-[85%] rounded-2xl px-4 py-3', mine ? 'rounded-br-md bg-primary text-primary-foreground' : 'rounded-bl-md bg-muted')}>
                {!mine && <p className="text-[11px] font-semibold text-primary mb-0.5">CineCraft Support</p>}
                <p className="text-[15px] whitespace-pre-wrap break-words">{m.content}</p>
                <p className={cn('text-[11px] mt-1.5', mine ? 'opacity-70' : 'text-muted-foreground')}>{formatDistanceToNow(new Date(m.created_at), { addSuffix: true })}</p>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* rate once it is resolved */}
      {done && (
        <div className="rounded-2xl border bg-card p-5 mb-5">
          {ticket.csat_rating ? (
            <p className="text-sm flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-500" /> You rated this {ticket.csat_rating} out of 5. Thank you.</p>
          ) : (
            <>
              <p className="font-semibold text-[15px] mb-2">How did we do?</p>
              <div className="flex gap-1 mb-3">
                {[1, 2, 3, 4, 5].map(n => (
                  <button key={n} onClick={() => setRating(n)} aria-label={`${n} stars`}>
                    <Star className={cn('h-7 w-7', n <= rating ? 'text-amber-500 fill-amber-500' : 'text-muted-foreground/40')} />
                  </button>
                ))}
              </div>
              {rating > 0 && (
                <div className="space-y-2">
                  <Textarea rows={2} maxLength={500} value={ratingNote} onChange={e => setRatingNote(e.target.value)} placeholder="Anything you want to add? (optional)" className="resize-none" />
                  <Button size="sm" onClick={() => run('rate_support_ticket', { p_id: id, p_rating: rating, p_comment: ratingNote || null }, 'Thanks for your feedback')}>Submit</Button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* reply / actions */}
      {closed ? (
        <div className="rounded-2xl border bg-card p-5 flex items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">This request is closed.</p>
          <Button size="sm" variant="outline" onClick={() => run('reopen_support_ticket', { p_id: id }, 'Request reopened')}>Reopen</Button>
        </div>
      ) : (
        <div className="space-y-3">
          <Textarea rows={3} maxLength={4000} value={reply} onChange={e => setReply(e.target.value)} placeholder={done ? 'Reply to reopen this request…' : 'Write a reply…'} className="resize-none" />
          <div className="flex items-center justify-between gap-3">
            <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={() => run('close_support_ticket', { p_id: id }, 'Request closed')}>Close request</Button>
            <Button onClick={send} disabled={!reply.trim() || sending}><Send className="h-4 w-4 mr-1.5" />{sending ? 'Sending…' : 'Send'}</Button>
          </div>
        </div>
      )}
    </>
  );
};

export default HelpTicketPage;
