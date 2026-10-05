import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import InternalHeader from '@/components/internal/shared/InternalHeader';
import StaffRoleMatrix from '@/components/internal/super-admin/StaffRoleMatrix';
import AuditLedger from '@/components/internal/admin/AuditLedger';
import ApprovalQueue from '@/components/internal/admin/ApprovalQueue';
import VIPInviteManager from '@/components/internal/admin/VIPInviteManager';
import GlobalBroadcastPanel from '@/components/internal/super-admin/GlobalBroadcastPanel';
import { GovernanceService } from '@/services/governance/GovernanceService';
import { useAuth } from '@/contexts/AuthContext';
import { useGovernance } from '@/hooks/useGovernance';
import { 
  Crown, Shield, Zap, Lock, 
  Database, Globe, AlertTriangle,
  FileText, Users,
  ToggleLeft, RefreshCw, Key,
  ShieldAlert, HardDrive, Cpu, Network,
  ShieldCheck
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

const SuperAdminDashboard = () => {
  const [staff, setStaff] = useState<any[]>([]);
  const [flags, setFlags] = useState<any[]>([]);
  const [policies, setPolicies] = useState<any[]>([]);
  const [selectedPolicy, setSelectedPolicy] = useState<any>(null);
  const [isPolicyModalOpen, setIsPolicyModalOpen] = useState(false);
  const [fraudLogs, setFraudLogs] = useState<any[]>([]);
  const [riskStats, setRiskStats] = useState({
    low: { label: 'Low Risk Users', count: 0, percent: '0%', color: 'bg-emerald-500' },
    medium: { label: 'Suspicious Active', count: 0, percent: '0%', color: 'bg-amber-500' },
    high: { label: 'High Risk / Bot', count: 0, percent: '0%', color: 'bg-red-500' },
  });
  const { toast } = useToast();
  const { user } = useAuth();
  const { hasPermission, requiresApproval } = useGovernance();

  useEffect(() => {
    fetchStaff();
    fetchFlags();
    fetchPolicies();
    fetchRiskData();

    // Subscribe to real-time changes
    const channel = supabase
      .channel('super-admin-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'platform_flags' },
        () => fetchFlags()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'platform_policies' },
        () => fetchPolicies()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'user_roles' },
        () => fetchStaff()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchRiskData = async () => {
    const { data: logs } = await (supabase as any)
      .from('audit_logs')
      .select('*')
      .ilike('action', '%FRAUD%')
      .order('created_at', { ascending: false })
      .limit(3);
    if (logs) setFraudLogs(logs);

    const { data: profiles } = await (supabase as any).from('profiles').select('trust_score');
    if (profiles && profiles.length > 0) {
      let low = 0, medium = 0, high = 0;
      profiles.forEach((p: any) => {
        const score = p.trust_score || 50; 
        if (score >= 70) low++;
        else if (score >= 40) medium++;
        else high++;
      });
      const total = profiles.length;
      setRiskStats({
        low: { label: 'Low Risk Users', count: low, percent: ((low / total) * 100).toFixed(1) + '%', color: 'bg-emerald-500' },
        medium: { label: 'Suspicious Active', count: medium, percent: ((medium / total) * 100).toFixed(1) + '%', color: 'bg-amber-500' },
        high: { label: 'High Risk / Bot', count: high, percent: ((high / total) * 100).toFixed(1) + '%', color: 'bg-red-500' },
      });
    }
  };

  const fetchStaff = async () => {
    const { data } = await (supabase as any)
      .from('user_roles')
      .select(`user_id, role, profile:user_id(id, username, full_name, avatar_url)`)
      .neq('role', 'user');
    if (data) {
      setStaff(data.map((r: any) => ({
        id: r.profile?.id || r.user_id,
        username: r.profile?.username || 'no_username',
        full_name: r.profile?.full_name || 'Incomplete Profile',
        avatar_url: r.profile?.avatar_url,
        role: r.role
      })));
    }
  };

  const fetchPolicies = async () => {
    const { data } = await (supabase as any).from('platform_policies').select('*').order('created_at', { ascending: false });
    if (data) setPolicies(data);
  };

  const handleUpdatePolicy = async () => {
    if (!selectedPolicy || !user) return;
    
    if (!hasPermission('system.config')) {
      toast({ title: 'Access Denied', description: 'Insufficient permissions to update global policies.', variant: 'destructive' });
      return;
    }

    try {
      const result = await GovernanceService.executeAction({
        action: 'system.config',
        targetId: selectedPolicy.id,
        targetType: 'platform_policies',
        reason: 'Policy document update via Root Governance',
        payload: { title: selectedPolicy.title, content: selectedPolicy.content },
        actorId: user.id,
        requiresApproval: requiresApproval('system.config')
      }) as { success: boolean; pending?: boolean };

      if (result.pending) {
        toast({ title: 'Staged for Approval', description: 'Policy update requires dual-control verification.' });
      } else {
        toast({ title: 'Policy Updated', description: 'Changes have been broadcasted platform-wide.' });
        setIsPolicyModalOpen(false);
        fetchPolicies();
      }
    } catch (error: any) {
      toast({ title: 'Update Failed', description: error.message, variant: 'destructive' });
    }
  };

  const fetchFlags = async () => {
    const { data } = await (supabase as any).from('platform_flags').select('*').order('key');
    if (data) setFlags(data);
  };

  const handlePromote = async (userId: string, role: string, metadata?: { username?: string, fullName?: string }) => {
    if (!user) return;

    if (!hasPermission('user.manage_roles')) {
      toast({ title: 'Access Denied', description: 'Insufficient permissions for role management.', variant: 'destructive' });
      return;
    }

    try {
      const result = await GovernanceService.executeAction({
        action: 'user.manage_roles',
        targetId: userId,
        targetType: 'user_roles',
        reason: `Promoting user to ${role.toUpperCase()}`,
        payload: { role, ...metadata },
        actorId: user.id,
        requiresApproval: requiresApproval('user.manage_roles')
      }) as { success: boolean; pending?: boolean };

      if (result.pending) {
        toast({ title: 'Staged for Approval', description: 'Staff promotions require dual-control verification.' });
      } else {
        toast({ title: 'Role Assigned', description: `User promoted to ${role.toUpperCase()}` });
        fetchStaff();
      }
    } catch (error: any) {
      toast({ title: 'Promotion Error', description: error.message, variant: 'destructive' });
    }
  };

  const handleRevoke = async (userId: string, role: string) => {
    if (userId === user?.id) {
      toast({ 
        title: 'Action Blocked', 
        description: 'You cannot revoke your own Super Admin privileges to prevent system lockout.', 
        variant: 'destructive' 
      });
      return;
    }

    if (!confirm(`Are you sure you want to revoke the ${role.toUpperCase()} role for this user?`)) return;

    const { error } = await (supabase as any).rpc('revoke_user_role', { 
      _user_id: userId,
      _role: role 
    });
    
    if (error) {
      toast({ title: 'Revocation Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Role Revoked', description: 'Staff access removed successfully.' });
      fetchStaff();
    }
  };

  const handleToggleFlag = async (flagId: string, currentValue: boolean) => {
    if (!user) return;

    if (!hasPermission('system.config')) {
      toast({ title: 'Access Denied', description: 'Insufficient permissions to modify feature flags.', variant: 'destructive' });
      return;
    }

    try {
      const result = await GovernanceService.executeAction({
        action: 'system.config',
        targetId: flagId,
        targetType: 'platform_flags',
        reason: `Toggling flag state to ${!currentValue}`,
        payload: { value: !currentValue },
        actorId: user.id,
        requiresApproval: requiresApproval('system.config')
      }) as { success: boolean; pending?: boolean };

      if (result.pending) {
        toast({ title: 'Staged for Approval', description: 'Flag modification requires administrative approval.' });
      } else {
        toast({ title: 'Flag Updated', description: `Platform behavior modified.` });
      }
    } catch (error: any) {
      toast({ title: 'Flag Error', description: error.message, variant: 'destructive' });
    }
  };

  const handleToggleFlagByKey = async (key: string) => {
    const flag = flags.find(f => f.key === key);
    if (!flag) {
      toast({ title: 'Error', description: `Flag '${key}' not found.`, variant: 'destructive' });
      return;
    }
    await handleToggleFlag(flag.id, flag.value);
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <InternalHeader 
        title="Root Governance System" 
        subtitle="CineCraft Global Infrastructure Authority" 
        role="Super Admin" 
      />

      <div className="bg-amber-500/5 border-b border-amber-500/20 px-6 py-2 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <ShieldAlert className="w-4 h-4 text-amber-500 shrink-0 animate-pulse" />
          <p className="text-[10px] text-amber-600 font-black uppercase tracking-widest">
            Root Authority Active. Every action is immutable and cryptographically logged.
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <span className="text-[9px] font-black text-amber-700/50 uppercase">Session Trust:</span>
            <span className="text-[10px] font-black text-amber-600 uppercase">Hardware Key Verified</span>
          </div>
        </div>
      </div>

      <main className="flex-1 p-8 max-w-7xl mx-auto w-full space-y-8">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <h1 className="text-2xl font-black text-foreground uppercase tracking-tight flex items-center gap-3">
              <Crown className="w-8 h-8 text-amber-500" /> Platform Sovereignty
            </h1>
            <p className="text-xs text-muted-foreground font-medium">Global policy orchestration, risk management, and infrastructure control.</p>
          </div>

          <div className="flex items-center gap-2">
            <Button 
              onClick={() => handleToggleFlagByKey('global_lock')}
              variant="outline" size="sm" 
              className={`h-10 rounded-xl border-amber-500/20 font-black text-[10px] uppercase tracking-widest px-4 ${flags.find(f => f.key === 'global_lock')?.value ? 'bg-amber-500 text-white border-none' : 'text-amber-600 hover:bg-amber-500/5'}`}
            >
              <Lock className="w-4 h-4 mr-2" /> {flags.find(f => f.key === 'global_lock')?.value ? 'UNLOCK PLATFORM' : 'GLOBAL LOCK'}
            </Button>
            <Button 
              onClick={() => handleToggleFlagByKey('maintenance_mode')}
              variant="default" size="sm" 
              className={`h-10 rounded-xl font-black text-[10px] uppercase tracking-widest px-6 shadow-lg ${flags.find(f => f.key === 'maintenance_mode')?.value ? 'bg-red-600 hover:bg-red-700' : 'bg-amber-600 hover:bg-amber-700'} text-white shadow-amber-600/20`}
            >
              <Zap className="w-4 h-4 mr-2" /> {flags.find(f => f.key === 'maintenance_mode')?.value ? 'EXIT MAINTENANCE' : 'MAINTENANCE MODE'}
            </Button>
          </div>
        </div>

        <Tabs defaultValue="governance" className="w-full space-y-6">
          <TabsList className="bg-muted/50 p-1.5 rounded-2xl border border-border/50 h-auto gap-1">
            <TabsTrigger value="approvals" className="rounded-xl px-6 py-2.5 text-xs font-bold gap-2 data-[state=active]:bg-amber-500 data-[state=active]:text-white transition-all">
              <ShieldCheck className="w-4 h-4" /> Verification Queue
            </TabsTrigger>
            <TabsTrigger value="governance" className="rounded-xl px-6 py-2.5 text-xs font-bold gap-2 data-[state=active]:bg-amber-500 data-[state=active]:text-white transition-all">
              <Shield className="w-4 h-4" /> Policy & Rules
            </TabsTrigger>
            <TabsTrigger value="staff" className="rounded-xl px-6 py-2.5 text-xs font-bold gap-2 data-[state=active]:bg-amber-500 data-[state=active]:text-white transition-all">
              <Users className="w-4 h-4" /> Staff Matrix
            </TabsTrigger>
            <TabsTrigger value="security" className="rounded-xl px-6 py-2.5 text-xs font-bold gap-2 data-[state=active]:bg-amber-500 data-[state=active]:text-white transition-all">
              <Lock className="w-4 h-4" /> Root Security
            </TabsTrigger>
            <TabsTrigger value="risk" className="rounded-xl px-6 py-2.5 text-xs font-bold gap-2 data-[state=active]:bg-amber-500 data-[state=active]:text-white transition-all">
              <AlertTriangle className="w-4 h-4" /> Trust & Risk
            </TabsTrigger>
            <TabsTrigger value="growth" className="rounded-xl px-6 py-2.5 text-xs font-bold gap-2 data-[state=active]:bg-amber-500 data-[state=active]:text-white transition-all">
              <Globe className="w-4 h-4" /> Growth
            </TabsTrigger>
          </TabsList>

          <TabsContent value="approvals" className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
            <ApprovalQueue />
          </TabsContent>

          <TabsContent value="governance" className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
            <div className="space-y-6">
                <div className="glass-card p-6 border-border/50">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-sm font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                      <ToggleLeft className="w-4 h-4 text-amber-500" /> Platform Feature Flags
                    </h3>
                    <Button variant="ghost" size="sm" className="h-8 text-[10px] font-bold uppercase gap-2">
                      <RefreshCw className="w-3.5 h-3.5" /> Force Sync
                    </Button>
                  </div>
                  
                  <div className="space-y-3">
                    {flags.map(flag => (
                      <div key={flag.id} className="flex items-center justify-between p-4 bg-muted/20 rounded-2xl border border-border/30">
                        <div className="flex items-center gap-4">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${flag.value ? 'bg-amber-500/10 text-amber-600' : 'bg-muted text-muted-foreground'}`}>
                            {flag.value ? <Zap className="w-5 h-5" /> : <Lock className="w-5 h-5" />}
                          </div>
                          <div>
                            <p className="text-sm font-bold font-mono">{flag.key}</p>
                            <p className="text-[10px] text-muted-foreground font-medium">{flag.description}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                           <span className={`text-[10px] font-black ${flag.value ? 'text-emerald-500' : 'text-muted-foreground'}`}>{flag.value ? 'ENABLED' : 'DISABLED'}</span>
                           <div 
                             onClick={() => handleToggleFlag(flag.id, flag.value)}
                             className={`w-12 h-6 rounded-full p-1 cursor-pointer transition-colors ${flag.value ? 'bg-amber-500' : 'bg-muted'}`}
                           >
                              <div className={`w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${flag.value ? 'translate-x-6' : 'translate-x-0'}`} />
                           </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="glass-card p-6 border-border/50">
                   <div className="flex items-center justify-between mb-6">
                     <h3 className="text-sm font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                       <FileText className="w-4 h-4 text-amber-500" /> Global Policy Engine
                     </h3>
                     <Button variant="outline" size="sm" className="h-8 text-[10px] font-black uppercase tracking-widest rounded-xl border-amber-500/20 text-amber-600">
                       New Policy Override
                     </Button>
                   </div>
                   
                   <div className="space-y-3">
                     {policies.length > 0 ? (
                       policies.map(policy => (
                         <div 
                           key={policy.id} 
                           onClick={() => {
                             setSelectedPolicy(policy);
                             setIsPolicyModalOpen(true);
                           }}
                           className="flex items-center justify-between p-4 bg-muted/20 rounded-2xl border border-border/30 hover:bg-muted/30 transition-colors cursor-pointer group"
                         >
                           <div className="flex items-center gap-4">
                             <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                               <Shield className="w-5 h-5 text-primary" />
                             </div>
                             <div>
                               <p className="text-sm font-bold">{policy.title}</p>
                               <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-widest">Type: {policy.type} • Active</p>
                             </div>
                           </div>
                           <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:translate-x-1 transition-transform" />
                         </div>
                       ))
                     ) : (
                       <div className="py-12 text-center border-2 border-dashed border-border/50 rounded-2xl">
                          <FileText className="w-12 h-12 text-muted-foreground/20 mx-auto mb-4" />
                          <p className="text-xs font-bold text-muted-foreground">No active legal holds or policy overrides in effect.</p>
                       </div>
                     )}
                   </div>
                </div>
              </div>
          </TabsContent>

          <TabsContent value="growth" className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <GlobalBroadcastPanel />
              <VIPInviteManager />
            </div>
          </TabsContent>

          <TabsContent value="staff" className="animate-in fade-in slide-in-from-bottom-4">
            <StaffRoleMatrix 
              staff={staff} 
              onPromote={handlePromote} 
              onRevoke={handleRevoke} 
            />
          </TabsContent>

          <TabsContent value="risk" className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 glass-card p-6 border-border/50">
                <h3 className="text-sm font-black uppercase tracking-widest text-muted-foreground mb-6 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-500" /> Fraud Intelligence Feed
                </h3>
                <div className="space-y-4">
                  {fraudLogs.length > 0 ? fraudLogs.map((log, i) => (
                    <div key={log.id || i} className="flex items-center justify-between p-4 bg-red-500/5 rounded-2xl border border-red-500/10 transition-all hover:bg-red-500/10">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-red-500/20 flex items-center justify-center">
                          <ShieldAlert className="w-5 h-5 text-red-600" />
                        </div>
                        <div>
                          <p className="text-sm font-bold">{log.action.replace(/_/g, ' ')}</p>
                          <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-widest">
                            Target ID: {log.target_id?.slice(0, 8)} • {new Date(log.created_at).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                      </div>
                      <Badge variant="destructive" className="bg-red-500 text-white border-none text-[9px] font-black uppercase">Blocked</Badge>
                    </div>
                  )) : (
                    <div className="py-8 text-center text-muted-foreground text-xs font-medium border-2 border-dashed border-border/30 rounded-2xl">
                      No active fraud anomalies detected. Scanning traffic...
                    </div>
                  )}
                </div>
              </div>

              <div className="glass-card p-6 border-amber-500/20 bg-amber-500/5">
                <h3 className="text-sm font-black uppercase tracking-widest text-amber-700 mb-6">Risk Distribution</h3>
                <div className="space-y-6">
                  {[riskStats.low, riskStats.medium, riskStats.high].map((risk, i) => (
                    <div key={i} className="space-y-2">
                      <div className="flex justify-between text-[10px] font-black uppercase tracking-widest">
                        <span>{risk.label} ({risk.count})</span>
                        <span className="text-foreground">{risk.percent}</span>
                      </div>
                      <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                        <div className={`h-full ${risk.color}`} style={{ width: risk.percent }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="security" className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
            <AuditLedger />
          </TabsContent>
        </Tabs>

        {/* Policy Editor Modal */}
        <Dialog open={isPolicyModalOpen} onOpenChange={setIsPolicyModalOpen}>
          <DialogContent className="sm:max-w-[600px] rounded-[2.5rem] border-border/50 glass-card">
            <DialogHeader>
              <DialogTitle className="text-xl font-black uppercase tracking-tight">Edit Platform Policy</DialogTitle>
              <DialogDescription className="text-xs font-medium">
                Modifying this policy will update the authoritative document and broadcast it platform-wide.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-6 py-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground px-1">Policy Title</label>
                <Input 
                  value={selectedPolicy?.title || ''}
                  onChange={(e) => setSelectedPolicy({ ...selectedPolicy, title: e.target.value })}
                  className="rounded-2xl bg-muted/50 border-border/50 font-bold focus-visible:ring-primary/20"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground px-1">Policy Content (Markdown Supported)</label>
                <Textarea 
                  value={selectedPolicy?.content || ''}
                  onChange={(e) => setSelectedPolicy({ ...selectedPolicy, content: e.target.value })}
                  className="rounded-2xl bg-muted/50 border-border/50 min-h-[300px] font-medium resize-none focus-visible:ring-primary/20"
                />
              </div>
            </div>

            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setIsPolicyModalOpen(false)} className="rounded-xl font-bold uppercase text-[10px] tracking-widest px-6 h-12">
                Cancel
              </Button>
              <Button onClick={handleUpdatePolicy} className="rounded-xl font-black uppercase text-[10px] tracking-widest px-8 h-12 bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20">
                Save & Publish
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
};

export default SuperAdminDashboard;

const ChevronRight = ({ className }: { className?: string }) => (
  <svg className={className} width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m9 18 6-6-6-6" />
  </svg>
);
