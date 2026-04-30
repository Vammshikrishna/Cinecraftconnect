
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { 
  MessageSquare, 
  User, 
  Clock, 
  CheckCircle2, 
  ChevronRight, 
  Search, 
  Filter, 
  Reply, 
  ShieldCheck
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
  DialogTitle, 
  DialogTrigger
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';

interface Ticket {
  id: string;
  subject: string;
  message: string;
  category: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  created_at: string;
  profiles: {
    username: string;
    full_name: string;
    avatar_url: string;
  };
}

export const SupportTicketManager = () => {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [replyMessage, setReplyMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchTickets();
  }, []);

  const fetchTickets = async () => {
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from('support_tickets')
      .select('*, profiles:user_id(username, full_name, avatar_url)')
      .order('created_at', { ascending: false });

    if (!error && data) {
      setTickets(data as any);
    }
    setLoading(false);
  };

  const updateTicketStatus = async (ticketId: string, status: string) => {
    const { error } = await (supabase as any)
      .from('support_tickets')
      .update({ status })
      .eq('id', ticketId);

    if (error) {
      toast({ title: "Error", description: "Failed to update ticket status", variant: "destructive" });
    } else {
      toast({ title: "Updated", description: `Ticket marked as ${status}` });
      fetchTickets();
      if (selectedTicket?.id === ticketId) {
        setSelectedTicket({ ...selectedTicket, status: status as any });
      }
    }
  };

  const handleSendReply = async () => {
    if (!selectedTicket || !replyMessage.trim()) return;

    setIsSending(true);
    const { error } = await (supabase as any)
      .from('support_ticket_messages')
      .insert({
        ticket_id: selectedTicket.id,
        sender_id: (await supabase.auth.getUser()).data.user?.id,
        content: replyMessage,
        is_internal: false
      });

    if (error) {
      toast({ title: "Error", description: "Failed to send reply", variant: "destructive" });
    } else {
      toast({ title: "Reply Sent", description: "The user has been notified." });
      setReplyMessage('');
      // Auto-update status to in_progress if it was open
      if (selectedTicket.status === 'open') {
        updateTicketStatus(selectedTicket.id, 'in_progress');
      }
    }
    setIsSending(false);
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

  const filteredTickets = tickets.filter(t => 
    t.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.profiles.username.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input 
            placeholder="Search tickets, users, or keywords..." 
            className="pl-10 h-11 rounded-xl bg-muted/20 border-border/50 focus-visible:ring-primary/20"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" className="rounded-xl gap-2 text-xs font-bold uppercase tracking-widest h-11 border-border/50">
            <Filter className="w-4 h-4" /> Filter
          </Button>
          <Button onClick={fetchTickets} variant="ghost" className="rounded-xl h-11 w-11 p-0 hover:bg-muted/50">
            <Clock className="w-4 h-4" />
          </Button>
        </div>
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
              className="group p-5 glass-card border-border/50 hover:border-primary/30 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4"
            >
              <div className="flex items-start gap-4">
                <Avatar className="h-10 w-10 border border-border/50">
                  <AvatarImage src={ticket.profiles.avatar_url} />
                  <AvatarFallback className="bg-primary/10 text-primary font-black uppercase text-xs">
                    {ticket.profiles.username.slice(0, 2)}
                  </AvatarFallback>
                </Avatar>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h4 className="font-bold text-foreground truncate max-w-[200px] md:max-w-md">{ticket.subject}</h4>
                    <Badge variant="outline" className={`text-[9px] font-black uppercase tracking-widest ${getPriorityColor(ticket.priority)}`}>
                      {ticket.priority}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-3 text-[10px] text-muted-foreground font-medium uppercase tracking-widest">
                    <span className="flex items-center gap-1"><User className="w-3 h-3" /> @{ticket.profiles.username}</span>
                    <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {new Date(ticket.created_at).toLocaleDateString()}</span>
                    <span className="bg-muted px-2 py-0.5 rounded-full">{ticket.category}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                {getStatusBadge(ticket.status)}
                <Dialog>
                  <DialogTrigger asChild>
                    <Button 
                      onClick={() => setSelectedTicket(ticket)}
                      variant="ghost" 
                      className="rounded-xl gap-2 text-xs font-bold hover:bg-primary/5 hover:text-primary transition-all"
                    >
                      Manage <ChevronRight className="w-4 h-4" />
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-[600px] rounded-3xl p-0 overflow-hidden border-border/20 shadow-2xl">
                    <div className="bg-primary/5 p-6 border-b border-border/20 flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="p-3 bg-primary/10 rounded-2xl">
                          <ShieldCheck className="w-6 h-6 text-primary" />
                        </div>
                        <div>
                          <DialogTitle className="text-xl font-black uppercase tracking-tight">Ticket Resolution</DialogTitle>
                          <DialogDescription className="text-[10px] font-bold text-primary/70 uppercase tracking-widest">
                            {ticket.id.slice(0, 8)} • Official Record
                          </DialogDescription>
                        </div>
                      </div>
                      {getStatusBadge(ticket.status)}
                    </div>
                    
                    <div className="p-6 space-y-6">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Avatar className="h-6 w-6">
                            <AvatarImage src={ticket.profiles.avatar_url} />
                            <AvatarFallback>{ticket.profiles.username[0]}</AvatarFallback>
                          </Avatar>
                          <span className="text-xs font-black">@{ticket.profiles.username}</span>
                        </div>
                        <div className="p-4 bg-muted/20 rounded-2xl border border-border/50">
                          <p className="text-sm leading-relaxed">{ticket.message}</p>
                        </div>
                      </div>

                      <div className="space-y-3">
                        <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Staff Reply</label>
                        <Textarea 
                          placeholder="Type your response to the user..." 
                          className="rounded-2xl min-h-[120px] bg-card border-border/50 focus-visible:ring-primary/20"
                          value={replyMessage}
                          onChange={(e) => setReplyMessage(e.target.value)}
                        />
                      </div>
                    </div>

                    <div className="bg-muted/10 p-6 flex items-center justify-between">
                      <div className="flex gap-2">
                        <Button 
                          onClick={() => updateTicketStatus(ticket.id, 'resolved')}
                          variant="outline" 
                          className="rounded-xl border-emerald-500/20 text-emerald-500 hover:bg-emerald-500/5 font-bold text-xs"
                        >
                          <CheckCircle2 className="w-4 h-4 mr-2" /> Mark Resolved
                        </Button>
                        <Button 
                          onClick={() => updateTicketStatus(ticket.id, 'closed')}
                          variant="ghost" 
                          className="rounded-xl text-muted-foreground hover:text-foreground font-bold text-xs"
                        >
                          Close Ticket
                        </Button>
                      </div>
                      <Button 
                        onClick={handleSendReply}
                        disabled={isSending || !replyMessage.trim()}
                        className="rounded-xl px-8 font-black uppercase tracking-widest text-xs bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20"
                      >
                        {isSending ? 'Sending...' : 'Send Reply'}
                        {!isSending && <Reply className="w-4 h-4 ml-2" />}
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </motion.div>
          ))
        )}
      </div>
    </div>
  );
};
