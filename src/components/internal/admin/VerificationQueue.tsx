import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, XCircle, ExternalLink, ShieldCheck } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

export default function VerificationQueue() {
  const [requests, setRequests] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    fetchRequests();
  }, []);

  const fetchRequests = async () => {
    try {
      const { data, error } = await supabase
        .from('verification_requests' as any)
        .select(`
          *,
          profiles:user_id ( id, username, full_name, avatar_url )
        `)
        .eq('status', 'pending')
        .order('created_at', { ascending: true });
        
      if (!error && data) {
        setRequests(data);
      } else {
        // Mock data
        setRequests([
          { id: '1', profiles: { id: 'user1', username: 'john_director', full_name: 'John Doe', avatar_url: '' }, portfolio_links: ['https://imdb.com/name/nm123', 'https://vimeo.com/johndoe'], created_at: new Date().toISOString() }
        ]);
      }
    } catch {
      setRequests([
        { id: '1', profiles: { id: 'user1', username: 'john_director', full_name: 'John Doe', avatar_url: '' }, portfolio_links: ['https://imdb.com/name/nm123', 'https://vimeo.com/johndoe'], created_at: new Date().toISOString() }
      ]);
    }
  };

  const handleDecision = async (requestId: string, userId: string, decision: 'approved' | 'rejected') => {
    if (!user) return;
    setIsLoading(true);
    try {
      // 1. Update request status
      await supabase.from('verification_requests' as any).update({ 
        status: decision,
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString()
      }).eq('id', requestId);

      // 2. If approved, update user profile
      if (decision === 'approved') {
        await supabase.from('profiles').update({ is_verified: true }).eq('id', userId);
        toast({ title: "User Verified", description: "The blue tick has been awarded." });
      } else {
        toast({ title: "Request Rejected" });
      }
      
      setRequests(prev => prev.filter(r => r.id !== requestId));
    } catch (error: any) {
      toast({
        title: "Action Failed",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6 bg-card/50 border border-border/50 rounded-2xl p-6">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-xl font-black flex items-center gap-2 mb-2">
            <ShieldCheck className="text-blue-500" /> Verification Queue
          </h2>
          <p className="text-muted-foreground text-sm">
            Review user portfolios to award the Official Verification badge.
          </p>
        </div>
        <Badge variant="secondary" className="font-bold bg-blue-500/10 text-blue-500">{requests.length} Pending</Badge>
      </div>

      <div className="space-y-4 pt-4">
        {requests.length === 0 ? (
          <div className="text-center py-12 border border-dashed border-border rounded-xl">
            <CheckCircle2 className="mx-auto h-8 w-8 text-blue-500 mb-2 opacity-50" />
            <p className="text-muted-foreground font-bold">All Caught Up!</p>
            <p className="text-xs text-muted-foreground">No pending verification requests.</p>
          </div>
        ) : (
          requests.map((req) => (
            <div key={req.id} className="bg-background/80 rounded-xl p-5 border border-white/5 shadow-sm space-y-4">
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-4">
                  <Avatar className="h-12 w-12 border border-border/50">
                    <AvatarImage src={req.profiles.avatar_url || ""} />
                    <AvatarFallback className="bg-primary/10 text-primary font-bold">
                      {req.profiles.username?.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <h4 className="font-bold text-foreground text-lg leading-none mb-1">
                      {req.profiles.full_name}
                    </h4>
                    <p className="text-sm text-muted-foreground font-mono">
                      @{req.profiles.username}
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-black/20 rounded-lg p-3 space-y-2 border border-white/5">
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Submitted Links</p>
                <ul className="space-y-1.5">
                  {req.portfolio_links?.map((link: string, i: number) => (
                    <li key={i}>
                      <a href={link} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-400 hover:text-blue-300 hover:underline flex items-center gap-1.5 w-fit">
                        <ExternalLink size={14} /> {link}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="flex gap-2 pt-2 border-t border-border/30">
                <Button 
                  variant="outline" 
                  size="sm" 
                  disabled={isLoading}
                  onClick={() => handleDecision(req.id, req.profiles.id, 'rejected')}
                  className="flex-1 font-bold text-rose-500 hover:text-rose-400 hover:bg-rose-500/10 border-rose-500/20"
                >
                  <XCircle className="mr-2 h-4 w-4" /> Reject
                </Button>
                <Button 
                  size="sm" 
                  disabled={isLoading}
                  onClick={() => handleDecision(req.id, req.profiles.id, 'approved')}
                  className="flex-1 font-bold bg-blue-600 hover:bg-blue-700 text-white"
                >
                  <CheckCircle2 className="mr-2 h-4 w-4" /> Approve Badge
                </Button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
