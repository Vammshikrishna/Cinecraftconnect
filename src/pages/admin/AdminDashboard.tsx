import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Users, Shield, CheckCircle, XCircle, Search, BadgeCheck,
  BarChart2, Flag, UserX, Eye, Trash2, VolumeX, UserCheck,
  Briefcase, ShoppingBag, RefreshCw, AlertTriangle, Crown,
  LayoutDashboard, ShieldAlert
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { useAppRole } from '@/hooks/useAppRole';
import AppLogo from '@/components/common/AppLogo';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import { useNavigate } from 'react-router-dom';

type Profile = {
  id: string; username: string | null; full_name: string | null;
  avatar_url: string | null; craft: string | null;
  account_type: string | null; is_verified: boolean | null;
  is_banned: boolean | null; onboarding_completed: boolean | null;
};

type VerificationRequest = {
  id: string; user_id: string; request_type: string;
  full_legal_name: string; reason: string; status: string;
  government_id_url?: string; supporting_doc_url?: string;
  social_links?: any;
  created_at: string; profile?: Profile;
};

type AuditLog = {
  id: string; actor_id: string; actor_role: string; action: string;
  target_type: string | null; target_id: string | null; created_at: string;
};

type Job = { id: string; title: string; company: string | null; created_at: string; };
type Listing = { id: string; title: string; category: string | null; created_at: string; };

