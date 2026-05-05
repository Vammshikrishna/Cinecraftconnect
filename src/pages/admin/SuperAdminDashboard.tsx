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
  const [economics, setEconomics] = useState<any>({
    total_gmv: 0,
    commission_rate: 15,
    payout_status: 'Scheduled'
  });
  const [selectedPolicy, setSelectedPolicy] = useState<any>(null);
  const [isPolicyModalOpen, setIsPolicyModalOpen] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();
  const { hasPermission, requiresApproval } = useGovernance();

  useEffect(() => {
    fetchStaff();
    fetchFlags();
    fetchEconomics();
    fetchPolicies();

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

  const fetchStaff = async () => {
    const { data } = await (supabase as any)
      .from('user_roles')
      .select(`role, profile:user_id(id, username, full_name, avatar_url)`)
      .neq('role', 'user');
    if (data) setStaff(data.map((r: any) => ({ ...r.profile, role: r.role })));
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

  const fetchEconomics = async () => {
    const { data, error } = await (supabase as any).rpc('get_platform_economics');
    if (!error && data) setEconomics(data);
  };

  const fetchFlags = async () => {
    const { data } = await (supabase as any).from('platform_flags').select('*').order('key');
    if (data) setFlags(data);
  };

  const handlePromote = async (userId: string, role: string) => {
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
        payload: { role },
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

  const handleRevoke = async (userId: string) => {
    const { error } = await (supabase as any).rpc('revoke_user_role', { _target_user_id: userId });
    if (error) toast({ title: 'Revocation Error', description: error.message, variant: 'destructive' });
    else {
      toast({ title: 'Role Revoked', description: 'Staff access removed' });
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
            <TabsTrigger value="infrastructure" className="rounded-xl px-6 py-2.5 text-xs font-bold gap-2 data-[state=active]:bg-amber-500 data-[state=active]:text-white transition-all">
              <HardDrive className="w-4 h-4" /> Infrastructure
            </TabsTrigger>
            <TabsTrigger value="growth" className="rounded-xl px-6 py-2.5 text-xs font-bold gap-2 data-[state=active]:bg-amber-500 data-[state=active]:text-white transition-all">
              <Globe className="w-4 h-4" /> Growth
            </TabsTrigger>
          </TabsList>

          <TabsContent value="approvals" className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
            <ApprovalQueue />
          </TabsContent>

          <TabsContent value="governance" className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-6">
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

              <div className="space-y-6">
                <div className="glass-card p-6 border-amber-500/20 bg-amber-500/5">
                  <h3 className="text-sm font-black uppercase tracking-widest text-amber-700 mb-4">Revenue Governance</h3>
                  <div className="space-y-4">
                    <div className="p-4 bg-white/50 dark:bg-black/20 rounded-xl border border-amber-500/10">
                      <p className="text-[9px] font-black text-amber-600 uppercase tracking-widest mb-1">Total Platform GMV</p>
                      <p className="text-2xl font-black text-foreground">₹{economics.total_gmv.toLocaleString()}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="p-3 bg-white/50 dark:bg-black/20 rounded-xl border border-amber-500/10">
                        <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest mb-1">Commission</p>
                        <p className="text-lg font-black text-foreground">{economics.commission_rate}%</p>
                      </div>
                      <div className="p-3 bg-white/50 dark:bg-black/20 rounded-xl border border-amber-500/10">
                        <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest mb-1">Payouts</p>
                        <p className="text-lg font-black text-foreground capitalize">{economics.payout_status}</p>
                      </div>
                    </div>
                    <Button variant="outline" className="w-full h-10 rounded-xl border-amber-500/20 text-amber-700 font-bold text-[10px] uppercase tracking-widest">
                      Manage Commissions
                    </Button>
                  </div>
                </div>

                <div className="glass-card p-6 border-border/50">
                  <h3 className="text-sm font-black uppercase tracking-widest text-muted-foreground mb-4">Security Center</h3>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-2 hover:bg-muted/30 rounded-lg cursor-pointer transition-colors">
                      <div className="flex items-center gap-2 text-xs font-bold">
                        <Key className="w-4 h-4 text-blue-500" /> API Keys
                      </div>
                      <ChevronRight className="w-4 h-4 text-muted-foreground" />
                    </div>
                    <div className="flex items-center justify-between p-2 hover:bg-muted/30 rounded-lg cursor-pointer transition-colors">
                      <div className="flex items-center gap-2 text-xs font-bold">
                        <Database className="w-4 h-4 text-emerald-500" /> Backup Vault
                      </div>
                      <ChevronRight className="w-4 h-4 text-muted-foreground" />
                    </div>
                    <div className="flex items-center justify-between p-2 hover:bg-muted/30 rounded-lg cursor-pointer transition-colors">
                      <div className="flex items-center gap-2 text-xs font-bold">
                        <Globe className="w-4 h-4 text-purple-500" /> DNS Health
                      </div>
                      <ChevronRight className="w-4 h-4 text-muted-foreground" />
                    </div>
                  </div>
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
                  {[1, 2, 3].map((_, i) => (
                    <div key={i} className="flex items-center justify-between p-4 bg-red-500/5 rounded-2xl border border-red-500/10 transition-all hover:bg-red-500/10">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-red-500/20 flex items-center justify-center">
                          <ShieldAlert className="w-5 h-5 text-red-600" />
                        </div>
                        <div>
                          <p className="text-sm font-bold">Suspicious Withdrawal Attempt</p>
                          <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-widest">User ID: 882x-11 • Mumbai, IN • 4m ago</p>
                        </div>
                      </div>
                      <Badge variant="destructive" className="bg-red-500 text-white border-none text-[9px] font-black uppercase">Blocked</Badge>
                    </div>
                  ))}
                  <div className="py-8 text-center text-muted-foreground text-xs font-medium border-2 border-dashed border-border/30 rounded-2xl">
                    Scanning global traffic for anomalies...
                  </div>
                </div>
              </div>

              <div className="glass-card p-6 border-amber-500/20 bg-amber-500/5">
                <h3 className="text-sm font-black uppercase tracking-widest text-amber-700 mb-6">Risk Distribution</h3>
                <div className="space-y-6">
                  {[
                    { label: 'Low Risk Users', value: '98.2%', color: 'bg-emerald-500' },
                    { label: 'Suspicious Active', value: '1.4%', color: 'bg-amber-500' },
                    { label: 'High Risk / Bot', value: '0.4%', color: 'bg-red-500' },
                  ].map((risk, i) => (
                    <div key={i} className="space-y-2">
                      <div className="flex justify-between text-[10px] font-black uppercase tracking-widest">
                        <span>{risk.label}</span>
                        <span className="text-foreground">{risk.value}</span>
                      </div>
                      <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                        <div className={`h-full ${risk.color}`} style={{ width: risk.value }} />
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

          <TabsContent value="infrastructure" className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
             <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {[
                   { label: 'Compute Engine', value: '42%', icon: Cpu, color: 'text-blue-500' },
                   { label: 'Database I/O', value: '18%', icon: Database, color: 'text-emerald-500' },
                   { label: 'Network Latency', value: '24ms', icon: Network, color: 'text-purple-500' },
                ].map((node, i) => (
                   <div key={i} className="glass-card p-6 border-border/50">
                      <div className="flex items-center justify-between mb-4">
                         <div className={`w-10 h-10 rounded-xl bg-muted/50 flex items-center justify-center`}>
                            <node.icon className={`w-5 h-5 ${node.color}`} />
                         </div>
                         <Badge className="bg-emerald-500/10 text-emerald-500 border-none text-[9px] font-black">HEALTHY</Badge>
                      </div>
                      <p className="text-2xl font-black text-foreground">{node.value}</p>
                      <p className="text-[10px] text-muted-foreground font-black uppercase tracking-widest mt-1">{node.label}</p>
                   </div>
                ))}
             </div>
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
