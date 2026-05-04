import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { 
  ShieldCheck, ShieldX, User, 
  Clock, AlertCircle, CheckCircle, 
  ArrowRight, Search
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { GovernanceService } from '@/services/governance/GovernanceService';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const ApprovalQueue = () => {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const { user } = useAuth();

  useEffect(() => {
    fetchQueue();
  }, []);

  const fetchQueue = async () => {
    setLoading(true);
    const { data } = await (supabase as any)
      .from('gov_approval_queue')
      .select(`
        *,
        maker:maker_id(username, avatar_url, trust_score)
      `)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });
    
    if (data) setItems(data);
    setLoading(false);
  };

  const handleApprove = async (id: string) => {
    if (!user) return;
    try {
      await GovernanceService.approveAction(id, user.id);
      toast({ title: 'Action Approved', description: 'The staged action has been executed successfully.' });
      fetchQueue();
    } catch (error: any) {
      toast({ 
        title: 'Approval Failed', 
        description: error.message, 
        variant: 'destructive' 
      });
    }
  };

  const handleReject = async (id: string) => {
    const { error } = await (supabase as any)
      .from('gov_approval_queue')
      .update({ status: 'rejected', checker_id: user?.id })
      .eq('id', id);

    if (error) {
      toast({ title: 'Rejection Failed', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Action Rejected', description: 'The staged action has been cancelled.' });
      fetchQueue();
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <ShieldCheck className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h2 className="text-lg font-black text-foreground uppercase tracking-tight">Dual-Control Queue</h2>
            <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-widest">Awaiting Administrative Verification</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <input 
              placeholder="Filter by Maker..." 
              className="h-9 w-48 pl-9 pr-4 bg-muted/50 border border-border/50 rounded-xl text-[11px] font-bold focus:outline-none focus:ring-1 focus:ring-primary/50 transition-all"
            />
          </div>
        </div>
      </div>

      <div className="glass-card border-border/50 overflow-hidden">
        <Table>
          <TableHeader className="bg-muted/30 border-b border-border/50">
            <TableRow>
              <TableHead className="text-[10px] font-black uppercase tracking-widest py-4 pl-6">Staged Date</TableHead>
              <TableHead className="text-[10px] font-black uppercase tracking-widest py-4">Maker</TableHead>
              <TableHead className="text-[10px] font-black uppercase tracking-widest py-4">Action</TableHead>
              <TableHead className="text-[10px] font-black uppercase tracking-widest py-4">Target</TableHead>
              <TableHead className="text-[10px] font-black uppercase tracking-widest py-4">Reason</TableHead>
              <TableHead className="text-[10px] font-black uppercase tracking-widest py-4 pr-6 text-right">Verification</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center">
                  <div className="flex items-center justify-center gap-2">
                    <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                    <span className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Syncing Queue...</span>
                  </div>
                </TableCell>
              </TableRow>
            ) : items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-48 text-center">
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-muted/50 flex items-center justify-center">
                      <CheckCircle className="w-6 h-6 text-muted-foreground/30" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-foreground uppercase tracking-tight">Queue Clear</p>
                      <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-widest">No actions pending verification</p>
                    </div>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              items.map((item) => (
                <TableRow key={item.id} className="group hover:bg-muted/30 transition-colors">
                  <TableCell className="pl-6 py-4">
                    <div className="flex items-center gap-2">
                      <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                      <span className="text-[10px] font-mono text-muted-foreground">
                        {new Date(item.created_at).toLocaleString()}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <User className="w-3.5 h-3.5 text-primary" />
                      <div>
                        <p className="text-[11px] font-bold">@{item.maker?.username}</p>
                        <p className="text-[9px] text-muted-foreground font-bold uppercase tracking-tighter">TRUST: {item.maker?.trust_score || 100}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-[9px] font-black border-primary/20 text-primary uppercase">
                      {item.action.replace(/\./g, ' ')}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1 text-[10px] font-bold text-muted-foreground">
                      <span className="uppercase">{item.target_type}</span>
                      <ArrowRight className="w-3 h-3" />
                      <span className="font-mono">#{item.target_id.slice(0, 8)}</span>
                    </div>
                  </TableCell>
                  <TableCell className="max-w-[200px]">
                    <p className="text-[11px] font-medium text-foreground line-clamp-1 italic">
                      "{item.reason || 'No justification provided'}"
                    </p>
                  </TableCell>
                  <TableCell className="pr-6 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="w-8 h-8 rounded-lg hover:bg-red-500/10 hover:text-red-500 transition-colors"
                        onClick={() => handleReject(item.id)}
                      >
                        <ShieldX className="w-4 h-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="w-8 h-8 rounded-lg hover:bg-green-500/10 hover:text-green-500 transition-colors"
                        onClick={() => handleApprove(item.id)}
                        disabled={item.maker_id === user?.id}
                      >
                        <ShieldCheck className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="glass-card p-4 bg-amber-500/5 border-amber-500/20 rounded-xl flex items-start gap-3">
        <AlertCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
        <p className="text-[10px] text-amber-500/80 font-bold leading-relaxed uppercase tracking-tight">
          <span className="text-amber-500 font-black">Security Protocol:</span> Maker-Checker enforcement is active. You cannot approve your own staged actions. All approvals and rejections are cryptographically logged in the Forensic Audit Ledger.
        </p>
      </div>
    </div>
  );
};

export default ApprovalQueue;
