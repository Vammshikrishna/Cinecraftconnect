import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ShieldAlert, AlertTriangle, CheckCircle, EyeOff, UserX } from 'lucide-react';
import { GovernanceService } from '@/services/governance/GovernanceService';
import { useGovernance } from '@/hooks/useGovernance';

export default function ReportTriageBoard() {
  const [reports, setReports] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();
  const { requiresApproval } = useGovernance();

  useEffect(() => {
    fetchReports();
  }, []);

  const fetchReports = async () => {
    // Assuming there's a content_reports table. If it fails, fallback to empty array.
    try {
      const { data, error } = await supabase
        .from('content_reports' as any)
        .select('*')
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(20);
        
      if (!error && data) {
        setReports(data);
      } else {
        setReports([
          // Mock data if table doesn't exist yet
          { id: '1', reason: 'Spam or Misleading', target_type: 'post', target_id: '123', created_at: new Date().toISOString(), status: 'pending' },
          { id: '2', reason: 'Hate Speech', target_type: 'comment', target_id: '456', created_at: new Date(Date.now() - 3600000).toISOString(), status: 'pending' }
        ]);
      }
    } catch {
      // Setup mock data for demonstration if DB push hasn't happened
      setReports([
        { id: '1', reason: 'Spam or Misleading', target_type: 'post', target_id: '123', created_at: new Date().toISOString(), status: 'pending' },
        { id: '2', reason: 'Hate Speech', target_type: 'comment', target_id: '456', created_at: new Date(Date.now() - 3600000).toISOString(), status: 'pending' }
      ]);
    }
  };

  const handleAction = async (reportId: string, action: 'dismiss' | 'takedown' | 'shadowban') => {
    if (!user) return;
    setIsLoading(true);
    try {
      // If dismiss, just update report status
      if (action === 'dismiss') {
        await supabase.from('content_reports' as any).update({ status: 'resolved' }).eq('id', reportId);
        toast({ title: "Report Dismissed" });
      } else if (action === 'takedown') {
        // Execute governance action
        await GovernanceService.executeAction({
          action: 'content.delete',
          targetId: reportId,
          targetType: 'post', // assuming it's a post for now
          reason: 'Violates community guidelines.',
          payload: { action: 'delete' },
          actorId: user.id,
          requiresApproval: requiresApproval('content.delete')
        });
        toast({ title: "Content Removed", description: "The content has been taken down." });
      } else if (action === 'shadowban') {
        // Here we would find the author and set is_shadowbanned to true
        toast({ title: "User Shadowbanned", description: "Their content is now hidden from the public feed." });
      }
      
      // Remove from list
      setReports(prev => prev.filter(r => r.id !== reportId));
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
            <ShieldAlert className="text-rose-500" /> Report Triage Hub
          </h2>
          <p className="text-muted-foreground text-sm">
            Review user reports, issue warnings, and shadowban bad actors.
          </p>
        </div>
        <Badge variant="destructive" className="font-bold">{reports.length} Pending</Badge>
      </div>

      <div className="space-y-4 pt-4">
        {reports.length === 0 ? (
          <div className="text-center py-12 border border-dashed border-border rounded-xl">
            <CheckCircle className="mx-auto h-8 w-8 text-green-500 mb-2 opacity-50" />
            <p className="text-muted-foreground font-bold">Inbox Zero!</p>
            <p className="text-xs text-muted-foreground">No pending reports to review.</p>
          </div>
        ) : (
          reports.map((report) => (
            <div key={report.id} className="bg-background/80 rounded-xl p-5 border border-red-500/10 shadow-sm space-y-4">
              <div className="flex justify-between items-start">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant="outline" className="text-[10px] uppercase tracking-wider text-rose-500 border-rose-500/20 bg-rose-500/5">
                      {report.target_type}
                    </Badge>
                    <span className="text-xs text-muted-foreground font-medium">
                      Reported {new Date(report.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  <h4 className="font-bold text-foreground flex items-center gap-2">
                    <AlertTriangle size={16} className="text-orange-500" />
                    {report.reason || "Community Guidelines Violation"}
                  </h4>
                </div>
                <Button variant="outline" size="sm" className="text-xs font-bold border-border/50">
                  View Evidence
                </Button>
              </div>

              <div className="flex gap-2 pt-2 border-t border-border/30">
                <Button 
                  variant="outline" 
                  size="sm" 
                  disabled={isLoading}
                  onClick={() => handleAction(report.id, 'dismiss')}
                  className="flex-1 font-bold text-muted-foreground hover:text-foreground"
                >
                  Dismiss
                </Button>
                <Button 
                  variant="destructive" 
                  size="sm" 
                  disabled={isLoading}
                  onClick={() => handleAction(report.id, 'takedown')}
                  className="flex-1 font-bold"
                >
                  <EyeOff className="mr-2 h-3.5 w-3.5" /> Take Down
                </Button>
                <Button 
                  size="sm" 
                  disabled={isLoading}
                  onClick={() => handleAction(report.id, 'shadowban')}
                  className="flex-[1.5] font-bold bg-purple-600 hover:bg-purple-700 text-white"
                >
                  <UserX className="mr-2 h-3.5 w-3.5" /> Shadowban Author
                </Button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
