import { useState, useEffect } from 'react';
import ConsoleTabs from '@/components/internal/shared/ConsoleTabs';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import InternalHeader from '@/components/internal/shared/InternalHeader';
import StaffRoleMatrix from '@/components/internal/super-admin/StaffRoleMatrix';
import PlatformPulse from '@/components/internal/super-admin/PlatformPulse';
import StaffSecurityPanel from '@/components/internal/super-admin/StaffSecurityPanel';
import PlatformRulesEditor from '@/components/internal/super-admin/PlatformRulesEditor';
import LegalRequestsDesk from '@/components/internal/admin/LegalRequestsDesk';
import BillingPanel from '@/components/internal/super-admin/BillingPanel';
import StaffWatchPanel from '@/components/internal/super-admin/StaffWatchPanel';
import TransparencyManager from '@/components/internal/super-admin/TransparencyManager';
import CompliancePack from '@/components/internal/super-admin/CompliancePack';
import DigestSettings from '@/components/internal/super-admin/DigestSettings';
import TeamStatsCards from '@/components/internal/shared/TeamStatsCards';
import OnCallRota from '@/components/internal/shared/OnCallRota';
import IncidentDesk from '@/components/internal/shared/IncidentDesk';
import { FileLock2 as ComplianceIcon, PhoneCall as OnCallIcon, Mail as DigestIcon } from 'lucide-react';
import { BadgeDollarSign as BillingIcon, CircleDollarSign as PaymentsIcon } from 'lucide-react';
import PaymentsConsole from '@/components/internal/admin/PaymentsConsole';
import { Gavel as GavelIcon, SlidersHorizontal as RulesIcon, Eye, TrendingUp } from 'lucide-react';
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
import { Switch } from '@/components/ui/switch';
import { confirmDialog } from '@/lib/confirmDialog';
import { friendlyError } from '@cinecraft/core';

