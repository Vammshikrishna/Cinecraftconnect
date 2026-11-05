
import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  MessageSquare,
  User,
  Clock,
  CheckCircle2,
  ChevronRight,
  Search,
  Reply,
  ShieldCheck,
  RotateCcw,
  Lock,
  UserCheck
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { motion } from 'framer-motion';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/contexts/AuthContext';
import { friendlyError } from '@cinecraft/core';
import { safeUsername, safeInitials, humanStatus } from '../shared/staffHelpers';
import SavedViewsBar from '../shared/SavedViewsBar';
import {
  DEFAULT_TICKET_FILTER, LEVEL_LABEL, applyMacro, filterTickets, firstReplyMinutes, formatDuration, isMissingDbObject,
  readTicketFilter, sameFilter, slaLabel, summariseDesk, ticketSla,
  type TicketFilter, type SlaState,
} from '../shared/deskLogic';

interface Ticket {
  id: string;
  subject: string;
  message: string;
  category: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  created_at: string;
  assigned_to?: string | null;
  first_response_at?: string | null;
  /** null when the author's account was deleted */
  profiles?: {
    username: string;
    full_name: string;
    avatar_url: string;
  } | null;
}

interface TicketMessage { id: string; sender_id: string | null; content: string; created_at: string; is_internal?: boolean | null }
interface StaffPerson { id: string; username: string | null; full_name: string | null; level: number }
interface Macro { id: string; title: string; body: string }

const selectCls = 'h-9 rounded-xl border border-border/60 bg-muted/20 px-3 text-xs font-bold focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary';

const slaTone: Record<SlaState, string> = {
  overdue: 'bg-red-500/10 text-red-500 border-red-500/30',
  soon: 'bg-amber-500/10 text-amber-600 border-amber-500/30',
  ok: 'bg-muted text-muted-foreground border-border/50',
  met: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30',
  late: 'bg-orange-500/10 text-orange-600 border-orange-500/30',
  none: 'bg-muted text-muted-foreground border-border/50',
};

