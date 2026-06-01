import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import InternalHeader from '@/components/internal/shared/InternalHeader';
import VerificationReview from '@/components/internal/admin/VerificationReview';
import ReportTriageBoard from '@/components/internal/moderator/ReportTriageBoard';
import { 
  Users, BadgeCheck, Activity, CreditCard, 
  LifeBuoy, ShieldAlert, BarChart3, Search,
  Lock, Key, VolumeX, Ban, RefreshCw,
  MoreVertical, Shield, Eye
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SupportTicketManager } from '@/components/internal/admin/SupportTicketManager';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";

const AdminDashboard = () => {
  const [verificationRequests, setVerificationRequests] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const [stats, setStats] = useState({
    active_sessions: 0,
    fraud_alerts: 0,
    revenue_mtd: 42800.50,
    pending_support: 0
  });

  useEffect(() => {
    fetchData();

    // Subscribe to real-time changes
    const channel = supabase
      .channel('admin-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'verification_requests' }, () => fetchVerification())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => { fetchUsers(); fetchStats(); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'content_reports' }, () => fetchStats())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'support_tickets' }, () => fetchStats())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchData = async () => {
    setLoading(true);
    await Promise.all([fetchUsers(), fetchVerification(), fetchStats()]);
    setLoading(false);
  };

  const fetchStats = async () => {
    const { data } = await (supabase as any).rpc('get_admin_stats');
    if (data) setStats(data);
  };

  const fetchVerification = async () => {
    const { data } = await (supabase as any)
      .from('verification_requests')
      .select('*, profile:user_id(username, avatar_url, craft)')
      .eq('status', 'pending');
    if (data) setVerificationRequests(data);
  };

  const fetchUsers = async () => {
    let q = (supabase as any).from('profiles').select('id, username, full_name, avatar_url, account_type, is_verified, is_banned').limit(50);
    if (searchQuery) q = q.ilike('username', `%${searchQuery}%`);
    const { data } = await q;
    if (data) setUsers(data);
  };

  const handleApproveVerification = async (id: string) => {
    const { error } = await (supabase as any).rpc('approve_verification', { _request_id: id });
    if (error) toast({ title: 'Error', description: error.message, variant: 'destructive' });
    else {
      toast({ title: 'Verification Approved' });
      fetchVerification();
    }
  };

  const handleRejectVerification = async (id: string, reason: string) => {
    const { error } = await (supabase as any).rpc('reject_verification', { _request_id: id, _reason: reason });
    if (error) toast({ title: 'Error', description: error.message, variant: 'destructive' });
    else {
      toast({ title: 'Verification Rejected' });
      fetchVerification();
    }
  };

  const handleUserAction = async (userId: string, action: string) => {
    setLoading(true);
    try {
      let result;
      
      switch (action) {
        case 'freeze':
          result = await (supabase as any).rpc('mute_user', { _target_user_id: userId, _duration_hours: 168, _reason: 'Administrative account freeze' });
          break;
        case 'reset_password':
          result = await (supabase as any).rpc('force_password_reset_user', { _user_id: userId, _reason: 'Administrative password reset' });
          break;
        case 'logout':
          result = await (supabase as any).rpc('force_logout_user', { _user_id: userId, _reason: 'Administrative session revocation' });
          break;
        case 'monetization':
          result = await (supabase as any).rpc('set_monetization_status', { _user_id: userId, _disabled: true, _reason: 'Administrative monetization restriction' });
          break;
        case 'suspend':
          result = await (supabase as any).rpc('ban_user', { 
            _target_user_id: userId, 
            _reason: 'Administrative suspension',
            _ban_type: 'permanent',
            _expires_at: null
          });
          break;
        case 'restore_access':
          result = await (supabase as any).rpc('restore_user_access', { 
            target_user_id: userId 
          });
          break;
      }

      if (result?.error) {
        toast({ title: 'Operation Failed', description: result.error.message, variant: 'destructive' });
      } else {
        toast({ title: 'Success', description: `Applied ${action.replace('_', ' ')} successfully.` });
        fetchUsers();
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
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
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[10px] font-black uppercase tracking-widest text-foreground/70">API Status: Optimal</span>
            </div>
            <div className="flex items-center gap-2 px-4">
              <Shield className="w-3.5 h-3.5 text-blue-500" />
              <span className="text-[10px] font-black uppercase tracking-widest text-foreground/70">Security: Level 4</span>
            </div>
          </div>
        </div>

        <Tabs defaultValue="operations" className="w-full space-y-6">
          <TabsList className="bg-muted/50 p-1.5 rounded-2xl border border-border/50 h-auto gap-1">
            <TabsTrigger value="operations" className="rounded-xl px-6 py-2.5 text-xs font-bold gap-2 data-[state=active]:bg-primary data-[state=active]:text-white transition-all">
              <Activity className="w-4 h-4" /> Operations
            </TabsTrigger>
            <TabsTrigger value="verification" className="rounded-xl px-6 py-2.5 text-xs font-bold gap-2 data-[state=active]:bg-primary data-[state=active]:text-white transition-all">
              <BadgeCheck className="w-4 h-4" /> Verification Queue
            </TabsTrigger>
            <TabsTrigger value="users" className="rounded-xl px-6 py-2.5 text-xs font-bold gap-2 data-[state=active]:bg-primary data-[state=active]:text-white transition-all">
              <Users className="w-4 h-4" /> User Management
            </TabsTrigger>
            <TabsTrigger value="billing" className="rounded-xl px-6 py-2.5 text-xs font-bold gap-2 data-[state=active]:bg-primary data-[state=active]:text-white transition-all">
              <CreditCard className="w-4 h-4" /> Billing & Subs
            </TabsTrigger>
            <TabsTrigger value="support" className="rounded-xl px-6 py-2.5 text-xs font-bold gap-2 data-[state=active]:bg-primary data-[state=active]:text-white transition-all">
              <LifeBuoy className="w-4 h-4" /> Support & Appeals
            </TabsTrigger>
            <TabsTrigger value="moderation" className="rounded-xl px-6 py-2.5 text-xs font-bold gap-2 data-[state=active]:bg-primary data-[state=active]:text-white transition-all">
              <ShieldAlert className="w-4 h-4" /> Moderation
            </TabsTrigger>
          </TabsList>

          <TabsContent value="operations" className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { label: 'Active Sessions', value: stats.active_sessions.toLocaleString(), icon: Users, color: 'text-blue-500', bg: 'bg-blue-500/10' },
                { label: 'Fraud Alerts', value: stats.fraud_alerts.toLocaleString(), icon: ShieldAlert, color: 'text-red-500', bg: 'bg-red-500/10' },
                { label: 'Revenue (MTD)', value: `$${stats.revenue_mtd.toLocaleString()}`, icon: BarChart3, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
                { label: 'Pending Support', value: stats.pending_support.toLocaleString(), icon: LifeBuoy, color: 'text-amber-500', bg: 'bg-amber-500/10' },
              ].map((stat, i) => (
                <div key={i} className="glass-card p-6 border-border/50">
                  <div className={`w-10 h-10 ${stat.bg} rounded-xl flex items-center justify-center mb-4`}>
                    <stat.icon className={`w-5 h-5 ${stat.color}`} />
                  </div>
                  <p className="text-2xl font-black text-foreground">{stat.value}</p>
                  <p className="text-[10px] text-muted-foreground font-black uppercase tracking-widest mt-1">{stat.label}</p>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 glass-card p-6 border-border/50">
                <h3 className="text-sm font-black uppercase tracking-widest text-muted-foreground mb-6">Recent Platform Events</h3>
                <div className="space-y-4">
                  {[1, 2, 3, 4, 5].map((_, i) => (
                    <div key={i} className="flex items-center justify-between p-3 bg-muted/20 rounded-xl border border-border/30">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                          <Activity className="w-4 h-4 text-primary" />
                        </div>
                        <div>
                          <p className="text-xs font-bold">System Health Check Passed</p>
                          <p className="text-[9px] text-muted-foreground font-medium uppercase tracking-widest">Global Edge Nodes • 2m ago</p>
                        </div>
                      </div>
                      <Badge variant="outline" className="text-[9px] border-emerald-500/20 text-emerald-500 font-black">OK</Badge>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-6">
                <div className="glass-card p-6 border-border/50 bg-primary/5">
                  <h3 className="text-sm font-black uppercase tracking-widest text-primary mb-4">Operational Status</h3>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-foreground/70">Social Engine</span>
                      <span className="text-emerald-500 font-black">STABLE</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-foreground/70">Payment Gateway</span>
                      <span className="text-emerald-500 font-black">STABLE</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-foreground/70">Media Storage</span>
                      <span className="text-amber-500 font-black">LATENCY</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-foreground/70">Auth Service</span>
                      <span className="text-emerald-500 font-black">STABLE</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="verification" className="animate-in fade-in slide-in-from-bottom-4">
            <VerificationReview 
              requests={verificationRequests} 
              onApprove={handleApproveVerification} 
              onReject={handleRejectVerification}
              onRefresh={fetchVerification}
            />
          </TabsContent>

          <TabsContent value="users" className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-black text-foreground uppercase tracking-tight">Identity Governance</h2>
              <div className="flex items-center gap-2 glass-card border border-border/50 px-4 py-2 w-96">
                <Search className="w-4 h-4 text-muted-foreground" />
                <input 
                  className="bg-transparent border-none outline-none text-xs font-medium flex-1" 
                  placeholder="Search by username, email, or profile ID..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && fetchUsers()}
                />
              </div>
            </div>

            <div className="glass-card border-border/50 overflow-hidden">
              <div className="divide-y divide-border/30">
                {users.map(u => (
                  <div key={u.id} className="p-4 flex items-center justify-between hover:bg-muted/10 transition-colors">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center overflow-hidden border border-border/50">
                        {u.avatar_url ? <img src={u.avatar_url} className="w-full h-full object-cover" alt="" /> : <Users className="w-5 h-5 text-muted-foreground" />}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-bold">@{u.username}</p>
                          {u.is_verified && <BadgeCheck className="w-3.5 h-3.5 text-primary" />}
                        </div>
                        <p className="text-[10px] text-muted-foreground font-medium">{u.full_name} • {u.account_type}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button variant="ghost" size="icon" className="w-8 h-8 rounded-lg" asChild>
                        <a href={`/profile/${u.id}`} target="_blank" rel="noreferrer"><Eye className="w-4 h-4" /></a>
                      </Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="w-8 h-8 rounded-lg">
                            <MoreVertical className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-56 p-2 rounded-xl">
                          <DropdownMenuItem onClick={() => handleUserAction(u.id, 'freeze')} className="rounded-lg gap-2 text-xs font-bold">
                            <Lock className="w-3.5 h-3.5" /> Freeze Account
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleUserAction(u.id, 'reset_password')} className="rounded-lg gap-2 text-xs font-bold">
                            <Key className="w-3.5 h-3.5" /> Force Password Reset
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleUserAction(u.id, 'logout')} className="rounded-lg gap-2 text-xs font-bold">
                            <RefreshCw className="w-3.5 h-3.5" /> Force Logout All
                          </DropdownMenuItem>
                          <Separator className="my-1 opacity-50" />
                          <DropdownMenuItem onClick={() => handleUserAction(u.id, 'monetization')} className="rounded-lg gap-2 text-xs font-bold text-orange-500">
                            <VolumeX className="w-3.5 h-3.5" /> Disable Monetization
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={() => handleUserAction(u.id, u.is_banned ? 'restore_access' : 'suspend')} 
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
            </div>
          </TabsContent>

          <TabsContent value="support" className="animate-in fade-in slide-in-from-bottom-4">
            <SupportTicketManager />
          </TabsContent>

          <TabsContent value="moderation" className="animate-in fade-in slide-in-from-bottom-4">
            <ReportTriageBoard />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default AdminDashboard;