const AdminDashboard = () => {
  const [activeTab, setActiveTab] = useState<'overview'|'users'|'verification'|'content'|'audit'>('overview');
  const [users, setUsers] = useState<Profile[]>([]);
  const [verificationRequests, setVerificationRequests] = useState<VerificationRequest[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [listings, setListings] = useState<Listing[]>([]);
  const [userSearch, setUserSearch] = useState('');
  const [stats, setStats] = useState({ total: 0, creators: 0, studios: 0, verified: 0, banned: 0, pending_verification: 0 });
  const [loading, setLoading] = useState(false);
  const { role: userRole } = useAppRole();
  const { toast } = useToast();
  const { user } = useAuth();
  const navigate = useNavigate();

  const fetchStats = async () => {
    const { data } = await (supabase as any).from('profiles').select('account_type, is_verified, is_banned');
    const { count: vCount } = await (supabase as any).from('verification_requests').select('id', { count: 'exact', head: true }).eq('status', 'pending');
    if (data) setStats({
      total: data.length,
      creators: data.filter((p: any) => p.account_type === 'creator' || p.account_type === 'talent').length,
      studios: data.filter((p: any) => p.account_type === 'studio').length,
      verified: data.filter((p: any) => p.is_verified).length,
      banned: data.filter((p: any) => p.is_banned).length,
      pending_verification: vCount || 0,
    });
  };

  const fetchUsers = async () => {
    setLoading(true);
    let q = (supabase as any).from('profiles')
      .select('id,username,full_name,avatar_url,craft,account_type,is_verified,is_banned,onboarding_completed')
      .order('username');
    if (userSearch) q = q.ilike('username', `%${userSearch}%`);
    const { data } = await q.limit(50);
    if (data) setUsers(data);
    setLoading(false);
  };

  const fetchVerification = async () => {
    setLoading(true);
    const { data } = await (supabase as any).from('verification_requests')
      .select(`*, profile:user_id(id,username,full_name,avatar_url,craft)`)
      .eq('status', 'pending').order('created_at', { ascending: true });
    if (data) setVerificationRequests(data);
    setLoading(false);
  };

  const fetchContent = async () => {
    setLoading(true);
    const [j, l] = await Promise.all([
      (supabase as any).from('jobs').select('id,title,company,created_at').order('created_at', { ascending: false }).limit(30),
      (supabase as any).from('marketplace_listings').select('id,title,category,created_at').order('created_at', { ascending: false }).limit(30),
    ]);
    if (j.data) setJobs(j.data);
    if (l.data) setListings(l.data);
    setLoading(false);
  };

  const fetchAuditLogs = async () => {
    setLoading(true);
    const { data } = await (supabase as any).from('audit_logs').select('*').order('created_at', { ascending: false }).limit(100);
    if (data) setAuditLogs(data);
    setLoading(false);
  };



  useEffect(() => {
    fetchStats();
    if (activeTab === 'users') fetchUsers();
    if (activeTab === 'verification') fetchVerification();
    if (activeTab === 'content') fetchContent();
    if (activeTab === 'audit') fetchAuditLogs();
  }, [activeTab, user]);

  useEffect(() => { if (activeTab === 'users') fetchUsers(); }, [userSearch]);

  const banUser = async (userId: string, username: string) => {
    const reason = prompt(`Ban reason for @${username}:`);
    if (!reason) return;
    const { error } = await (supabase as any).rpc('ban_user', {
      _target_user_id: userId, _reason: reason, _ban_type: 'temporary',
    });
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
    await (supabase as any).from('profiles').update({ is_banned: true }).eq('id', userId);
    toast({ title: `🚫 @${username} banned` });
    fetchUsers();
  };

  const unbanUser = async (userId: string, username: string) => {
    await (supabase as any).from('user_bans').update({ is_active: false, lifted_at: new Date().toISOString() }).eq('user_id', userId).eq('is_active', true);
    await (supabase as any).from('profiles').update({ is_banned: false }).eq('id', userId);
    toast({ title: `✅ @${username} unbanned` });
    fetchUsers();
  };

  const forceVerify = async (userId: string, username: string) => {
    await (supabase as any).from('profiles').update({ is_verified: true }).eq('id', userId);
    toast({ title: `✅ @${username} force-verified` });
    fetchUsers();
  };

  const approveVerification = async (id: string) => {
    const req = verificationRequests.find(r => r.id === id);
    const { error } = await (supabase as any).rpc('approve_verification', { _request_id: id });
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
    
    // Send Notification
    if (req) {
      await supabase.from('notifications').insert({
        user_id: req.user_id,
        type: 'verification_approved',
        title: '✅ Verification Approved',
        message: 'Congratulations! Your account has been verified and the badge is now active.',
        priority: 'high'
      });
    }

    toast({ title: '✅ Verification Approved' });
    fetchVerification(); fetchStats();
  };

  const rejectVerification = async (id: string) => {
    const reason = prompt('Rejection reason:');
    if (!reason) return;
    const req = verificationRequests.find(r => r.id === id);
    const { error } = await (supabase as any).rpc('reject_verification', { _request_id: id, _reason: reason });
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
    
    // Send Notification
    if (req) {
      await supabase.from('notifications').insert({
        user_id: req.user_id,
        type: 'verification_rejected',
        title: '❌ Verification Rejected',
        message: `Your verification request was rejected. Reason: ${reason}`,
        priority: 'high'
      });
    }

    toast({ title: 'Verification Rejected' });
    fetchVerification();
  };

  const deleteJob = async (id: string, title: string) => {
    if (!confirm(`Delete job: "${title}"?`)) return;
    await supabase.from('jobs').delete().eq('id', id);
    toast({ title: '🗑️ Job Deleted' });
    fetchContent();
  };

  const deleteListing = async (id: string, title: string) => {
    if (!confirm(`Delete listing: "${title}"?`)) return;
    await (supabase as any).from('marketplace_listings').delete().eq('id', id);
    toast({ title: '🗑️ Listing Deleted' });
    fetchContent();
  };

  const tabs = [
    { id: 'overview',      label: 'Overview',      icon: BarChart2  },
    { id: 'users',         label: 'Users',          icon: Users      },
    { id: 'verification',  label: 'Verification',   icon: BadgeCheck },
    { id: 'content',       label: 'Content',        icon: Flag       },
    { id: 'audit',         label: 'Audit Log',      icon: Eye        },
  ] as const;

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b border-border bg-card px-6 py-4 flex items-center gap-4 sticky top-0 z-50">
        <AppLogo size="sm" to="/feed" />
        <div className="w-px h-8 bg-border mx-2" />
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
            <Shield className="w-4 h-4 text-blue-500" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-foreground">Admin Dashboard</h1>
            <p className="text-xs text-muted-foreground">Platform Operations</p>
          </div>
        </div>
        <div className="ml-auto flex items-center gap-3">

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="icon" variant="ghost" className="w-8 h-8 rounded-xl bg-muted/50 border border-border/50 hover:bg-muted transition-all">
                <RefreshCw className="w-4 h-4 text-muted-foreground" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 rounded-2xl p-2 border-border shadow-2xl">
              <DropdownMenuLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground px-3 py-2">
                Governance Actions
              </DropdownMenuLabel>
              <DropdownMenuItem onClick={fetchStats} className="rounded-xl px-3 py-2 cursor-pointer gap-2">
                <RefreshCw className="w-4 h-4 text-blue-500" />
                <span className="font-bold text-sm">Refresh Stats</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator className="my-1 bg-border/50" />
              
              <DropdownMenuLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground px-3 py-2">
                Switch View
              </DropdownMenuLabel>
              <DropdownMenuItem onClick={() => navigate('/moderation')} className="rounded-xl px-3 py-2 cursor-pointer gap-2">
                <ShieldAlert className="w-4 h-4 text-amber-500" />
                <span className="font-bold text-sm">Moderation View</span>
              </DropdownMenuItem>
              
              <DropdownMenuItem onClick={() => navigate('/admin')} className="rounded-xl px-3 py-2 cursor-pointer gap-2 bg-blue-500/5 text-blue-600">
                <LayoutDashboard className="w-4 h-4" />
                <span className="font-bold text-sm">Admin Dashboard</span>
              </DropdownMenuItem>

              {userRole === 'super_admin' && (
                <DropdownMenuItem onClick={() => navigate('/super-admin')} className="rounded-xl px-3 py-2 cursor-pointer gap-2">
                  <Crown className="w-4 h-4 text-amber-600" />
                  <span className="font-bold text-sm">Super Admin</span>
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          <span className="text-xs bg-blue-500/10 border border-blue-500/20 text-blue-600 px-3 py-1 rounded-full font-bold uppercase">{userRole}</span>
        </div>
      </div>

      <div className="border-b border-border bg-card px-6">
        <div className="flex gap-1 overflow-x-auto scrollbar-hide">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => setActiveTab(id)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-bold whitespace-nowrap border-b-2 transition-colors ${
                activeTab === id ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}>
              <Icon className="w-4 h-4" />{label}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">

        {/* ── Overview ── */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            <h2 className="text-2xl font-black">Platform Overview</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              {[
                { label: 'Total Users',       value: stats.total,                icon: Users,      color: 'text-primary',         bg: 'bg-primary/10'     },
                { label: 'Creators',          value: stats.creators,             icon: Users,      color: 'text-sky-500',          bg: 'bg-sky-500/10'     },
                { label: 'Studios',           value: stats.studios,              icon: Shield,     color: 'text-violet-500',       bg: 'bg-violet-500/10'  },
                { label: 'Verified',          value: stats.verified,             icon: CheckCircle,color: 'text-green-500',        bg: 'bg-green-500/10'   },
                { label: 'Banned',            value: stats.banned,               icon: UserX,      color: 'text-red-500',          bg: 'bg-red-500/10'     },
                { label: 'Pending Verify',    value: stats.pending_verification, icon: BadgeCheck, color: 'text-amber-500',        bg: 'bg-amber-500/10'   },
              ].map(({ label, value, icon: Icon, color, bg }) => (
                <motion.div key={label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                  className="glass-card p-5 rounded-2xl border border-border/50">
                  <div className={`w-10 h-10 ${bg} rounded-xl flex items-center justify-center mb-3`}>
                    <Icon className={`w-5 h-5 ${color}`} />
                  </div>
                  <div className="text-2xl font-black">{value.toLocaleString()}</div>
                  <div className="text-xs text-muted-foreground">{label}</div>
                </motion.div>
              ))}
            </div>
            {/* Admin power chips */}
            <div className="glass-card p-4 rounded-2xl border border-border/50">
              <p className="text-xs font-black text-muted-foreground uppercase tracking-widest mb-3">Admin Powers</p>
              <div className="flex flex-wrap gap-2">
                {[
                  { l: 'Ban / Unban Users',      c: 'text-red-500 bg-red-500/10'         },
                  { l: 'Force Verify Users',      c: 'text-green-500 bg-green-500/10'     },
                  { l: 'Approve Verification',    c: 'text-blue-500 bg-blue-500/10'       },
                  { l: 'Delete Jobs',             c: 'text-rose-500 bg-rose-500/10'       },
                  { l: 'Delete Listings',         c: 'text-orange-500 bg-orange-500/10'   },
                  { l: 'View Audit Logs',         c: 'text-muted-foreground bg-muted'     },
                  { l: 'Manage All Users',        c: 'text-primary bg-primary/10'         },
                ].map(p => (
                  <span key={p.l} className={`px-3 py-1 rounded-full text-[11px] font-bold ${p.c}`}>{p.l}</span>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── Users ── */}
        {activeTab === 'users' && (
          <div>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-black">User Management</h2>
              <div className="flex items-center gap-2 glass-card border border-border rounded-xl px-3 py-2">
                <Search className="w-4 h-4 text-muted-foreground" />
                <input className="bg-transparent text-sm outline-none w-48 placeholder:text-muted-foreground"
                  placeholder="Search username…" value={userSearch} onChange={e => setUserSearch(e.target.value)} />
              </div>
            </div>
            <div className="glass-card rounded-2xl border border-border/50 overflow-hidden">
              <div className="divide-y divide-border">
                {loading ? <div className="p-8 text-center text-muted-foreground">Loading…</div>
                : users.map(user => (
                  <div key={user.id} className="p-4 flex items-center gap-4 hover:bg-muted/30 transition-colors">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden shrink-0">
                      {user.avatar_url ? <img src={user.avatar_url} alt="" className="w-full h-full object-cover" /> : <Users className="w-5 h-5 text-primary" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-bold">@{user.username ?? 'no-username'}</span>
                        {user.is_verified && <BadgeCheck className="w-4 h-4 text-primary" />}
                        {user.is_banned && <span className="text-[10px] bg-red-500/10 text-red-500 border border-red-500/20 px-2 py-0.5 rounded-full font-bold">BANNED</span>}
                      </div>
                      <p className="text-xs text-muted-foreground">{user.full_name} · {user.craft ?? 'No craft'} · {user.account_type}</p>
                    </div>
                    <div className="flex gap-2 flex-wrap justify-end">
                      <Button size="sm" variant="ghost" className="text-xs h-8" asChild>
                        <a href={`/profile/${user.id}`} target="_blank" rel="noreferrer"><Eye className="w-3 h-3 mr-1" />View</a>
                      </Button>
                      {!user.is_verified && (
                        <Button size="sm" variant="outline" className="text-xs h-8 border-green-500/30 text-green-600 hover:bg-green-500/10"
                          onClick={() => forceVerify(user.id, user.username ?? '')}>
                          <UserCheck className="w-3 h-3 mr-1" />Verify
                        </Button>
                      )}
                      {user.is_banned ? (
                        <Button size="sm" variant="outline" className="text-xs h-8 border-blue-500/30 text-blue-500 hover:bg-blue-500/10"
                          onClick={() => unbanUser(user.id, user.username ?? '')}>
                          <CheckCircle className="w-3 h-3 mr-1" />Unban
                        </Button>
                      ) : (
                        <Button size="sm" variant="outline" className="text-xs h-8 border-red-500/30 text-red-500 hover:bg-red-500/10"
                          onClick={() => banUser(user.id, user.username ?? '')}>
                          <VolumeX className="w-3 h-3 mr-1" />Ban
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── Verification ── */}
        {activeTab === 'verification' && (
          <div>
            <h2 className="text-2xl font-black mb-6">Verification Queue</h2>
            <div className="glass-card rounded-2xl border border-border/50 overflow-hidden">
              {loading ? <div className="p-8 text-center text-muted-foreground">Loading…</div>
              : verificationRequests.length === 0 ? (
                <div className="p-12 text-center">
                  <BadgeCheck className="w-12 h-12 text-green-500 mx-auto mb-3 opacity-60" />
                  <p className="text-muted-foreground">No pending verification requests.</p>
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {verificationRequests.map(req => (
                    <div key={req.id} className="p-5">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-sm font-bold">{req.full_legal_name}</span>
                            <span className="text-[10px] bg-primary/10 text-primary border border-primary/20 px-2 py-0.5 rounded-full font-bold uppercase">{req.request_type}</span>
                          </div>
                          <p className="text-xs text-muted-foreground mb-2">@{(req.profile as Profile)?.username ?? 'unknown'}</p>
                          <p className="text-sm text-foreground/80 mb-3">{req.reason}</p>
                          
                          {/* Attachments Section */}
                          <div className="flex flex-wrap gap-3 mb-3">
                            {req.government_id_url && (
                              <a href={req.government_id_url} target="_blank" rel="noreferrer" 
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-muted text-[11px] font-bold hover:bg-primary/10 hover:text-primary transition-all border border-border">
                                <Shield className="w-3.5 h-3.5" /> View ID Document
                              </a>
                            )}
                            {req.supporting_doc_url && (
                              <a href={req.supporting_doc_url} target="_blank" rel="noreferrer" 
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-muted text-[11px] font-bold hover:bg-primary/10 hover:text-primary transition-all border border-border">
                                <Briefcase className="w-3.5 h-3.5" /> Supporting Document
                              </a>
                            )}
                            <a href={`/profile/${req.user_id}`} target="_blank" rel="noreferrer" 
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-muted text-[11px] font-bold hover:bg-primary/10 hover:text-primary transition-all border border-border">
                              <Users className="w-3.5 h-3.5" /> View Profile
                            </a>
                          </div>

                          {req.social_links && Object.keys(req.social_links).length > 0 && (
                            <div className="flex gap-2 mb-3">
                              {Object.entries(req.social_links).map(([platform, link]: [string, any]) => (
                                link && (
                                  <a key={platform} href={link} target="_blank" rel="noreferrer" 
                                    className="text-[10px] uppercase font-black tracking-widest text-primary/60 hover:text-primary">
                                    {platform}
                                  </a>
                                )
                              ))}
                            </div>
                          )}

                          <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-medium">Submitted {new Date(req.created_at).toLocaleDateString()}</p>
                        </div>
                        <div className="flex gap-2 shrink-0">
                          <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white text-xs" onClick={() => approveVerification(req.id)}>
                            <CheckCircle className="w-3 h-3 mr-1" />Approve
                          </Button>
                          <Button size="sm" variant="outline" className="text-xs border-red-500/30 text-red-500 hover:bg-red-500/10" onClick={() => rejectVerification(req.id)}>
                            <XCircle className="w-3 h-3 mr-1" />Reject
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Content Management ── */}
        {activeTab === 'content' && (
          <div className="space-y-8">
            <div>
              <h2 className="text-2xl font-black mb-2 flex items-center gap-2"><Briefcase className="w-6 h-6 text-primary"/>Job Listings</h2>
              <div className="glass-card rounded-2xl border border-border/50 overflow-hidden">
                {loading ? <div className="p-8 text-center text-muted-foreground">Loading…</div>
                : jobs.length === 0 ? <div className="p-8 text-center text-muted-foreground">No jobs found.</div>
                : <div className="divide-y divide-border">
                    {jobs.map(job => (
                      <div key={job.id} className="p-4 flex items-center gap-4 hover:bg-muted/30 transition-colors">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold truncate">{job.title}</p>
                          <p className="text-xs text-muted-foreground">{job.company} · {new Date(job.created_at).toLocaleDateString()}</p>
                        </div>
                        <div className="flex gap-2">
                          <Button size="sm" variant="ghost" className="text-xs h-8" asChild>
                            <a href={`/jobs/${job.id}`} target="_blank" rel="noreferrer"><Eye className="w-3 h-3 mr-1"/>View</a>
                          </Button>
                          <Button size="sm" variant="outline" className="text-xs h-8 border-red-500/30 text-red-500 hover:bg-red-500/10"
                            onClick={() => deleteJob(job.id, job.title)}>
                            <Trash2 className="w-3 h-3 mr-1"/>Delete
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                }
              </div>
            </div>

            <div>
              <h2 className="text-2xl font-black mb-2 flex items-center gap-2"><ShoppingBag className="w-6 h-6 text-primary"/>Marketplace Listings</h2>
              <div className="glass-card rounded-2xl border border-border/50 overflow-hidden">
                {loading ? <div className="p-8 text-center text-muted-foreground">Loading…</div>
                : listings.length === 0 ? <div className="p-8 text-center text-muted-foreground">No listings found.</div>
                : <div className="divide-y divide-border">
                    {listings.map(listing => (
                      <div key={listing.id} className="p-4 flex items-center gap-4 hover:bg-muted/30 transition-colors">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold truncate">{listing.title}</p>
                          <p className="text-xs text-muted-foreground">{listing.category} · {new Date(listing.created_at).toLocaleDateString()}</p>
                        </div>
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline" className="text-xs h-8 border-red-500/30 text-red-500 hover:bg-red-500/10"
                            onClick={() => deleteListing(listing.id, listing.title)}>
                            <Trash2 className="w-3 h-3 mr-1"/>Delete
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                }
              </div>
            </div>
          </div>
        )}

        {/* ── Audit Log ── */}
        {activeTab === 'audit' && (
          <div>
            <h2 className="text-2xl font-black mb-6">Audit Log</h2>
            <div className="glass-card rounded-2xl border border-border/50 overflow-hidden">
              {loading ? <div className="p-8 text-center text-muted-foreground">Loading…</div>
              : auditLogs.length === 0 ? <div className="p-12 text-center text-muted-foreground">No audit logs yet.</div>
              : <div className="divide-y divide-border">
                  {auditLogs.map(log => (
                    <div key={log.id} className="p-4 flex items-start gap-4">
                      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                        <AlertTriangle className="w-4 h-4 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className="text-xs font-bold uppercase tracking-wide">{log.action.replace(/_/g, ' ')}</span>
                          <span className="text-[10px] bg-muted text-muted-foreground px-2 py-0.5 rounded-full">{log.actor_role}</span>
                          {log.target_type && <span className="text-xs text-muted-foreground">→ {log.target_type}</span>}
                        </div>
                        <p className="text-xs text-muted-foreground font-mono">
                          Actor: {log.actor_id?.slice(0, 8) ?? 'system'} · {new Date(log.created_at).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              }
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default AdminDashboard;
