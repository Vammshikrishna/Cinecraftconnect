import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { 
  ArrowLeft, Clock, AlertCircle, 
  MessageCircle, 
  User, Shield, Paperclip, ExternalLink
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { motion } from 'framer-motion';

interface SupportTicket {
  id: string;
  subject: string;
  message: string;
  category: string;
  priority: string;
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  created_at: string;
  attachment_url?: string;
  user_id: string;
}

const SupportTicketDetail = () => {
  const { ticketId } = useParams();
  const navigate = useNavigate();
  const [ticket, setTicket] = useState<SupportTicket | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (ticketId) {
      fetchTicket();
    }
  }, [ticketId]);

  const fetchTicket = async () => {
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from('support_tickets')
      .select('*')
      .eq('id', ticketId)
      .single();

    if (!error && data) {
      setTicket(data as SupportTicket);
    }
    setLoading(false);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'resolved': return 'bg-green-500/10 text-green-600 border-green-500/20';
      case 'in_progress': return 'bg-blue-500/10 text-blue-600 border-blue-500/20';
      case 'open': return 'bg-orange-500/10 text-orange-600 border-orange-500/20';
      default: return 'bg-slate-500/10 text-slate-600 border-slate-500/20';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'bg-red-500 text-white';
      case 'high': return 'bg-orange-500 text-white';
      case 'medium': return 'bg-amber-500 text-white';
      default: return 'bg-slate-500 text-white';
    }
  };

  if (loading) return (
    <div className="h-screen w-full flex items-center justify-center">
      <LoadingSpinner size="lg" />
    </div>
  );

  if (!ticket) return (
    <div className="h-screen w-full flex flex-col items-center justify-center space-y-4">
      <AlertCircle className="w-12 h-12 text-muted-foreground/30" />
      <h2 className="text-xl font-bold uppercase tracking-tight">Ticket Not Found</h2>
      <Button onClick={() => navigate('/support')} variant="ghost" className="rounded-xl">
        <ArrowLeft className="w-4 h-4 mr-2" /> Back to Support
      </Button>
    </div>
  );

  return (
    <div className="min-h-screen bg-background pt-20 pb-20">
      <div className="max-w-4xl mx-auto px-4">
        <div className="mb-6">
          <Button 
            onClick={() => navigate('/support')} 
            variant="ghost" 
            size="sm" 
            className="rounded-xl text-muted-foreground hover:text-primary transition-colors pl-0"
          >
            <ArrowLeft className="w-4 h-4 mr-2" /> Back to Support History
          </Button>
        </div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          {/* Header Card */}
          <div className="glass-card p-8 border-border/50 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full -mr-16 -mt-16 blur-3xl" />
            
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative">
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className={`text-[10px] font-black uppercase tracking-widest ${getStatusColor(ticket.status)}`}>
                    {ticket.status.replace('_', ' ')}
                  </Badge>
                  <Badge className={`text-[10px] font-black uppercase tracking-widest ${getPriorityColor(ticket.priority)}`}>
                    {ticket.priority} Priority
                  </Badge>
                </div>
                <h1 className="text-3xl font-black text-foreground uppercase tracking-tight leading-tight">
                  {ticket.subject}
                </h1>
                <div className="flex items-center gap-4 text-xs text-muted-foreground font-medium">
                  <span className="flex items-center gap-1.5 uppercase tracking-wider">
                    <Clock className="w-3.5 h-3.5" />
                    Opened {new Date(ticket.created_at).toLocaleDateString()}
                  </span>
                  <span className="flex items-center gap-1.5 uppercase tracking-wider">
                    <User className="w-3.5 h-3.5" />
                    Ticket ID: <span className="font-mono text-[10px]">{ticket.id.slice(0, 8)}</span>
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Content Section */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <div className="glass-card p-8 border-border/50">
                <h3 className="text-sm font-black uppercase tracking-widest text-muted-foreground mb-6 flex items-center gap-2">
                  <MessageCircle className="w-4 h-4 text-primary" /> Initial Message
                </h3>
                <div className="prose prose-invert max-w-none">
                  <p className="text-foreground leading-relaxed whitespace-pre-wrap font-medium">
                    {ticket.message}
                  </p>
                </div>

                {ticket.attachment_url && (
                  <div className="mt-8 pt-8 border-t border-border/30">
                    <h3 className="text-sm font-black uppercase tracking-widest text-muted-foreground mb-4 flex items-center gap-2">
                      <Paperclip className="w-4 h-4 text-primary" /> Visual Evidence
                    </h3>
                    <div className="relative group max-w-md rounded-2xl overflow-hidden border border-border/50">
                      <img 
                        src={ticket.attachment_url} 
                        alt="Ticket attachment" 
                        className="w-full h-auto object-cover hover:scale-105 transition-transform duration-500" 
                      />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <a 
                          href={ticket.attachment_url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="p-3 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-white hover:bg-white/20 transition-colors"
                        >
                          <ExternalLink className="w-5 h-5" />
                        </a>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Status Update Placeholder */}
              <div className="p-6 bg-muted/30 rounded-2xl border border-dashed border-border/50 flex flex-col items-center justify-center text-center space-y-3">
                <Shield className="w-8 h-8 text-muted-foreground/20" />
                <div>
                  <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Awaiting Staff Review</p>
                  <p className="text-[10px] text-muted-foreground/60 font-medium max-w-xs mt-1">
                    Your request is currently in our verification queue. You will be notified once a moderator is assigned.
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <div className="glass-card p-6 border-border/50">
                <h4 className="text-xs font-black uppercase tracking-widest text-muted-foreground mb-4">Ticket Metadata</h4>
                <div className="space-y-4">
                  <div>
                    <p className="text-[10px] font-black text-muted-foreground uppercase tracking-tighter opacity-50">Category</p>
                    <p className="text-sm font-bold capitalize">{ticket.category.replace('_', ' ')}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-muted-foreground uppercase tracking-tighter opacity-50">Last Update</p>
                    <p className="text-sm font-bold">Just now</p>
                  </div>
                  <Separator className="bg-border/30" />
                  <div className="pt-2">
                    <p className="text-[10px] font-medium text-muted-foreground leading-relaxed italic">
                      Need immediate help? Check our <a href="/documentation" className="text-primary hover:underline font-bold">Documentation</a> for faster solutions.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default SupportTicketDetail;
