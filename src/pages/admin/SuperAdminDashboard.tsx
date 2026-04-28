import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Crown, Users, Shield, ToggleLeft, AlertTriangle, Search,
  Zap, Lock, ChevronRight, UserPlus, UserMinus, RefreshCw,
  Trash2, MessageSquare, Settings, BarChart2, Database, LayoutDashboard, ShieldAlert
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import AppLogo from '@/components/common/AppLogo';
import { useNavigate } from 'react-router-dom';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';

type PlatformFlag = { id: string; key: string; value: boolean; description: string | null; updated_at: string; };
type StaffMember = { id: string; username: string | null; full_name: string | null; avatar_url: string | null; craft: string | null; role: string; };
type Profile = { id: string; username: string | null; full_name: string | null; avatar_url: string | null; craft: string | null; };
type PlatformStat = { label: string; value: number; icon: React.ElementType; color: string; bg: string; };

const ROLE_COLORS: Record<string, string> = {
  super_admin: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
  admin: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
  moderator: 'bg-purple-500/10 text-purple-500 border-purple-500/20',
};

const SuperAdminDashboard = () => {
  const [activeTab, setActiveTab] = useState<'overview'|'roles'|'flags'|'promote'|'stats'>('overview');
  const [flags, setFlags] = useState<PlatformFlag[]>([]);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [promoteSearch, setPromoteSearch] = useState('');
  const [promoteResults, setPromoteResults] = useState<Profile[]>([]);
  const [selectedRole, setSelectedRole] = useState<'moderator'|'admin'|'super_admin'>('moderator');
  const [platformStats, setPlatformStats] = useState<PlatformStat[]>([]);
  const [loading, setLoading] = useState(false);
  const [newFlagKey, setNewFlagKey] = useState('');
  const [newFlagDesc, setNewFlagDesc] = useState('');

  const { toast } = useToast();
  const navigate = useNavigate();

  const fetchFlags = async () => {
    const { data } = await (supabase as any).from('platform_flags').select('*').order('key');
    if (data) setFlags(data);
  };

  const fetchStaff = async () => {
    setLoading(true);
    const { data } = await (supabase as any).from('user_roles')
      .select(`role, profile:user_id(id, username, full_name, avatar_url, craft)`)
      .neq('role', 'user').order('role');
    if (data) setStaff(data.map((r: any) => ({ ...r.profile, role: r.role })));
    setLoading(false);
  };

  const fetchPlatformStats = async () => {
    setLoading(true);
    const [profiles, posts, jobs, listings, rooms, reports] = await Promise.all([
      supabase.from('profiles').select('id', { count: 'exact', head: true }),
      supabase.from('posts').select('id', { count: 'exact', head: true }),
      supabase.from('jobs').select('id', { count: 'exact', head: true }),
      (supabase as any).from('marketplace_listings').select('id', { count: 'exact', head: true }),
      supabase.from('discussion_rooms').select('id', { count: 'exact', head: true }),
      (supabase as any).from('content_reports').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    ]);
    setPlatformStats([
      { label: 'Total Users',    value: profiles.count || 0, icon: Users,         color: 'text-primary',       bg: 'bg-primary/10'     },
      { label: 'Total Posts',    value: posts.count || 0,    icon: MessageSquare, color: 'text-blue-500',      bg: 'bg-blue-500/10'    },
      { label: 'Active Jobs',    value: jobs.count || 0,     icon: Database,      color: 'text-green-500',     bg: 'bg-green-500/10'   },
      { label: 'Listings',       value: listings.count || 0, icon: Settings,      color: 'text-violet-500',    bg: 'bg-violet-500/10'  },
      { label: 'Discussion Rooms', value: rooms.count || 0,  icon: BarChart2,     color: 'text-sky-500',       bg: 'bg-sky-500/10'     },
      { label: 'Pending Reports', value: reports.count || 0, icon: AlertTriangle, color: 'text-amber-500',     bg: 'bg-amber-500/10'   },
    ]);
    setLoading(false);
  };

  const searchUsers = async () => {
    if (!promoteSearch.trim()) { setPromoteResults([]); return; }
    const { data } = await supabase.from('profiles').select('id, username, full_name, avatar_url, craft')
      .ilike('username', `%${promoteSearch}%`).limit(10);
    if (data) setPromoteResults(data as Profile[]);
  };

  useEffect(() => {
    fetchFlags();
    if (activeTab === 'roles') fetchStaff();
    if (activeTab === 'stats') fetchPlatformStats();
  }, [activeTab]);

  useEffect(() => { searchUsers(); }, [promoteSearch]);

  const toggleFlag = async (flag: PlatformFlag) => {
    const { error } = await (supabase as any).from('platform_flags')
      .update({ value: !flag.value, updated_at: new Date().toISOString() }).eq('id', flag.id);
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
    toast({ title: `Flag "${flag.key}" ${!flag.value ? '✅ enabled' : '❌ disabled'}` });
    fetchFlags();
  };

  const createFlag = async () => {
    if (!newFlagKey.trim()) return;
    const { error } = await (supabase as any).from('platform_flags').insert({ key: newFlagKey.trim(), value: false, description: newFlagDesc.trim() || null });
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
    toast({ title: `Flag "${newFlagKey}" created` });
    setNewFlagKey(''); setNewFlagDesc('');
    fetchFlags();
  };

  const deleteFlag = async (id: string, key: string) => {
    if (!confirm(`Delete flag "${key}"?`)) return;
    await (supabase as any).from('platform_flags').delete().eq('id', id);
    toast({ title: `Flag "${key}" deleted` });
    fetchFlags();
  };

  const promoteUser = async (userId: string) => {
    const { error } = await (supabase as any).rpc('assign_user_role', { _target_user_id: userId, _role: selectedRole });
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
    const user = promoteResults.find(u => u.id === userId);
    toast({ title: `✅ @${user?.username} → ${selectedRole}` });
    setPromoteSearch(''); setPromoteResults([]);
    fetchStaff();
  };

  const revokeRole = async (userId: string, username: string) => {
    if (!confirm(`Revoke role from @${username}?`)) return;
    const { error } = await (supabase as any).rpc('revoke_user_role', { _target_user_id: userId });
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
    toast({ title: `Role revoked from @${username}` });
    fetchStaff();
  };

  const deleteAllUserContent = async (userId: string, username: string) => {
    if (!confirm(`DANGER: Delete ALL posts by @${username}? This cannot be undone.`)) return;
    await supabase.from('posts').delete().eq('user_id', userId);
    toast({ title: `🗑️ All posts by @${username} deleted` });
  };

  const tabs = [
    { id: 'overview', label: 'Overview',       icon: Crown      },
    { id: 'stats',    label: 'Platform Stats', icon: BarChart2  },
    { id: 'roles',    label: 'Staff & Roles',  icon: Shield     },
    { id: 'flags',    label: 'Feature Flags',  icon: ToggleLeft },
    { id: 'promote',  label: 'Promote User',   icon: UserPlus   },
  ] as const;

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b border-border bg-card px-6 py-4 flex items-center gap-4 sticky top-0 z-50">
        <AppLogo size="sm" to="/feed" />
        <div className="w-px h-8 bg-border mx-2" />
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center">
            <Crown className="w-4 h-4 text-amber-500" />
          </div>
          <div>
            <h1 className="text-sm font-bold">Super Admin</h1>
            <p className="text-xs text-muted-foreground">Root Platform Governance</p>
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
              <DropdownMenuItem onClick={fetchFlags} className="rounded-xl px-3 py-2 cursor-pointer gap-2">
                <RefreshCw className="w-4 h-4 text-amber-500" />
                <span className="font-bold text-sm">Refresh System</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator className="my-1 bg-border/50" />
              
              <DropdownMenuLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground px-3 py-2">
                Switch View
              </DropdownMenuLabel>
              <DropdownMenuItem onClick={() => navigate('/moderation')} className="rounded-xl px-3 py-2 cursor-pointer gap-2">
                <ShieldAlert className="w-4 h-4 text-amber-500" />
                <span className="font-bold text-sm">Moderation View</span>
              </DropdownMenuItem>
              
              <DropdownMenuItem onClick={() => navigate('/admin')} className="rounded-xl px-3 py-2 cursor-pointer gap-2">
                <LayoutDashboard className="w-4 h-4 text-blue-500" />
                <span className="font-bold text-sm">Admin Dashboard</span>
              </DropdownMenuItem>

              <DropdownMenuItem onClick={() => navigate('/super-admin')} className="rounded-xl px-3 py-2 cursor-pointer gap-2 bg-amber-500/5 text-amber-600">
                <Crown className="w-4 h-4" />
                <span className="font-bold text-sm">Super Admin</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <span className="text-xs bg-amber-500/10 border border-amber-500/20 text-amber-600 px-3 py-1 rounded-full font-bold">SUPER ADMIN</span>
        </div>
      </div>

      <div className="bg-amber-500/5 border-b border-amber-500/20 px-6 py-2 flex items-center gap-2">
        <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
        <p className="text-xs text-amber-600 font-medium">Root authority. All actions are logged and auditable.</p>
      </div>

      <div className="border-b border-border bg-card px-6">
        <div className="flex gap-1 overflow-x-auto scrollbar-hide">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => setActiveTab(id)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-bold whitespace-nowrap border-b-2 transition-colors ${
                activeTab === id ? 'border-amber-500 text-amber-500' : 'border-transparent text-muted-foreground hover:text-foreground'}`}>
              <Icon className="w-4 h-4" />{label}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-8">

        {/* ── Overview ── */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-black">Root Governance Panel</h2>
              <p className="text-muted-foreground mt-1 text-sm">Full ecosystem control for CineCraft Connect.</p>
            </div>
            <div className="grid md:grid-cols-3 gap-4">
              {[
                { label: 'Platform Stats',    desc: 'Full visibility into every number', tab: 'stats',   icon: BarChart2,  color: 'text-primary',      bg: 'bg-primary/10'   },
                { label: 'Promote Users',     desc: 'Assign moderator/admin/super_admin', tab: 'promote', icon: UserPlus,   color: 'text-amber-500',    bg: 'bg-amber-500/10' },
                { label: 'Feature Flags',     desc: 'Enable/disable platform features',  tab: 'flags',   icon: ToggleLeft, color: 'text-green-500',    bg: 'bg-green-500/10' },
                { label: 'Manage Staff',      desc: 'View and revoke staff roles',        tab: 'roles',   icon: Shield,     color: 'text-blue-500',     bg: 'bg-blue-500/10'  },
              ].map(({ label, desc, tab, icon: Icon, color, bg }) => (
                <motion.button key={tab} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                  onClick={() => setActiveTab(tab as typeof activeTab)}
                  className="glass-card p-6 rounded-2xl border border-border/50 text-left hover:border-primary/30 transition-colors group">
                  <div className={`w-12 h-12 ${bg} rounded-xl flex items-center justify-center mb-4 group-hover:scale-105 transition-transform`}>
                    <Icon className={`w-6 h-6 ${color}`} />
                  </div>
                  <h3 className="font-bold mb-1">{label}</h3>
                  <p className="text-xs text-muted-foreground">{desc}</p>
                  <ChevronRight className="w-4 h-4 text-muted-foreground mt-3 group-hover:text-foreground transition-colors" />
                </motion.button>
              ))}
            </div>
            {/* Super Admin power chips */}
            <div className="glass-card p-4 rounded-2xl border border-amber-500/20 bg-amber-500/5">
              <p className="text-xs font-black text-amber-700 uppercase tracking-widest mb-3">Super Admin Powers</p>
              <div className="flex flex-wrap gap-2">
                {[
                  'Promote / Demote Any User',
                  'Create / Delete Feature Flags',
                  'Toggle Global Features',
                  'Delete Any Post',
                  'Delete All User Content',
                  'View Full Platform Analytics',
                  'Assign Admin & Moderator Roles',
                  'Revoke Any Staff Role',
                  'Everything Admins Can Do',
                ].map(p => (
                  <span key={p} className="px-3 py-1 rounded-full text-[11px] font-bold bg-amber-500/10 text-amber-600">{p}</span>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── Platform Stats ── */}
        {activeTab === 'stats' && (
          <div>
            <h2 className="text-2xl font-black mb-6">Platform Statistics</h2>
            {loading ? <div className="text-muted-foreground">Loading…</div>
            : <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {platformStats.map(({ label, value, icon: Icon, color, bg }) => (
                  <motion.div key={label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                    className="glass-card p-5 rounded-2xl border border-border/50">
                    <div className={`w-10 h-10 ${bg} rounded-xl flex items-center justify-center mb-3`}>
                      <Icon className={`w-5 h-5 ${color}`} />
                    </div>
                    <div className="text-3xl font-black">{value.toLocaleString()}</div>
                    <div className="text-xs text-muted-foreground mt-1">{label}</div>
                  </motion.div>
                ))}
              </div>
            }
          </div>
        )}

        {/* ── Staff & Roles ── */}
        {activeTab === 'roles' && (
          <div>
            <h2 className="text-2xl font-black mb-6">Platform Staff</h2>
            <div className="glass-card rounded-2xl border border-border/50 overflow-hidden">
              {loading ? <div className="p-8 text-center text-muted-foreground">Loading…</div>
              : staff.length === 0 ? (
                <div className="p-12 text-center text-muted-foreground">
                  <Shield className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p>No staff members assigned yet.</p>
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {staff.map(member => (
                    <div key={member.id} className="p-4 flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden shrink-0">
                        {member.avatar_url ? <img src={member.avatar_url} alt="" className="w-full h-full object-cover" /> : <Users className="w-5 h-5 text-primary" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold">@{member.username}</p>
                        <p className="text-xs text-muted-foreground">{member.full_name} · {member.craft}</p>
                      </div>
                      <span className={`text-[10px] px-2 py-1 rounded-full font-bold border uppercase ${ROLE_COLORS[member.role] ?? ''}`}>
                        {member.role.replace('_', ' ')}
                      </span>
                      <div className="flex gap-2">
                        <Button size="sm" variant="ghost" className="text-xs text-red-500 hover:text-red-600 hover:bg-red-500/10 h-8"
                          onClick={() => deleteAllUserContent(member.id, member.username ?? '')}>
                          <Trash2 className="w-3 h-3" />
                        </Button>
                        {member.role !== 'super_admin' && (
                          <Button size="sm" variant="ghost" className="text-xs text-red-500 hover:bg-red-500/10 h-8"
                            onClick={() => revokeRole(member.id, member.username ?? '')}>
                            <UserMinus className="w-3 h-3 mr-1" />Revoke
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Feature Flags ── */}
        {activeTab === 'flags' && (
          <div>
            <h2 className="text-2xl font-black mb-2">Feature Flags</h2>
            <p className="text-muted-foreground mb-6 text-sm">Toggle platform features globally. Changes take effect immediately for all users.</p>

            {/* Create new flag */}
            <div className="glass-card p-5 rounded-2xl border border-border/50 mb-6 space-y-3">
              <p className="text-sm font-bold">Create New Flag</p>
              <div className="flex gap-3">
                <input className="flex-1 bg-background border border-border rounded-xl px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
                  placeholder="flag_key_name" value={newFlagKey} onChange={e => setNewFlagKey(e.target.value)} />
                <input className="flex-1 bg-background border border-border rounded-xl px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
                  placeholder="Description…" value={newFlagDesc} onChange={e => setNewFlagDesc(e.target.value)} />
                <Button className="text-xs font-bold rounded-xl" onClick={createFlag} disabled={!newFlagKey.trim()}>
                  <Zap className="w-3 h-3 mr-1" />Create
                </Button>
              </div>
            </div>

            <div className="space-y-3">
              {flags.map(flag => (
                <motion.div key={flag.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  className="glass-card p-5 rounded-2xl border border-border/50 flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${flag.value ? 'bg-green-500/10' : 'bg-muted'}`}>
                    {flag.value ? <Zap className="w-5 h-5 text-green-500" /> : <Lock className="w-5 h-5 text-muted-foreground" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold font-mono">{flag.key}</p>
                    <p className="text-xs text-muted-foreground">{flag.description}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`text-xs font-bold ${flag.value ? 'text-green-500' : 'text-muted-foreground'}`}>{flag.value ? 'ON' : 'OFF'}</span>
                    <button onClick={() => toggleFlag(flag)}
                      className={`relative w-12 h-6 rounded-full transition-colors duration-200 ${flag.value ? 'bg-green-500' : 'bg-muted border border-border'}`}>
                      <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform duration-200 ${flag.value ? 'translate-x-7' : 'translate-x-1'}`} />
                    </button>
                    <Button size="icon" variant="ghost" className="w-7 h-7 text-red-500 hover:bg-red-500/10 rounded-lg"
                      onClick={() => deleteFlag(flag.id, flag.key)}>
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        )}

        {/* ── Promote User ── */}
        {activeTab === 'promote' && (
          <div>
            <h2 className="text-2xl font-black mb-2">Promote a User</h2>
            <p className="text-muted-foreground mb-6 text-sm">Search by username and assign a governance role. All promotions are audit logged.</p>

            <div className="flex gap-3 mb-6">
              {(['moderator', 'admin', 'super_admin'] as const).map(r => (
                <button key={r} onClick={() => setSelectedRole(r)}
                  className={`flex-1 py-3 rounded-xl text-sm font-bold border transition-all ${
                    selectedRole === r
                      ? r === 'super_admin' ? 'bg-amber-500/10 border-amber-500/40 text-amber-500'
                        : r === 'admin' ? 'bg-blue-500/10 border-blue-500/40 text-blue-500'
                        : 'bg-purple-500/10 border-purple-500/40 text-purple-500'
                      : 'bg-muted border-border text-muted-foreground hover:border-foreground/30'}`}>
                  {r === 'super_admin' ? '👑 Super Admin' : r === 'admin' ? '🛡️ Admin' : '🔍 Moderator'}
                </button>
              ))}
            </div>

            {selectedRole === 'super_admin' && (
              <div className="mb-4 p-4 bg-amber-500/5 border border-amber-500/20 rounded-xl text-sm text-amber-600 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                You are granting root platform authority. This user will have full control over all platform systems.
              </div>
            )}

            <div className="flex items-center gap-2 glass-card border border-border rounded-xl px-4 py-3 mb-4">
              <Search className="w-4 h-4 text-muted-foreground" />
              <input className="bg-transparent text-sm outline-none flex-1 placeholder:text-muted-foreground"
                placeholder="Search username to promote…" value={promoteSearch} onChange={e => setPromoteSearch(e.target.value)} />
            </div>

            {promoteResults.length > 0 && (
              <div className="glass-card rounded-2xl border border-border/50 overflow-hidden">
                <div className="divide-y divide-border">
                  {promoteResults.map(user => (
                    <div key={user.id} className="p-4 flex items-center gap-4 hover:bg-muted/30 transition-colors">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden shrink-0">
                        {user.avatar_url ? <img src={user.avatar_url} alt="" className="w-full h-full object-cover" /> : <Users className="w-5 h-5 text-primary" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold">@{user.username}</p>
                        <p className="text-xs text-muted-foreground">{user.full_name} · {user.craft}</p>
                      </div>
                      <Button size="sm" className="text-xs bg-primary hover:bg-primary/90 text-white" onClick={() => promoteUser(user.id)}>
                        <UserPlus className="w-3 h-3 mr-1" />Assign {selectedRole.replace('_', ' ')}
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
};

export default SuperAdminDashboard;