const SuperAdminDashboard = () => {
  const [staff, setStaff] = useState<any[]>([]);
  const [flags, setFlags] = useState<any[]>([]);
  const [policies, setPolicies] = useState<any[]>([]);
  const [selectedPolicy, setSelectedPolicy] = useState<any>(null);
  const [isPolicyModalOpen, setIsPolicyModalOpen] = useState(false);
  const [policyReason, setPolicyReason] = useState('');
  const [fraudLogs, setFraudLogs] = useState<any[]>([]);
  const [riskStats, setRiskStats] = useState({
    low: { label: 'Low Risk Users', count: 0, percent: '0%', color: 'bg-emerald-500' },
    medium: { label: 'Suspicious Active', count: 0, percent: '0%', color: 'bg-amber-500' },
    high: { label: 'High Risk / Bot', count: 0, percent: '0%', color: 'bg-red-500' },
  });
  const { toast } = useToast();
  // opens on the owner overview; the screens below it are one tap away
  const [superTab, setSuperTab] = useState('overview');
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

    const { data: dist } = await (supabase as any).rpc('get_risk_distribution');
    if (dist && dist.total > 0) {
      const pct = (n: number) => ((n / dist.total) * 100).toFixed(1) + '%';
      setRiskStats({
        low: { label: 'Low Risk Users', count: dist.low, percent: pct(dist.low), color: 'bg-emerald-500' },
        medium: { label: 'Suspicious Active', count: dist.medium, percent: pct(dist.medium), color: 'bg-amber-500' },
        high: { label: 'High Risk / Bot', count: dist.high, percent: pct(dist.high), color: 'bg-red-500' },
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

    if (!String(selectedPolicy.title || '').trim() || !String(selectedPolicy.content || '').trim()) {
      toast({ title: 'Title and content are required', variant: 'destructive' });
      return;
    }
    if (policyReason.trim().length < 5) {
      toast({ title: 'Give a reason', description: 'Write at least 5 characters so the second approver knows why.', variant: 'destructive' });
      return;
    }

    try {
      await GovernanceService.request({
        action: 'system.config',
        targetType: 'platform_policies',
        targetId: selectedPolicy.id,
        reason: policyReason.trim(),
        payload: { title: String(selectedPolicy.title).trim(), content: selectedPolicy.content },
      });
      toast({ title: 'Sent for second approval', description: 'A different super admin must approve this policy change before it is published.' });
      setIsPolicyModalOpen(false);
      setPolicyReason('');
    } catch (error: any) {
      toast({ title: 'Update Failed', description: friendlyError(error), variant: 'destructive' });
    }
  };

  const fetchFlags = async () => {
    const { data } = await (supabase as any).from('platform_flags').select('*').order('key');
    if (data) setFlags(data);
  };

  const handlePromote = async (userId: string, role: string, _metadata?: { username?: string, fullName?: string }, reasonText?: string) => {
    if (!user) return;

    if (!hasPermission('user.manage_roles')) {
      toast({ title: 'Access Denied', description: 'Insufficient permissions for role management.', variant: 'destructive' });
      return;
    }

    if (role === 'finance') {
      // finance has its own request (part GC): it only reads and decides refunds, and a different super admin approves it
      const { error } = await (supabase as any).rpc('finance_request_role', { p_user: userId, p_grant: true, p_reason: reasonText || 'Finance access' });
      if (error) toast({ title: 'Promotion Error', description: friendlyError(error), variant: 'destructive' });
      else toast({ title: 'Sent for second approval', description: 'A different super admin must approve this role change before it takes effect.' });
      return;
    }

    try {
      await GovernanceService.request({
        action: 'user.manage_roles',
        targetType: 'user_roles',
        targetId: userId,
        reason: reasonText ? `Promote to ${role.toUpperCase()}: ${reasonText}` : `Promoting user to ${role.toUpperCase()}`,
        payload: { role },
      });
      toast({ title: 'Sent for second approval', description: 'A different super admin must approve this role change before it takes effect.' });
    } catch (error: any) {
      toast({ title: 'Promotion Error', description: friendlyError(error), variant: 'destructive' });
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

    // A super admin is removed by a different path (database part EG): one super admin asks, a different one approves, and at
    // least three super admins must exist so that two remain.
    if (role === 'super_admin') {
      if (!await confirmDialog('Ask to remove this SUPER ADMIN? A different super admin has to approve it, and at least 3 super admins must exist so that 2 remain.')) return;
      try {
        const { error } = await (supabase as any).rpc('gov_request_super_admin_removal', {
          p_target: userId,
          p_reason: 'Super admin removal requested from the Staff Matrix',
        });
        if (error) throw error;
        toast({ title: 'Removal requested', description: 'It is waiting for a different super admin to approve it in the approval queue.' });
      } catch (e: any) {
        toast({ title: 'Request failed', description: friendlyError(e), variant: 'destructive' });
      }
      return;
    }

    if (!await confirmDialog(`Ask to revoke the ${role.toUpperCase()} role for this person? A different super admin has to approve it.`)) return;

    if (role === 'finance') {
      const { error } = await (supabase as any).rpc('finance_request_role', { p_user: userId, p_grant: false, p_reason: 'Finance access removed from the Staff Matrix' });
      if (error) toast({ title: 'Request failed', description: friendlyError(error), variant: 'destructive' });
      else toast({ title: 'Sent for second approval', description: 'A different super admin must approve the removal.' });
      return;
    }

    try {
      await GovernanceService.request({
        action: 'user.revoke_role',
        targetType: 'user_roles',
        targetId: userId,
        reason: `Revoking the ${role.toUpperCase()} role`,
        payload: { role },
      });
      toast({ title: 'Sent for second approval', description: 'The role stays until a different super admin approves.' });
    } catch (error: any) {
      toast({ title: 'Revocation Error', description: friendlyError(error), variant: 'destructive' });
    }
  };

  // flag id -> the value it had when a change was sent; the button stays on 'Awaiting approval' until the value really changes
  const [sentFlags, setSentFlags] = useState<Record<string, boolean>>({});
  const isAwaiting = (key: string) => { const f = flags.find(x => x.key === key); return !!f && sentFlags[f.id] === f.value; };

  const handleToggleFlag = async (flagId: string, currentValue: boolean) => {
    if (!user) return;
    if (sentFlags[flagId] === currentValue) return;

    if (!hasPermission('system.config')) {
      toast({ title: 'Access Denied', description: 'Insufficient permissions to modify feature flags.', variant: 'destructive' });
      return;
    }

    setSentFlags(prev => ({ ...prev, [flagId]: currentValue }));
    try {
      await GovernanceService.request({
        action: 'system.config',
        targetType: 'platform_flags',
        targetId: flagId,
        reason: `Turning the flag ${currentValue ? 'off' : 'on'}`,
        payload: { value: !currentValue },
      });
      toast({ title: 'Sent for second approval', description: 'The flag changes once a different super admin approves it.' });
    } catch (error: any) {
      setSentFlags(prev => { const next = { ...prev }; delete next[flagId]; return next; });
      toast({ title: 'Flag Error', description: friendlyError(error), variant: 'destructive' });
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
    <div className="min-h-dvh bg-background flex flex-col">
      <InternalHeader 
        title="Root Governance System" 
        subtitle="CineCraft Global Infrastructure Authority" 
        role="Super Admin" 
      />

      <div className="bg-amber-500/5 border-b border-amber-500/20 px-6 py-2 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <ShieldAlert className="w-4 h-4 text-amber-500 shrink-0" />
          <p className="text-xs text-amber-700 dark:text-amber-400 font-semibold tracking-wide">
            Root authority. Your actions are recorded in the audit log.
          </p>
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
              disabled={isAwaiting('global_lock')}
              variant="outline" size="sm" 
              className={`h-10 rounded-xl border-amber-500/20 font-bold text-xs tracking-wide px-4 ${flags.find(f => f.key === 'global_lock')?.value ? 'bg-amber-500 text-amber-950 border-none' : 'text-amber-600 hover:bg-amber-500/5'}`}
            >
              <Lock className="w-4 h-4 mr-2" /> {isAwaiting('global_lock') ? 'Awaiting approval' : flags.find(f => f.key === 'global_lock')?.value ? 'Unlock platform' : 'Global lock'}
            </Button>
            <Button 
 onClick={() => handleToggleFlagByKey('maintenance_mode')}
              disabled={isAwaiting('maintenance_mode')}
              variant="default" size="sm" 
              className={`h-10 rounded-xl font-bold text-xs tracking-wide px-6 shadow-lg ${flags.find(f => f.key === 'maintenance_mode')?.value ? 'bg-red-600 hover:bg-red-700' : 'bg-amber-600 hover:bg-amber-700'} text-white shadow-amber-600/20`}
            >
              <Zap className="w-4 h-4 mr-2" /> {isAwaiting('maintenance_mode') ? 'Awaiting approval' : flags.find(f => f.key === 'maintenance_mode')?.value ? 'Exit maintenance' : 'Maintenance mode'}
            </Button>
          </div>
        </div>

        <Tabs value={superTab} onValueChange={setSuperTab} className="w-full space-y-6">
          <ConsoleTabs active={superTab}>
            <TabsTrigger value="overview" className="rounded-xl px-4 py-2.5 text-[13px] font-semibold gap-2 shrink-0 whitespace-nowrap data-[state=active]:bg-amber-500 data-[state=active]:text-amber-950 transition-colors">
              <TrendingUp className="w-4 h-4" /> Overview
            </TabsTrigger>
            <TabsTrigger value="approvals" className="rounded-xl px-4 py-2.5 text-[13px] font-semibold gap-2 shrink-0 whitespace-nowrap data-[state=active]:bg-amber-500 data-[state=active]:text-amber-950 transition-colors">
              <ShieldCheck className="w-4 h-4" /> Approvals
            </TabsTrigger>
            <TabsTrigger value="governance" className="rounded-xl px-4 py-2.5 text-[13px] font-semibold gap-2 shrink-0 whitespace-nowrap data-[state=active]:bg-amber-500 data-[state=active]:text-amber-950 transition-colors">
              <Shield className="w-4 h-4" /> Policy & Rules
            </TabsTrigger>
            <TabsTrigger value="staff" className="rounded-xl px-4 py-2.5 text-[13px] font-semibold gap-2 shrink-0 whitespace-nowrap data-[state=active]:bg-amber-500 data-[state=active]:text-amber-950 transition-colors">
              <Users className="w-4 h-4" /> Staff Matrix
            </TabsTrigger>
            <TabsTrigger value="security" className="rounded-xl px-4 py-2.5 text-[13px] font-semibold gap-2 shrink-0 whitespace-nowrap data-[state=active]:bg-amber-500 data-[state=active]:text-amber-950 transition-colors">
              <Lock className="w-4 h-4" /> Root Security
            </TabsTrigger>
            <TabsTrigger value="risk" className="rounded-xl px-4 py-2.5 text-[13px] font-semibold gap-2 shrink-0 whitespace-nowrap data-[state=active]:bg-amber-500 data-[state=active]:text-amber-950 transition-colors">
              <AlertTriangle className="w-4 h-4" /> Trust & Risk
            </TabsTrigger>
            <TabsTrigger value="watch" className="rounded-xl px-4 py-2.5 text-[13px] font-semibold gap-2 shrink-0 whitespace-nowrap data-[state=active]:bg-amber-500 data-[state=active]:text-amber-950 transition-colors">
              <Eye className="w-4 h-4" /> Staff Watch
            </TabsTrigger>
            <TabsTrigger value="transparency" className="rounded-xl px-4 py-2.5 text-[13px] font-semibold gap-2 shrink-0 whitespace-nowrap data-[state=active]:bg-amber-500 data-[state=active]:text-amber-950 transition-colors">
              <FileText className="w-4 h-4" /> Transparency
            </TabsTrigger>
            <TabsTrigger value="payments" className="rounded-xl px-4 py-2.5 text-[13px] font-semibold gap-2 shrink-0 whitespace-nowrap data-[state=active]:bg-amber-500 data-[state=active]:text-amber-950 transition-colors">
              <PaymentsIcon className="w-4 h-4" /> Payments
            </TabsTrigger>
            <TabsTrigger value="billing" className="rounded-xl px-4 py-2.5 text-[13px] font-semibold gap-2 shrink-0 whitespace-nowrap data-[state=active]:bg-amber-500 data-[state=active]:text-amber-950 transition-colors">
              <BillingIcon className="w-4 h-4" /> Billing
            </TabsTrigger>
            <TabsTrigger value="legal" className="rounded-xl px-4 py-2.5 text-[13px] font-semibold gap-2 shrink-0 whitespace-nowrap data-[state=active]:bg-amber-500 data-[state=active]:text-amber-950 transition-colors">
              <GavelIcon className="w-4 h-4" /> Legal Requests
            </TabsTrigger>
            <TabsTrigger value="rules" className="rounded-xl px-4 py-2.5 text-[13px] font-semibold gap-2 shrink-0 whitespace-nowrap data-[state=active]:bg-amber-500 data-[state=active]:text-amber-950 transition-colors">
              <RulesIcon className="w-4 h-4" /> Platform Rules
            </TabsTrigger>
            <TabsTrigger value="growth" className="rounded-xl px-4 py-2.5 text-[13px] font-semibold gap-2 shrink-0 whitespace-nowrap data-[state=active]:bg-amber-500 data-[state=active]:text-amber-950 transition-colors">
              <Globe className="w-4 h-4" /> Growth
            </TabsTrigger>
            <TabsTrigger value="compliance" className="rounded-xl px-4 py-2.5 text-[13px] font-semibold gap-2 shrink-0 whitespace-nowrap data-[state=active]:bg-amber-500 data-[state=active]:text-amber-950 transition-colors">
              <ComplianceIcon className="w-4 h-4" /> Compliance
            </TabsTrigger>
            <TabsTrigger value="oncall" className="rounded-xl px-4 py-2.5 text-[13px] font-semibold gap-2 shrink-0 whitespace-nowrap data-[state=active]:bg-amber-500 data-[state=active]:text-amber-950 transition-colors">
              <OnCallIcon className="w-4 h-4" /> On call & Status
            </TabsTrigger>
            <TabsTrigger value="digests" className="rounded-xl px-4 py-2.5 text-[13px] font-semibold gap-2 shrink-0 whitespace-nowrap data-[state=active]:bg-amber-500 data-[state=active]:text-amber-950 transition-colors">
              <DigestIcon className="w-4 h-4" /> Digests
            </TabsTrigger>
          </ConsoleTabs>

          <TabsContent value="overview" className="space-y-6 animate-in fade-in duration-100">
            <PlatformPulse onOpenTab={setSuperTab} />
            <TeamStatsCards teams={['support', 'trust', 'finance', 'growth']} />
          </TabsContent>

          <TabsContent value="compliance" className="animate-in fade-in duration-100">
            <CompliancePack />
          </TabsContent>

          <TabsContent value="oncall" className="space-y-6 animate-in fade-in duration-100">
            <OnCallRota />
            <IncidentDesk />
          </TabsContent>

          <TabsContent value="digests" className="animate-in fade-in duration-100">
            <DigestSettings />
          </TabsContent>

          <TabsContent value="approvals" className="space-y-6 animate-in fade-in duration-100">
            <ApprovalQueue />
          </TabsContent>

          <TabsContent value="governance" className="space-y-6 animate-in fade-in duration-100">
            <div className="space-y-6">
                <div className="glass-card p-6 border-border/50">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-sm font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                      <ToggleLeft className="w-4 h-4 text-amber-500" /> Platform Feature Flags
                    </h3>
                    <Button variant="ghost" size="sm" className="h-8 text-[12px] font-bold uppercase gap-2" onClick={() => { fetchFlags(); fetchPolicies(); }}>
                      <RefreshCw className="w-3.5 h-3.5" /> Refresh
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
                            <p className="text-[12px] text-muted-foreground font-medium">{flag.description}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                           <span className={`text-[12px] font-black ${flag.value ? 'text-emerald-500' : 'text-muted-foreground'}`}>{flag.value ? 'ENABLED' : 'DISABLED'}</span>
                           <Switch
                             checked={!!flag.value}
                             onCheckedChange={() => handleToggleFlag(flag.id, flag.value)}
                             aria-label={`${flag.key}: ${flag.value ? 'on' : 'off'}. Changing it needs a second super admin.`}
                           />
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
                   </div>
                   
                   <div className="space-y-3">
                     {policies.length > 0 ? (
                       policies.map(policy => (
                         <div 
                           key={policy.id} 
                           role="button"
                           tabIndex={0}
                           onClick={() => {
                             setSelectedPolicy(policy);
                             setPolicyReason('');
                             setIsPolicyModalOpen(true);
                           }}
                           onKeyDown={(e) => {
                             if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedPolicy(policy); setPolicyReason(''); setIsPolicyModalOpen(true); }
                           }}
                           className="flex items-center justify-between p-4 bg-muted/20 rounded-2xl border border-border/30 hover:bg-muted/30 transition-colors cursor-pointer group"
                         >
                           <div className="flex items-center gap-4">
                             <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                               <Shield className="w-5 h-5 text-primary" />
                             </div>
                             <div>
                               <p className="text-sm font-bold">{policy.title}</p>
                               <p className="text-[12px] text-muted-foreground font-medium uppercase tracking-widest">Type: {policy.type} • {policy.is_active === false ? 'Inactive' : 'Active'}</p>
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

          <TabsContent value="growth" className="space-y-6 animate-in fade-in duration-100">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <GlobalBroadcastPanel />
              <VIPInviteManager />
            </div>
          </TabsContent>

          <TabsContent value="watch" className="animate-in fade-in duration-100">
            <StaffWatchPanel />
          </TabsContent>

          <TabsContent value="transparency" className="animate-in fade-in duration-100">
            <TransparencyManager />
          </TabsContent>

          <TabsContent value="payments" className="animate-in fade-in duration-100">
            <PaymentsConsole />
          </TabsContent>

          <TabsContent value="billing" className="animate-in fade-in duration-100">
            <BillingPanel />
          </TabsContent>

          <TabsContent value="legal" className="animate-in fade-in duration-100">
            <LegalRequestsDesk />
          </TabsContent>

          <TabsContent value="rules" className="animate-in fade-in duration-100">
            <PlatformRulesEditor />
          </TabsContent>

          <TabsContent value="staff" className="animate-in fade-in duration-100">
            <StaffRoleMatrix 
              staff={staff} 
              onPromote={handlePromote} 
              onRevoke={handleRevoke} 
            />
            <div className="mt-12"><StaffSecurityPanel /></div>
          </TabsContent>

          <TabsContent value="risk" className="space-y-6 animate-in fade-in duration-100">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 glass-card p-6 border-border/50">
                <h3 className="text-sm font-black uppercase tracking-widest text-muted-foreground mb-6 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-500" /> Fraud Intelligence Feed
                </h3>
                <div className="space-y-4">
                  {fraudLogs.length > 0 ? fraudLogs.map((log, i) => (
                    <div key={log.id || i} className="flex items-center justify-between p-4 bg-red-500/5 rounded-2xl border border-red-500/10 transition hover:bg-red-500/10">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-red-500/20 flex items-center justify-center">
                          <ShieldAlert className="w-5 h-5 text-red-600" />
                        </div>
                        <div>
                          <p className="text-sm font-bold">{log.action.replace(/_/g, ' ')}</p>
                          <p className="text-[12px] text-muted-foreground font-medium uppercase tracking-widest">
                            Target ID: {log.target_id?.slice(0, 8)} • {new Date(log.created_at).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                      </div>
                      <Badge variant="destructive" className="bg-red-500 text-white border-none text-[12px] font-black uppercase">Blocked</Badge>
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
                      <div className="flex justify-between text-[12px] font-black uppercase tracking-widest">
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

          <TabsContent value="security" className="space-y-6 animate-in fade-in duration-100">
            <AuditLedger />
          </TabsContent>
        </Tabs>

        {/* Policy Editor Modal */}
        <Dialog open={isPolicyModalOpen} onOpenChange={setIsPolicyModalOpen}>
          <DialogContent className="sm:max-w-[600px] rounded-[2.5rem] border-border/50 glass-card">
            <DialogHeader>
              <DialogTitle className="text-xl font-black uppercase tracking-tight">Edit Platform Policy</DialogTitle>
              <DialogDescription className="text-xs font-medium">
                Your change is queued. A different super admin must approve it before the policy is updated.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-6 py-4">
              <div className="space-y-2">
                <label htmlFor="policy-title" className="text-[12px] font-black uppercase tracking-widest text-muted-foreground px-1">Policy Title</label>
                <Input id="policy-title" 
                  value={selectedPolicy?.title || ''}
                  onChange={(e) => setSelectedPolicy({ ...selectedPolicy, title: e.target.value })}
                  className="rounded-2xl bg-muted/50 border-border/50 font-bold focus-visible:ring-primary/20"
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="policy-content" className="text-[12px] font-black uppercase tracking-widest text-muted-foreground px-1">Policy Content (Markdown Supported)</label>
                <Textarea id="policy-content" 
                  value={selectedPolicy?.content || ''}
                  onChange={(e) => setSelectedPolicy({ ...selectedPolicy, content: e.target.value })}
                  className="rounded-2xl bg-muted/50 border-border/50 min-h-[300px] font-medium resize-none focus-visible:ring-primary/20"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label htmlFor="policy-reason" className="text-[12px] font-black uppercase tracking-widest text-muted-foreground px-1">Reason (required)</label>
              <Input id="policy-reason" value={policyReason} onChange={(e) => setPolicyReason(e.target.value)} maxLength={300} className="rounded-2xl bg-muted/50 border-border/50" placeholder="Why is this change needed?" />
            </div>

            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setIsPolicyModalOpen(false)} className="rounded-xl font-bold uppercase text-[12px] tracking-widest px-6 h-12">
                Cancel
              </Button>
              <Button onClick={handleUpdatePolicy} disabled={!String(selectedPolicy?.title || '').trim() || !String(selectedPolicy?.content || '').trim() || policyReason.trim().length < 5} className="rounded-xl font-black uppercase text-[12px] tracking-widest px-8 h-12 bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20">
                Send for approval
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