export const SupportTicketManager = () => {
  const { user } = useAuth();
  const me = user?.id ?? null;
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<TicketFilter>(DEFAULT_TICKET_FILTER);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [replyMessage, setReplyMessage] = useState('');
  const [internalNote, setInternalNote] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [history, setHistory] = useState<TicketMessage[]>([]);
  const [staff, setStaff] = useState<StaffPerson[]>([]);
  const [staffMissing, setStaffMissing] = useState(false);
  const [macros, setMacros] = useState<Macro[]>([]);
  const [now, setNow] = useState(() => Date.now());
  const { toast } = useToast();

  const selectedTicket = useMemo(() => tickets.find((t) => t.id === selectedId) || null, [tickets, selectedId]);

  const fetchTickets = useCallback(async () => {
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from('support_tickets')
      .select('*, profiles:user_id(username, full_name, avatar_url)')
      .order('created_at', { ascending: false });

    if (!error && data) {
      setTickets(data as any);
    }
    setNow(Date.now());
    setLoading(false);
  }, []);

  useEffect(() => { void fetchTickets(); }, [fetchTickets]);

  // keep the SLA chips honest while the page stays open
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);

  // who a ticket can be given to, and the ready-made replies
  useEffect(() => {
    let alive = true;
    (async () => {
      const { data, error } = await (supabase as any).rpc('staff_desk_staff');
      if (!alive) return;
      if (error) { setStaffMissing(isMissingDbObject(error)); return; }
      setStaff((data || []) as StaffPerson[]);
    })();
    (async () => {
      const { data } = await (supabase as any).from('mod_templates').select('id, title, body').eq('kind', 'reply').order('title');
      if (alive) setMacros((data || []) as Macro[]);
    })();
    return () => { alive = false; };
  }, []);

  // earlier replies for the ticket that is open in the dialog
  useEffect(() => {
    if (!selectedId) { setHistory([]); return; }
    let cancelled = false;
    (supabase as any)
      .from('support_ticket_messages')
      .select('id, sender_id, content, created_at, is_internal')
      .eq('ticket_id', selectedId)
      .order('created_at', { ascending: true })
      .then(({ data }: any) => { if (!cancelled) setHistory(data || []); });
    return () => { cancelled = true; };
  }, [selectedId]);

  const staffName = useCallback((id?: string | null) => {
    if (!id) return null;
    const s = staff.find((x) => x.id === id);
    return s ? `@${s.username || s.full_name || id.slice(0, 6)}` : (id === me ? 'you' : 'a staff member');
  }, [staff, me]);

  const updateTicketStatus = async (ticketId: string, status: string, quiet = false) => {
    const { error } = await (supabase as any)
      .from('support_tickets')
      .update({ status })
      .eq('id', ticketId);

    if (error) {
      toast({ title: "Error", description: "Failed to update ticket status", variant: "destructive" });
    } else {
      if (!quiet) toast({ title: "Updated", description: `Ticket marked as ${humanStatus(status)}` });
      void fetchTickets();
    }
  };

  const assign = async (ticketId: string, assignee: string | null) => {
    const { error } = await (supabase as any).rpc('support_assign_ticket', { p_ticket: ticketId, p_assignee: assignee });
    if (error) {
      if (isMissingDbObject(error)) setStaffMissing(true);
      toast({ title: 'Could not assign the ticket', description: friendlyError(error), variant: 'destructive' });
      return;
    }
    toast({ title: assignee ? (assignee === me ? 'Ticket is yours' : 'Ticket assigned') : 'Ticket is unassigned' });
    void fetchTickets();
  };

  const handleSendReply = async () => {
    if (!selectedTicket || !replyMessage.trim()) return;

    setIsSending(true);
    const internal = internalNote;
    const { error } = await (supabase as any)
      .from('support_ticket_messages')
      .insert({
        ticket_id: selectedTicket.id,
        sender_id: (await supabase.auth.getUser()).data.user?.id,
        content: replyMessage,
        is_internal: internal
      });

    if (error) {
      toast({ title: "Error", description: internal ? "Failed to save the note" : "Failed to send reply", variant: "destructive" });
    } else {
      toast(internal
        ? { title: 'Note saved', description: 'Only staff can see it.' }
        : { title: "Reply Sent", description: "The user has been notified." });
      setReplyMessage('');
      setHistory((h) => [...h, { id: `local-${Date.now()}`, sender_id: null, content: replyMessage, created_at: new Date().toISOString(), is_internal: internal }]);
      // the database moves an open ticket to "in progress" and records the first reply time; reload to show both
      void fetchTickets();
    }
    setIsSending(false);
  };

  const insertMacro = (id: string) => {
    const m = macros.find((x) => x.id === id);
    if (!m || !selectedTicket) return;
    const text = applyMacro(m.body, { name: selectedTicket.profiles?.full_name?.split(' ')[0] || selectedTicket.profiles?.username || null });
    setReplyMessage((cur) => (cur.trim() ? `${cur.trimEnd()}\n\n${text}` : text));
    setInternalNote(false);
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'bg-red-500/10 text-red-500 border-red-500/20';
      case 'high': return 'bg-orange-500/10 text-orange-500 border-orange-500/20';
      case 'medium': return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
      default: return 'bg-slate-500/10 text-slate-500 border-slate-500/20';
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'resolved': return <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20">Resolved</Badge>;
      case 'in_progress': return <Badge className="bg-blue-500/10 text-blue-500 border-blue-500/20">In Progress</Badge>;
      case 'open': return <Badge className="bg-orange-500/10 text-orange-500 border-orange-500/20">Open</Badge>;
      default: return <Badge variant="outline">Closed</Badge>;
    }
  };

  const filteredTickets = useMemo(() => filterTickets(tickets, filter, me, now), [tickets, filter, me, now]);
  const summary = useMemo(() => summariseDesk(tickets, now), [tickets, now]);
  const set = (patch: Partial<TicketFilter>) => setFilter((f) => ({ ...f, ...patch }));

  const slaChip = (t: Ticket) => {
    const s = ticketSla(t, now);
    if (s.state === 'none') return null;
    return <span data-testid="sla-chip" data-sla={s.state} className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[12px] font-bold ${slaTone[s.state]}`}>{slaLabel(s)}</span>;
  };

  const sel = selectedTicket;
  const selFirstReply = sel ? firstReplyMinutes(sel) : null;

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
      <section aria-label="Support desk numbers" className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: 'Open tickets', value: String(summary.open), hot: false },
          { label: 'Overdue first reply', value: String(summary.overdue), hot: summary.overdue > 0 },
          { label: 'Due within the hour or so', value: String(summary.soon), hot: false },
          { label: 'Nobody assigned', value: String(summary.unassigned), hot: summary.unassigned > 0 },
          { label: 'Median first reply', value: summary.medianFirstReplyMin === null ? 'n/a' : formatDuration(summary.medianFirstReplyMin * 60_000), hot: false },
        ].map((c) => (
          <div key={c.label} className={`rounded-2xl border p-4 ${c.hot ? 'border-red-500/40 bg-red-500/5' : 'border-border/50 bg-card/60'}`}>
            <p className="text-xl font-black tabular-nums">{c.value}</p>
            <p className="text-[12px] text-muted-foreground font-bold">{c.label}</p>
          </div>
        ))}
      </section>

      <div className="flex flex-col gap-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search tickets, users, or keywords..."
              className="pl-10 h-11 rounded-xl bg-muted/20 border-border/50 focus-visible:ring-primary/20"
              value={filter.query}
              onChange={(e) => set({ query: e.target.value })}
            />
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={fetchTickets} aria-label="Refresh tickets" title="Refresh tickets" variant="ghost" className="rounded-xl h-11 w-11 p-0 hover:bg-muted/50">
              <Clock className="w-4 h-4" />
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filter tickets">
          <select aria-label="Filter by status" className={selectCls} value={filter.status} onChange={(e) => set({ status: e.target.value as TicketFilter['status'] })}>
            <option value="all">Any status</option>
            <option value="active">Open and in progress</option>
            <option value="open">Open</option>
            <option value="in_progress">In progress</option>
            <option value="resolved">Resolved</option>
            <option value="closed">Closed</option>
          </select>
          <select aria-label="Filter by priority" className={selectCls} value={filter.priority} onChange={(e) => set({ priority: e.target.value as TicketFilter['priority'] })}>
            <option value="all">Any priority</option>
            <option value="urgent">Urgent</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
          <select aria-label="Filter by owner" className={selectCls} value={filter.assignee} onChange={(e) => set({ assignee: e.target.value })}>
            <option value="all">Any owner</option>
            <option value="mine">Mine</option>
            <option value="unassigned">Nobody assigned</option>
            {staff.filter((s) => s.id !== me).map((s) => <option key={s.id} value={s.id}>@{s.username || s.full_name}</option>)}
          </select>
          <label className="inline-flex items-center gap-2 text-xs font-bold h-9 px-3 rounded-xl border border-border/60 bg-muted/20 cursor-pointer">
            <input type="checkbox" checked={filter.overdueOnly} onChange={(e) => set({ overdueOnly: e.target.checked })} />
            Overdue only
          </label>
          {!sameFilter(filter, DEFAULT_TICKET_FILTER) && (
            <Button variant="ghost" size="sm" className="h-9 rounded-xl text-xs font-bold" onClick={() => setFilter(DEFAULT_TICKET_FILTER)}>Clear filters</Button>
          )}
        </div>
        <SavedViewsBar scope="admin.tickets" current={filter} isDefault={sameFilter(filter, DEFAULT_TICKET_FILTER)} onApply={(f) => setFilter(readTicketFilter(f))} />
      </div>

      <div className="grid grid-cols-1 gap-4">
        {loading ? (
          [1,2,3,4].map(i => <div key={i} className="h-24 w-full bg-muted/10 animate-pulse rounded-2xl border border-border/30" />)
        ) : filteredTickets.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center glass-card border-dashed">
            <MessageSquare className="w-12 h-12 text-muted-foreground/30 mb-4" />
            <p className="text-muted-foreground font-medium">No tickets found in the queue.</p>
          </div>
        ) : (
          filteredTickets.map((ticket) => (
            <motion.div
              key={ticket.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="group p-5 glass-card border-border/50 hover:border-primary/30 transition flex flex-col md:flex-row md:items-center justify-between gap-4"
            >
              <div className="flex items-start gap-4">
                <Avatar className="h-10 w-10 border border-border/50">
                  <AvatarImage src={ticket.profiles?.avatar_url} />
                  <AvatarFallback className="bg-primary/10 text-primary font-black uppercase text-xs">
                    {safeInitials(ticket.profiles)}
                  </AvatarFallback>
                </Avatar>
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="font-bold text-foreground truncate max-w-[200px] md:max-w-md">{ticket.subject}</h4>
                    <Badge variant="outline" className={`text-[12px] font-black uppercase tracking-widest ${getPriorityColor(ticket.priority)}`}>
                      {ticket.priority}
                    </Badge>
                    {(ticket.status === 'open' || ticket.status === 'in_progress' || ticket.first_response_at) && slaChip(ticket)}
                  </div>
                  <div className="flex items-center gap-3 flex-wrap text-[12px] text-muted-foreground font-medium uppercase tracking-widest">
                    <span className="flex items-center gap-1"><User className="w-3 h-3" /> @{safeUsername(ticket.profiles, 'deleted user')}</span>
                    <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {new Date(ticket.created_at).toLocaleDateString()}</span>
                    <span className="bg-muted px-2 py-0.5 rounded-full">{ticket.category}</span>
                    <span className="flex items-center gap-1" data-testid="ticket-owner"><UserCheck className="w-3 h-3" /> {ticket.assigned_to ? `Owner ${staffName(ticket.assigned_to)}` : 'Nobody assigned'}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                {getStatusBadge(ticket.status)}
                <Button
                  onClick={() => { setSelectedId(ticket.id); setReplyMessage(''); setInternalNote(false); }}
                  variant="ghost"
                  className="rounded-xl gap-2 text-xs font-bold hover:bg-primary/5 hover:text-primary transition"
                >
                  Manage <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </motion.div>
          ))
        )}
      </div>

      <Dialog open={!!sel} onOpenChange={(o) => { if (!o) setSelectedId(null); }}>
        <DialogContent className="sm:max-w-[640px] max-h-[90vh] overflow-y-auto rounded-3xl p-0 border-border/20 shadow-2xl">
          {sel && (
            <>
              <div className="bg-primary/5 p-6 border-b border-border/20 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-primary/10 rounded-2xl">
                    <ShieldCheck className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <DialogTitle className="text-xl font-black uppercase tracking-tight">Ticket Resolution</DialogTitle>
                    <DialogDescription className="text-[12px] font-bold text-primary/70 uppercase tracking-widest">
                      {sel.id.slice(0, 8)} • Official Record
                    </DialogDescription>
                  </div>
                </div>
                {getStatusBadge(sel.status)}
              </div>

              <div className="p-6 space-y-6">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  {slaChip(sel)}
                  <span className="rounded-full border border-border/50 bg-muted/30 px-2 py-0.5 text-[12px] font-bold" data-testid="first-reply-time">
                    {selFirstReply === null ? 'No staff reply yet' : `First reply after ${formatDuration(selFirstReply * 60_000)}`}
                  </span>
                </div>

                <div className="space-y-2">
                  <label htmlFor="ticket-assignee" className="text-[12px] font-black uppercase tracking-widest text-muted-foreground ml-1">Owner</label>
                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      id="ticket-assignee"
                      className={`${selectCls} min-w-[200px]`}
                      value={sel.assigned_to || ''}
                      disabled={staffMissing || sel.status === 'resolved' || sel.status === 'closed'}
                      onChange={(e) => void assign(sel.id, e.target.value || null)}
                    >
                      <option value="">Nobody assigned</option>
                      {staff.map((s) => <option key={s.id} value={s.id}>@{s.username || s.full_name} ({LEVEL_LABEL[s.level] || 'Staff'}){s.id === me ? ' - you' : ''}</option>)}
                    </select>
                    {me && sel.assigned_to !== me && !staffMissing && sel.status !== 'resolved' && sel.status !== 'closed' && (
                      <Button size="sm" variant="outline" className="h-9 rounded-xl text-xs font-bold" onClick={() => void assign(sel.id, me)}>Take it</Button>
                    )}
                  </div>
                  {staffMissing && (
                    <p className="text-[12px] text-muted-foreground" role="note">Giving tickets to people is not switched on yet. Run <span className="font-mono">supabase/manual/part_gb_admin_support_desk.sql</span>.</p>
                  )}
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Avatar className="h-6 w-6">
                      <AvatarImage src={sel.profiles?.avatar_url} />
                      <AvatarFallback>{safeInitials(sel.profiles).slice(0, 1)}</AvatarFallback>
                    </Avatar>
                    <span className="text-xs font-black">@{safeUsername(sel.profiles, 'deleted user')}</span>
                  </div>
                  <div className="p-4 bg-muted/20 rounded-2xl border border-border/50">
                    <p className="text-sm leading-relaxed">{sel.message}</p>
                  </div>
                  {history.length > 0 && (
                    <div className="space-y-2 max-h-56 overflow-y-auto" aria-label="Earlier messages">
                      {history.map((m) => (
                        <div key={m.id} className={`p-3 rounded-xl border ${m.is_internal ? 'bg-amber-500/5 border-amber-500/30' : 'bg-card border-border/50'}`} data-internal={m.is_internal ? 'true' : 'false'}>
                          <p className="text-[12px] text-muted-foreground uppercase tracking-widest mb-1 flex items-center gap-1">
                            {m.is_internal && <Lock className="w-3 h-3" aria-hidden="true" />}
                            {m.is_internal ? 'Internal note (staff only)' : 'Message'} - {new Date(m.created_at).toLocaleString()}
                          </p>
                          <p className="text-sm leading-relaxed whitespace-pre-wrap">{m.content}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <label htmlFor="ticket-staff-reply" className="text-[12px] font-black uppercase tracking-widest text-muted-foreground ml-1">{internalNote ? 'Internal note' : 'Staff Reply'}</label>
                    {macros.length > 0 && (
                      <select aria-label="Insert a ready-made reply" className={selectCls} value="" onChange={(e) => { if (e.target.value) insertMacro(e.target.value); }}>
                        <option value="">Insert a ready-made reply…</option>
                        {macros.map((m) => <option key={m.id} value={m.id}>{m.title}</option>)}
                      </select>
                    )}
                  </div>
                  <Textarea
                    id="ticket-staff-reply"
                    placeholder={internalNote ? 'A note for the team. The person does not see this.' : 'Type your response to the user...'}
                    className={`rounded-2xl min-h-[120px] bg-card focus-visible:ring-primary/20 ${internalNote ? 'border-amber-500/40' : 'border-border/50'}`}
                    value={replyMessage}
                    onChange={(e) => setReplyMessage(e.target.value)}
                  />
                  <label className="inline-flex items-center gap-2 text-xs font-bold cursor-pointer">
                    <input type="checkbox" checked={internalNote} onChange={(e) => setInternalNote(e.target.checked)} />
                    <Lock className="w-3 h-3" aria-hidden="true" /> Staff-only note (the person is not told and cannot see it)
                  </label>
                </div>
              </div>

              <div className="bg-muted/10 p-6 flex flex-wrap items-center justify-between gap-3">
                <div className="flex gap-2">
                  {sel.status === 'resolved' || sel.status === 'closed' ? (
                    <Button
                      onClick={() => updateTicketStatus(sel.id, 'open')}
                      variant="outline"
                      className="rounded-xl font-bold text-xs"
                    >
                      <RotateCcw className="w-4 h-4 mr-2" /> Reopen
                    </Button>
                  ) : (
                    <>
                      <Button
                        onClick={() => updateTicketStatus(sel.id, 'resolved')}
                        variant="outline"
                        className="rounded-xl border-emerald-500/20 text-emerald-500 hover:bg-emerald-500/5 font-bold text-xs"
                      >
                        <CheckCircle2 className="w-4 h-4 mr-2" /> Mark Resolved
                      </Button>
                      <Button
                        onClick={() => updateTicketStatus(sel.id, 'closed')}
                        variant="ghost"
                        className="rounded-xl text-muted-foreground hover:text-foreground font-bold text-xs"
                      >
                        Close Ticket
                      </Button>
                    </>
                  )}
                </div>
                <Button
                  onClick={handleSendReply}
                  disabled={isSending || !replyMessage.trim()}
                  className="rounded-xl px-8 font-black uppercase tracking-widest text-xs bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20"
                >
                  {isSending ? 'Sending...' : internalNote ? 'Save Note' : 'Send Reply'}
                  {!isSending && <Reply className="w-4 h-4 ml-2" />}
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};
