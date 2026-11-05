import { useState, useEffect } from 'react';
import ConsoleTabs from '@/components/internal/shared/ConsoleTabs';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import InternalHeader from '@/components/internal/shared/InternalHeader';
import VerificationReview from '@/components/internal/admin/VerificationReview';
import ReportTriageBoard from '@/components/internal/moderator/ReportTriageBoard';
import ApprovalQueue from '@/components/internal/admin/ApprovalQueue';
import { 
  Users, BadgeCheck, Activity, CreditCard, 
  LifeBuoy, ShieldAlert, BarChart3, Search,
  Lock, Key, VolumeX, Ban, RefreshCw,
  MoreVertical, Shield, Eye, History
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import UserPlanStats from '@/components/internal/shared/UserPlanStats';
import TeamStatsCards from '@/components/internal/shared/TeamStatsCards';
import OnCallRota from '@/components/internal/shared/OnCallRota';
import IncidentDesk from '@/components/internal/shared/IncidentDesk';
import DigestSettings from '@/components/internal/super-admin/DigestSettings';
import { PhoneCall as OnCallIcon } from 'lucide-react';
import { SupportTicketManager } from '@/components/internal/admin/SupportTicketManager';
import { VendorVerificationQueue } from '@/components/internal/admin/VendorVerificationQueue';
import { PageVerificationQueue } from '@/components/internal/admin/PageVerificationQueue';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
import ReasonDialog from '@/components/internal/shared/ReasonDialog';
import UserRecordDialog from '@/components/internal/admin/UserRecordDialog';
import AppealsQueue from '@/components/internal/admin/AppealsQueue';
import AuditLedger from '@/components/internal/admin/AuditLedger';
import TemplatesManager from '@/components/internal/admin/TemplatesManager';
import GovernanceTuning from '@/components/internal/admin/GovernanceTuning';
import { useSearchParams } from 'react-router-dom';
import { Lock as LockIcon, Network as NetworkIcon, CircleDollarSign as PaymentsIcon, BarChart3 as AnalyticsIcon, Scale as DisputeIcon, ScanSearch as DetectionIcon } from 'lucide-react';
import PaymentsConsole from '@/components/internal/admin/PaymentsConsole';
import SafetyAnalytics from '@/components/internal/admin/SafetyAnalytics';
import MarketplaceDisputesDesk from '@/components/internal/admin/MarketplaceDisputesDesk';
import DetectionPanel from '@/components/internal/admin/DetectionPanel';
import AccessRequestsQueue from '@/components/internal/admin/AccessRequestsQueue';
import RiskAndNetworks from '@/components/internal/admin/RiskAndNetworks';
import { GovernanceService } from '@/services/governance/GovernanceService';
import { confirmDialog } from '@/lib/confirmDialog';
import { friendlyError } from '@cinecraft/core';
import StaffWorkload from '@/components/internal/admin/StaffWorkload';
import ExportsPanel from '@/components/internal/admin/ExportsPanel';
import SavedViewsBar from '@/components/internal/shared/SavedViewsBar';
import { runBulk } from '@/components/internal/shared/deskLogic';

const AdminDashboard = () => {
  const [verificationRequests, setVerificationRequests] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [userTypeFilter, setUserTypeFilter] = useState<'all' | 'fan' | 'creator' | 'studio'>('all');
  const [usersError, setUsersError] = useState(false);
  const [usersLoaded, setUsersLoaded] = useState(false);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const [stats, setStats] = useState({
    active_sessions: 0,
    fraud_alerts: 0,
    pending_support: 0
  });
  const [platformEvents, setPlatformEvents] = useState<any[]>([]);
  const [userLimit, setUserLimit] = useState(50);
  const [recordUserId, setRecordUserId] = useState<string | null>(null);
  const [tab, setTab] = useState('operations');
  const [searchParams, setSearchParams] = useSearchParams();
  const [accessPending, setAccessPending] = useState(0);
  // a link from a staff alert can open a tab directly, for example /admin?tab=access
  useEffect(() => {
    const wantedTab = searchParams.get('tab');
    if (wantedTab && ['access', 'safety', 'payments'].includes(wantedTab)) {
      setTab(wantedTab);
      setSearchParams({}, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // the badge on the Access tab
  useEffect(() => {
    let alive = true;
    const count = async () => {
      const { data } = await (supabase as any).rpc('staff_list_access_requests', { p_status: 'pending' });
      if (alive && Array.isArray(data)) setAccessPending(data.filter((x: any) => new Date(x.expires_at) > new Date()).length);
    };
    void count();
    const t = setInterval(count, 30000);
    return () => { alive = false; clearInterval(t); };
  }, []);
  useEffect(() => {
    const wanted = searchParams.get('user');
    if (wanted) {
      setTab('users');
      setRecordUserId(wanted);
      setSearchParams({}, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [pendingApprovals, setPendingApprovals] = useState<number | null>(null);
  const [dbLatency, setDbLatency] = useState<number | null | 'down'>(null);
  const [pendingAction, setPendingAction] = useState<{ user: any; action: 'freeze' | 'reset_password' | 'logout' | 'monetization' | 'suspend' } | null>(null);

  useEffect(() => {
    fetchUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userLimit]);

  useEffect(() => {
    fetchData();

    // Subscribe to real-time changes (profile changes arrive in bursts, so they are batched)
    let profilesTimer: ReturnType<typeof setTimeout> | undefined;
    const channel = supabase
      .channel('admin-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'verification_requests' }, () => fetchVerification())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => { if (profilesTimer) clearTimeout(profilesTimer); profilesTimer = setTimeout(() => { fetchUsers(); fetchStats(); }, 500); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'content_reports' }, () => fetchStats())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'support_tickets' }, () => fetchStats())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'audit_logs' }, () => fetchPlatformEvents())
      .subscribe();

    return () => {
      if (profilesTimer) clearTimeout(profilesTimer);
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchData = async () => {
    setLoading(true);
    await Promise.all([fetchUsers(), fetchVerification(), fetchStats(), fetchPlatformEvents()]);
    setLoading(false);
  };

  const fetchStats = async () => {
    const started = performance.now();
    const { data, error } = await (supabase as any).rpc('get_admin_stats');
    setDbLatency(error ? 'down' : Math.round(performance.now() - started));
    if (data) setStats((prev) => ({ ...prev, ...data }));
    const { count } = await (supabase as any).from('gov_approval_queue').select('id', { count: 'exact', head: true }).eq('status', 'pending');
    setPendingApprovals(count ?? 0);
  };

  const fetchVerification = async () => {
    const { data } = await (supabase as any)
      .from('verification_requests')
      .select('*, profile:user_id(username, avatar_url, craft, trust_score)')
      .eq('status', 'pending');
    if (data) setVerificationRequests(data);
  };

  const fetchPlatformEvents = async () => {
    const { data } = await (supabase as any)
      .from('audit_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(5);
    if (data) setPlatformEvents(data);
  };

  useEffect(() => { setUserLimit(50); fetchUsers(); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userTypeFilter]);

  const fetchUsers = async () => {
    const term = searchQuery.trim().replace(/[%,()]/g, '');
    // profiles has no created_at column (the sign-up date lives in auth.users): newest activity first instead.
    // Asking for a column that does not exist made this whole query fail, so the list was always empty.
    let q = (supabase as any).from('profiles').select('id, username, full_name, avatar_url, account_type, is_verified, is_banned').order('updated_at', { ascending: false }).limit(userLimit);
    if (term) q = q.or(`username.ilike.%${term}%,full_name.ilike.%${term}%`);
    if (userTypeFilter !== 'all') q = q.eq('account_type', userTypeFilter);
    const { data, error } = await q;
    setUsersError(!!error);
    if (data) setUsers(data);
    setUsersLoaded(true);
  };

  const handleApproveVerification = async (id: string) => {
    const { error } = await (supabase as any).rpc('approve_verification', { _request_id: id });
    if (error) toast({ title: 'Error', description: friendlyError(error), variant: 'destructive' });
    else {
      toast({ title: 'Verification Approved' });
      fetchVerification();
    }
  };

  const handleRejectVerification = async (id: string, reason: string) => {
    const { error } = await (supabase as any).rpc('reject_verification', { _request_id: id, _reason: reason });
    if (error) toast({ title: 'Error', description: friendlyError(error), variant: 'destructive' });
    else {
      toast({ title: 'Verification Rejected' });
      fetchVerification();
    }
  };

  // many requests at once: each is saved on its own through the same functions as a single decision
  const handleBulkVerification = async (ids: string[], approve: boolean, reason: string) => {
    const result = await runBulk(ids, async (id) => {
      const { error } = approve
        ? await (supabase as any).rpc('approve_verification', { _request_id: id })
        : await (supabase as any).rpc('reject_verification', { _request_id: id, _reason: reason });
      return error ? friendlyError(error) : null;
    });
    fetchVerification();
    return result;
  };

  // saved views for the people list
  const [viewTick, setViewTick] = useState(0);
  const applyUserView = (raw: unknown) => {
    const o = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
    setUserTypeFilter((['all', 'fan', 'creator', 'studio'] as const).includes(o.type as any) ? (o.type as typeof userTypeFilter) : 'all');
    setSearchQuery(typeof o.query === 'string' ? o.query.slice(0, 80) : '');
    setViewTick((n) => n + 1);
  };
  useEffect(() => {
    if (viewTick === 0) return;
    setUserLimit(50);
    fetchUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewTick]);

  const runUserAction = async (userId: string, action: string, reason: string, days: number) => {
    setLoading(true);
    try {
      let result: any;
      switch (action) {
        case 'freeze':
          result = await (supabase as any).rpc('mute_user', { _target_user_id: userId, _duration_hours: 168, _reason: reason });
          break;
        case 'reset_password':
          result = await (supabase as any).rpc('force_password_reset_user', { _user_id: userId, _reason: reason });
          break;
        case 'logout':
          result = await (supabase as any).rpc('force_logout_user', { _user_id: userId, _reason: reason });
          break;
        case 'monetization':
          result = await (supabase as any).rpc('set_monetization_status', { _user_id: userId, _disabled: true, _reason: reason });
          break;
        case 'suspend':
          // a suspension waits for a second admin; the database does it when approved
          await GovernanceService.request({
            action: 'user.ban',
            targetType: 'user',
            targetId: userId,
            reason,
            payload: { days: days > 0 ? days : null },
          });
          toast({ title: 'Sent for second approval', description: 'A different admin must approve the suspension in the Moderation tab before it takes effect.' });
          fetchStats();
          return;
      }
      if (result?.error) {
        toast({ title: 'Operation Failed', description: friendlyError(result.error), variant: 'destructive' });
      } else {
        toast({ title: 'Success', description: `Applied ${action.replace('_', ' ')} successfully.` });
        fetchUsers();
      }
    } catch (e: any) {
      toast({ title: 'Operation Failed', description: friendlyError(e), variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleUnsuspend = async (userId: string) => {
    if (!await confirmDialog('Restore this account? They will be able to sign in again.')) return;
    setLoading(true);
    const { error } = await (supabase as any).rpc('restore_user_access', { target_user_id: userId });
    setLoading(false);
    if (error) toast({ title: 'Operation Failed', description: friendlyError(error), variant: 'destructive' });
    else { toast({ title: 'Account restored' }); fetchUsers(); }
  };

  const actionCopy: Record<string, { title: string; description: string; confirm: string; destructive?: boolean }> = {
    freeze: { title: 'Freeze this account for 7 days?', description: 'They cannot send messages for a week. They are told why.', confirm: 'Freeze account', destructive: true },
    reset_password: { title: 'Force a password reset?', description: 'They must set a new password the next time they sign in.', confirm: 'Force reset' },
    logout: { title: 'Sign this person out everywhere?', description: 'Every active session is ended.', confirm: 'Sign out everywhere' },
    monetization: { title: 'Turn off monetization?', description: 'They stop earning from the platform until it is turned back on.', confirm: 'Disable monetization', destructive: true },
    suspend: { title: 'Suspend this account?', description: 'Needs a second admin to approve. Once approved they cannot sign in, and they are told why and can appeal.', confirm: 'Request suspension', destructive: true },
  };

  return (
    <div className="min-h-dvh bg-background flex flex-col">
      <InternalHeader 
        title="Platform Operations Console" 
        subtitle="CineCraft Connect Infrastructure Control" 
        role="Admin" 
      />

      {loading && (
        <div className="fixed inset-0 bg-background/50 backdrop-blur-sm z-50 flex items-center justify-center">
          <LoadingSpinner size="lg" />
        </div>
      )}

      <main className="flex-1 p-8 max-w-7xl mx-auto w-full space-y-8">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <h1 className="text-2xl font-black text-foreground uppercase tracking-tight">Enterprise Controls</h1>
            <p className="text-xs text-muted-foreground font-medium">Manage platform health, identities, and business operations.</p>
          </div>

          <div className="flex items-center gap-3 bg-muted/30 p-1.5 rounded-2xl border border-border/50">
            <div className="flex items-center gap-2 px-4 border-r border-border/50">
              <div className={`w-2 h-2 rounded-full ${dbLatency === 'down' ? 'bg-red-500' : dbLatency === null ? 'bg-muted-foreground' : 'bg-emerald-500 animate-pulse'}`} />
              <span className="text-[12px] font-black uppercase tracking-widest text-foreground/70">
                {dbLatency === 'down' ? 'Database: not reachable' : dbLatency === null ? 'Database: checking' : `Database: ${dbLatency} ms`}
              </span>
            </div>
            <div className="flex items-center gap-2 px-4">
              <Shield className={`w-3.5 h-3.5 ${pendingApprovals ? 'text-amber-500' : 'text-blue-500'}`} />
              <span className="text-[12px] font-black uppercase tracking-widest text-foreground/70">
                {pendingApprovals === null ? 'Approvals: checking' : `Waiting for approval: ${pendingApprovals}`}
              </span>
            </div>
          </div>
        </div>

        <Tabs value={tab} onValueChange={setTab} className="w-full space-y-6">
          <ConsoleTabs active={tab}>
            <TabsTrigger value="operations" className="rounded-xl px-4 py-2.5 text-[13px] font-semibold gap-2 shrink-0 whitespace-nowrap data-[state=active]:bg-primary data-[state=active]:text-white transition-colors">
              <Activity className="w-4 h-4" /> Operations
            </TabsTrigger>
            <TabsTrigger value="verification" className="rounded-xl px-4 py-2.5 text-[13px] font-semibold gap-2 shrink-0 whitespace-nowrap data-[state=active]:bg-primary data-[state=active]:text-white transition-colors">
              <BadgeCheck className="w-4 h-4" /> Verification Queue
            </TabsTrigger>
            <TabsTrigger value="vendors" className="rounded-xl px-4 py-2.5 text-[13px] font-semibold gap-2 shrink-0 whitespace-nowrap data-[state=active]:bg-primary data-[state=active]:text-white transition-colors">
              <BadgeCheck className="w-4 h-4" /> Vendors & Pages
            </TabsTrigger>
            <TabsTrigger value="users" className="rounded-xl px-4 py-2.5 text-[13px] font-semibold gap-2 shrink-0 whitespace-nowrap data-[state=active]:bg-primary data-[state=active]:text-white transition-colors">
              <Users className="w-4 h-4" /> User Management
            </TabsTrigger>
            <TabsTrigger value="support" className="rounded-xl px-4 py-2.5 text-[13px] font-semibold gap-2 shrink-0 whitespace-nowrap data-[state=active]:bg-primary data-[state=active]:text-white transition-colors">
              <LifeBuoy className="w-4 h-4" /> Support & Appeals
            </TabsTrigger>
            <TabsTrigger value="moderation" className="rounded-xl px-4 py-2.5 text-[13px] font-semibold gap-2 shrink-0 whitespace-nowrap data-[state=active]:bg-primary data-[state=active]:text-white transition-colors">
              <ShieldAlert className="w-4 h-4" /> Moderation
            </TabsTrigger>
            <TabsTrigger value="access" className="rounded-xl px-4 py-2.5 text-[13px] font-semibold gap-2 shrink-0 whitespace-nowrap data-[state=active]:bg-primary data-[state=active]:text-white transition-colors">
              <LockIcon className="w-4 h-4" /> Access Requests
              {accessPending > 0 && <span className="ml-1 rounded-full bg-amber-500 text-white text-xs px-1.5 py-0.5 leading-none">{accessPending}</span>}
            </TabsTrigger>
            <TabsTrigger value="payments" className="rounded-xl px-4 py-2.5 text-[13px] font-semibold gap-2 shrink-0 whitespace-nowrap data-[state=active]:bg-primary data-[state=active]:text-white transition-colors">
              <PaymentsIcon className="w-4 h-4" /> Payments
            </TabsTrigger>
            <TabsTrigger value="safety" className="rounded-xl px-4 py-2.5 text-[13px] font-semibold gap-2 shrink-0 whitespace-nowrap data-[state=active]:bg-primary data-[state=active]:text-white transition-colors">
              <NetworkIcon className="w-4 h-4" /> Risk & Networks
            </TabsTrigger>
            <TabsTrigger value="disputes" className="rounded-xl px-4 py-2.5 text-[13px] font-semibold gap-2 shrink-0 whitespace-nowrap data-[state=active]:bg-primary data-[state=active]:text-white transition-colors">
              <DisputeIcon className="w-4 h-4" /> Marketplace Disputes
            </TabsTrigger>
            <TabsTrigger value="detection" className="rounded-xl px-4 py-2.5 text-[13px] font-semibold gap-2 shrink-0 whitespace-nowrap data-[state=active]:bg-primary data-[state=active]:text-white transition-colors">
              <DetectionIcon className="w-4 h-4" /> Detection & Workload
            </TabsTrigger>
            <TabsTrigger value="analytics" className="rounded-xl px-4 py-2.5 text-[13px] font-semibold gap-2 shrink-0 whitespace-nowrap data-[state=active]:bg-primary data-[state=active]:text-white transition-colors">
              <AnalyticsIcon className="w-4 h-4" /> Safety Analytics
            </TabsTrigger>
            <TabsTrigger value="audit" className="rounded-xl px-4 py-2.5 text-[13px] font-semibold gap-2 shrink-0 whitespace-nowrap data-[state=active]:bg-primary data-[state=active]:text-white transition-colors">
              <History className="w-4 h-4" /> Audit Log
            </TabsTrigger>
            <TabsTrigger value="oncall" className="rounded-xl px-4 py-2.5 text-[13px] font-semibold gap-2 shrink-0 whitespace-nowrap data-[state=active]:bg-primary data-[state=active]:text-white transition-colors">
              <OnCallIcon className="w-4 h-4" /> On call & Status
            </TabsTrigger>
          </ConsoleTabs>

          <TabsContent value="oncall" className="space-y-6 animate-in fade-in duration-100">
            <OnCallRota />
            <IncidentDesk />
            <DigestSettings />
          </TabsContent>

          <TabsContent value="operations" className="space-y-6 animate-in fade-in duration-100">
            <TeamStatsCards teams={['support', 'trust', 'finance', 'growth']} />
            <UserPlanStats />
            <StaffWorkload />
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[
                { label: 'Active users (last hour)', value: stats.active_sessions.toLocaleString(), icon: Users, color: 'text-blue-500', bg: 'bg-blue-500/10' },
                { label: 'Fraud Alerts', value: stats.fraud_alerts.toLocaleString(), icon: ShieldAlert, color: 'text-red-500', bg: 'bg-red-500/10' },
                { label: 'Pending Support', value: stats.pending_support.toLocaleString(), icon: LifeBuoy, color: 'text-amber-500', bg: 'bg-amber-500/10' },
              ].map((stat, i) => (
                <div key={i} className="glass-card p-6 border-border/50">
                  <div className={`w-10 h-10 ${stat.bg} rounded-xl flex items-center justify-center mb-4`}>
                    <stat.icon className={`w-5 h-5 ${stat.color}`} />
                  </div>
                  <p className="text-2xl font-black text-foreground">{stat.value}</p>
                  <p className="text-[12px] text-muted-foreground font-black uppercase tracking-widest mt-1">{stat.label}</p>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-3 glass-card p-6 border-border/50">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-sm font-black uppercase tracking-widest text-muted-foreground">Recent Platform Events</h3>
                  <Button variant="ghost" size="sm" className="text-xs font-bold" onClick={() => setTab('audit')}>View full audit log</Button>
                </div>
                <div className="space-y-4">
                  {platformEvents.length > 0 ? platformEvents.map((event, i) => (
                    <div key={event.id || i} className="flex items-center justify-between p-3 bg-muted/20 rounded-xl border border-border/30">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                          <Activity className="w-4 h-4 text-primary" />
                        </div>
                        <div>
                          <p className="text-xs font-bold">{event.action.replace(/_/g, ' ')}</p>
                          <p className="text-[12px] text-muted-foreground font-medium uppercase tracking-widest">
                            {event.actor_role} • {new Date(event.created_at).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                      </div>
                      <Badge variant="outline" className="text-[12px] border-emerald-500/20 text-emerald-500 font-black">LOGGED</Badge>
                    </div>
                  )) : (
                    <p className="text-sm text-muted-foreground italic text-center py-4">No recent events logged.</p>
                  )}
                </div>
              </div>

            </div>
          </TabsContent>

          <TabsContent value="verification" className="animate-in fade-in duration-100">
            <VerificationReview 
              requests={verificationRequests} 
              onApprove={handleApproveVerification} 
              onReject={handleRejectVerification}
              onRefresh={fetchVerification}
              onBulkDecide={handleBulkVerification}
            />
          </TabsContent>

          <TabsContent value="vendors" className="animate-in fade-in duration-100">
            <div className="space-y-10">
              <VendorVerificationQueue />
              <PageVerificationQueue />
            </div>
          </TabsContent>

          <TabsContent value="users" className="space-y-6 animate-in fade-in duration-100">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-black text-foreground uppercase tracking-tight">Identity Governance</h2>
              <div className="flex items-center gap-2 glass-card border border-border/50 px-4 py-2 w-full max-w-sm focus-within:ring-2 focus-within:ring-ring">
                <Search className="w-4 h-4 text-muted-foreground" />
                <input 
                  className="bg-transparent border-none outline-none text-xs font-medium flex-1" 
                  aria-label="Search users by username or name"
                  placeholder="Search by username or name, then press Enter"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { setUserLimit(50); fetchUsers(); } }}
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filter people by account type">
              {(['all', 'fan', 'creator', 'studio'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  aria-pressed={userTypeFilter === t}
                  onClick={() => setUserTypeFilter(t)}
                  className={`h-8 px-4 rounded-full text-xs font-bold border transition ${userTypeFilter === t ? 'bg-primary text-primary-foreground border-primary' : 'bg-muted/40 border-border text-muted-foreground hover:text-foreground'}`}
                >
                  {t === 'all' ? 'Everyone' : t === 'fan' ? 'Fans' : t === 'creator' ? 'Creators' : 'Studios'}
                </button>
              ))}
            </div>
            <SavedViewsBar
              scope="admin.users"
              current={{ type: userTypeFilter, query: searchQuery.trim() }}
              isDefault={userTypeFilter === 'all' && !searchQuery.trim()}
              onApply={applyUserView}
            />

            <div className="glass-card border-border/50 overflow-hidden">
              <div className="divide-y divide-border/30">
                {users.map(u => (
                  <div key={u.id} className="p-4 flex items-center justify-between hover:bg-muted/10 transition-colors">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center overflow-hidden border border-border/50">
                        {u.avatar_url ? <img loading="lazy" decoding="async" src={u.avatar_url} className="w-full h-full object-cover" alt="" /> : <Users className="w-5 h-5 text-muted-foreground" />}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-bold">@{u.username}</p>
                          {u.is_verified && <BadgeCheck className="w-3.5 h-3.5 text-primary" />}
                        </div>
                        <p className="text-[12px] text-muted-foreground font-medium">{u.full_name} • {u.account_type}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button variant="ghost" size="icon" className="w-11 h-11 md:w-8 md:h-8 rounded-lg" asChild>
                        <a href={`/profile/${u.id}`} target="_blank" rel="noreferrer" aria-label={`View profile of ${u.username || 'this user'}`}><Eye className="w-4 h-4" /></a>
                      </Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button aria-label="More options" variant="ghost" size="icon" className="w-11 h-11 md:w-8 md:h-8 rounded-lg">
                            <MoreVertical className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-56 p-2 rounded-xl">
                          <DropdownMenuItem onClick={() => setRecordUserId(u.id)} className="rounded-lg gap-2 text-xs font-bold">
                            <History className="w-3.5 h-3.5" /> View record &amp; strikes
                          </DropdownMenuItem>
                          <Separator className="my-1 opacity-50" />
                          <DropdownMenuItem onClick={() => setPendingAction({ user: u, action: 'freeze' })} className="rounded-lg gap-2 text-xs font-bold">
                            <Lock className="w-3.5 h-3.5" /> Freeze Account
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setPendingAction({ user: u, action: 'reset_password' })} className="rounded-lg gap-2 text-xs font-bold">
                            <Key className="w-3.5 h-3.5" /> Force Password Reset
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setPendingAction({ user: u, action: 'logout' })} className="rounded-lg gap-2 text-xs font-bold">
                            <RefreshCw className="w-3.5 h-3.5" /> Force Logout All
                          </DropdownMenuItem>
                          <Separator className="my-1 opacity-50" />
                          <DropdownMenuItem onClick={() => setPendingAction({ user: u, action: 'monetization' })} className="rounded-lg gap-2 text-xs font-bold text-orange-500">
                            <VolumeX className="w-3.5 h-3.5" /> Disable Monetization
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={() => (u.is_banned ? handleUnsuspend(u.id) : setPendingAction({ user: u, action: 'suspend' }))} 
                            className={`rounded-lg gap-2 text-xs font-bold ${u.is_banned ? 'text-emerald-600' : 'text-red-600'}`}
                          >
                            <Ban className="w-3.5 h-3.5" /> 
                            {u.is_banned ? 'Unsuspend Account' : 'Suspend Account'}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                ))}
              </div>
              {users.length >= userLimit && (
                <div className="p-3 text-center border-t border-border/30">
                  <Button variant="ghost" size="sm" onClick={() => setUserLimit((n) => n + 50)} className="text-xs font-bold">Load more people</Button>
                </div>
              )}
              {users.length === 0 && !usersLoaded && !usersError && (
                <p className="p-6 text-sm text-center text-muted-foreground" role="status">Loading people…</p>
              )}
              {users.length === 0 && (usersLoaded || usersError) && (
                <p className="p-6 text-sm text-center text-muted-foreground">
                  {usersError ? 'Could not load people. Try again in a moment.' : 'No one matches that search.'}
                </p>
              )}
            </div>
          </TabsContent>

          <TabsContent value="support" className="animate-in fade-in duration-100">
            <SupportTicketManager />
            <div className="mt-10">
              <AppealsQueue />
            </div>
          </TabsContent>

          <TabsContent value="access" className="animate-in fade-in duration-100">
            <AccessRequestsQueue onCount={setAccessPending} />
          </TabsContent>

          <TabsContent value="disputes" className="animate-in fade-in duration-100">
            <MarketplaceDisputesDesk />
          </TabsContent>

          <TabsContent value="detection" className="animate-in fade-in duration-100">
            <DetectionPanel />
          </TabsContent>

          <TabsContent value="analytics" className="animate-in fade-in duration-100">
            <SafetyAnalytics />
          </TabsContent>

          <TabsContent value="payments" className="animate-in fade-in duration-100">
            <PaymentsConsole />
          </TabsContent>

          <TabsContent value="safety" className="animate-in fade-in duration-100">
            <RiskAndNetworks onOpenUser={(id) => { setTab('users'); setRecordUserId(id); }} />
          </TabsContent>

          <TabsContent value="audit" className="space-y-8 animate-in fade-in duration-100">
            <ExportsPanel />
            <AuditLedger />
          </TabsContent>

          <TabsContent value="moderation" className="space-y-8 animate-in fade-in duration-100">
            <ReportTriageBoard />
            <ApprovalQueue />
            <GovernanceTuning />
            <TemplatesManager />
          </TabsContent>
        </Tabs>
      </main>

      <UserRecordDialog userId={recordUserId} onClose={() => setRecordUserId(null)} />

      <ReasonDialog
        open={!!pendingAction}
        title={pendingAction ? actionCopy[pendingAction.action].title : ''}
        description={pendingAction ? `@${pendingAction.user.username || pendingAction.user.id}. ${actionCopy[pendingAction.action].description}` : undefined}
        confirmLabel={pendingAction ? actionCopy[pendingAction.action].confirm : 'Confirm'}
        destructive={pendingAction ? !!actionCopy[pendingAction.action].destructive : false}
        durations={pendingAction?.action === 'suspend'
          ? [{ label: '7 days', days: 7 }, { label: '30 days', days: 30 }, { label: '90 days', days: 90 }, { label: 'Permanent', days: 0 }]
          : undefined}
        onCancel={() => setPendingAction(null)}
        onConfirm={async (reason, days) => {
          const current = pendingAction;
          setPendingAction(null);
          if (current) await runUserAction(current.user.id, current.action, reason, days);
        }}
      />
    </div>
  );
};

export default AdminDashboard;
