import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Flag, CheckCircle, XCircle, Clock, Eye, User, MessageSquare,
  Briefcase, ShoppingBag, Filter, Shield, Trash2, VolumeX,
  AlertTriangle, ExternalLink, RefreshCw, LayoutDashboard, Crown, ShieldAlert
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import AppLogo from '@/components/common/AppLogo';
import { useNavigate } from 'react-router-dom';
import { useAppRole } from '@/hooks/useAppRole';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';

type Report = {
  id: string;
  reported_by: string;
  target_type: string;
  target_id: string;
  reason: string;
  details: string | null;
  status: string;
  created_at: string;
  reporter?: { username: string; avatar_url: string | null };
};

const REASON_LABELS: Record<string, string> = {
  spam: 'Spam', harassment: 'Harassment', hate_speech: 'Hate Speech',
  misinformation: 'Misinformation', explicit_content: 'Explicit Content',
  impersonation: 'Impersonation', fraud: 'Fraud / Scam', other: 'Other',
};

const TARGET_ICONS: Record<string, React.ElementType> = {
  post: MessageSquare, comment: MessageSquare,
  user: User, job: Briefcase, listing: ShoppingBag,
};

const ReportPreview = ({ targetType, targetId }: { targetType: string; targetId: string }) => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const tableMap: Record<string, string> = {
      post: 'posts', user: 'profiles', comment: 'comments', job: 'jobs', listing: 'marketplace_listings',
    };
    const table = tableMap[targetType];
    if (!table) { setLoading(false); return; }
    (supabase as any).from(table).select('*').eq('id', targetId).maybeSingle()
      .then(({ data: d }: any) => { setData(d); setLoading(false); });
  }, [targetType, targetId]);

  if (loading) return <div className="h-8 mt-2 text-[10px] uppercase text-muted-foreground animate-pulse font-black">Loading…</div>;
  if (!data) return <div className="mt-2 p-2 bg-red-500/5 border border-red-500/10 rounded-lg text-[10px] text-red-500 font-bold uppercase">Content deleted or unavailable.</div>;

  return (
    <div className="mt-3 p-3 bg-muted/30 border border-border/40 rounded-xl flex gap-3 items-start">
      {targetType === 'post' && data.media_url && (
        <img src={data.media_url} className="w-12 h-12 rounded-lg object-cover shrink-0 border border-border" alt="" />
      )}
      {targetType === 'user' && data.avatar_url && (
        <img src={data.avatar_url} className="w-10 h-10 rounded-full object-cover shrink-0 border border-border" alt="" />
      )}
      <div className="flex-1 min-w-0 space-y-0.5">
        {targetType === 'post' && <p className="text-xs text-foreground/80 line-clamp-3">{data.content || 'No text content.'}</p>}
        {targetType === 'user' && <>
          <p className="text-xs font-bold">@{data.username}</p>
          <p className="text-[11px] text-muted-foreground italic line-clamp-2">{data.bio || 'No bio.'}</p>
        </>}
        {(targetType === 'job' || targetType === 'listing') && <p className="text-xs font-bold">{data.title}</p>}
      </div>
    </div>
  );
};

const ActionPanel = ({ report, onDone }: { report: Report; onDone: () => void }) => {
  const { toast } = useToast();
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);

  // Map target_type → { table, label }
  const CONTENT_DELETE_MAP: Record<string, { table: string; label: string }> = {
    post:    { table: 'posts',                label: 'Post'              },
    comment: { table: 'comments',             label: 'Comment'           },
    job:     { table: 'jobs',                 label: 'Job Listing'       },
    listing: { table: 'marketplace_listings', label: 'Marketplace Item'  },
    room:    { table: 'discussion_rooms',     label: 'Discussion Room'   },
    message: { table: 'direct_messages',      label: 'Message'           },
  };

  const run = async (action: string) => {
    setLoading(true);
    try {
      if (action === 'delete_content') {
        const mapping = CONTENT_DELETE_MAP[report.target_type];
        if (mapping) {
          const { error } = await (supabase as any).from(mapping.table).delete().eq('id', report.target_id);
          if (error) throw error;
          await (supabase as any).rpc('resolve_report', { _report_id: report.id, _status: 'resolved', _note: `${mapping.label} deleted. ${note}` });
          toast({ title: `🗑️ ${mapping.label} Deleted & Report Resolved` });
        }
      } else if (action === 'ban_user') {
        // Ban the reported user (target if type=user, else the reporter)
        const targetUserId = report.target_type === 'user' ? report.target_id : report.reported_by;
        await (supabase as any).rpc('ban_user', { _target_user_id: targetUserId, _reason: note || 'Policy violation', _ban_type: 'temporary' });
        await (supabase as any).rpc('resolve_report', { _report_id: report.id, _status: 'resolved', _note: `User banned. ${note}` });
        toast({ title: '🚫 User Banned & Report Resolved' });
      } else if (action === 'resolve') {
        await (supabase as any).rpc('resolve_report', { _report_id: report.id, _status: 'resolved', _note: note });
        toast({ title: '✅ Report Resolved' });
      } else if (action === 'dismiss') {
        await (supabase as any).rpc('resolve_report', { _report_id: report.id, _status: 'dismissed', _note: note });
        toast({ title: 'Report Dismissed' });
      } else if (action === 'warn') {
        await (supabase as any).rpc('resolve_report', { _report_id: report.id, _status: 'resolved', _note: `Warning issued. ${note}` });
        toast({ title: '⚠️ Warning Noted & Report Resolved' });
      }
      onDone();
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const deleteLabel = CONTENT_DELETE_MAP[report.target_type]?.label ?? 'Content';
  const canDelete = report.target_type in CONTENT_DELETE_MAP;

  return (
    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
      className="mt-4 p-4 bg-card border border-amber-500/20 rounded-2xl space-y-3">
      <p className="text-[10px] font-black text-amber-600 uppercase tracking-widest flex items-center gap-2">
        <Shield className="w-3 h-3" /> Moderator Action
      </p>
      <textarea
        className="w-full text-sm bg-background border border-border rounded-xl p-3 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-amber-500/30 resize-none"
        rows={2} placeholder="Resolution note (goes to audit log)…"
        value={note} onChange={e => setNote(e.target.value)}
      />
      <div className="flex flex-wrap gap-2">
        <Button size="sm" disabled={loading} onClick={() => run('resolve')}
          className="bg-green-600 hover:bg-green-700 text-white text-xs font-bold rounded-xl h-9">
          <CheckCircle className="w-3 h-3 mr-1" /> Resolve
        </Button>
        <Button size="sm" variant="outline" disabled={loading} onClick={() => run('warn')}
          className="border-amber-500/30 text-amber-600 hover:bg-amber-500/10 text-xs font-bold rounded-xl h-9">
          <AlertTriangle className="w-3 h-3 mr-1" /> Issue Warning
        </Button>
        {/* Delete button — works for ALL content types */}
        {canDelete && (
          <Button size="sm" variant="outline" disabled={loading} onClick={() => run('delete_content')}
            className="border-red-500/30 text-red-500 hover:bg-red-500/10 text-xs font-bold rounded-xl h-9">
            <Trash2 className="w-3 h-3 mr-1" /> Delete {deleteLabel}
          </Button>
        )}
        {/* Ban User — shown for user reports AND for non-user content (ban the author) */}
        <Button size="sm" variant="outline" disabled={loading} onClick={() => run('ban_user')}
          className="border-red-500/30 text-red-500 hover:bg-red-500/10 text-xs font-bold rounded-xl h-9">
          <VolumeX className="w-3 h-3 mr-1" />
          {report.target_type === 'user' ? 'Ban User' : 'Ban Reporter'}
        </Button>
        <Button size="sm" variant="outline" disabled={loading} onClick={() => run('dismiss')}
          className="text-xs font-bold rounded-xl h-9">
          <XCircle className="w-3 h-3 mr-1" /> Dismiss
        </Button>
      </div>
    </motion.div>
  );
};

const ModerationDashboard = () => {
  const [reports, setReports] = useState<Report[]>([]);
  const [filter, setFilter] = useState<'pending' | 'reviewing' | 'resolved' | 'dismissed' | 'all'>('pending');
  const [loading, setLoading] = useState(true);
  const [activeReport, setActiveReport] = useState<string | null>(null);
  const { isAdmin, isSuperAdmin } = useAppRole();
  const { toast } = useToast();
  const navigate = useNavigate();

  const fetchReports = async () => {
    setLoading(true);
    try {
      let query = (supabase as any)
        .from('content_reports')
        .select(`*, reporter:reported_by(username, avatar_url)`)
        .order('created_at', { ascending: false });
      if (filter !== 'all') query = query.eq('status', filter);
      const { data, error } = await query;
      if (error) throw error;
      setReports((data as Report[]) || []);
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchReports(); }, [filter]);

  const statusColor: Record<string, string> = {
    pending:   'bg-amber-500/10 text-amber-500 border-amber-500/20',
    reviewing: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
    resolved:  'bg-green-500/10 text-green-500 border-green-500/20',
    dismissed: 'bg-muted text-muted-foreground border-border',
  };

  const counts = {
    pending:   reports.filter(r => r.status === 'pending').length,
    reviewing: reports.filter(r => r.status === 'reviewing').length,
    resolved:  reports.filter(r => r.status === 'resolved').length,
    dismissed: reports.filter(r => r.status === 'dismissed').length,
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b border-border bg-card px-6 py-4 flex items-center gap-4 sticky top-0 z-50">
        <AppLogo size="sm" to="/feed" />
        <div className="w-px h-8 bg-border mx-2" />
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center">
            <Flag className="w-4 h-4 text-amber-500" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-foreground">Moderation Dashboard</h1>
            <p className="text-xs text-muted-foreground">Content & Community Review</p>
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
              <DropdownMenuItem onClick={fetchReports} className="rounded-xl px-3 py-2 cursor-pointer gap-2">
                <RefreshCw className="w-4 h-4 text-amber-500" />
                <span className="font-bold text-sm">Refresh Reports</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator className="my-1 bg-border/50" />
              
              <DropdownMenuLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground px-3 py-2">
                Switch View
              </DropdownMenuLabel>
              <DropdownMenuItem onClick={() => navigate('/moderation')} className="rounded-xl px-3 py-2 cursor-pointer gap-2 bg-amber-500/5 text-amber-600">
                <ShieldAlert className="w-4 h-4" />
                <span className="font-bold text-sm">Moderation View</span>
              </DropdownMenuItem>
              
              {isAdmin && (
                <DropdownMenuItem onClick={() => navigate('/admin')} className="rounded-xl px-3 py-2 cursor-pointer gap-2">
                  <LayoutDashboard className="w-4 h-4 text-blue-500" />
                  <span className="font-bold text-sm">Admin Dashboard</span>
                </DropdownMenuItem>
              )}

              {isSuperAdmin && (
                <DropdownMenuItem onClick={() => navigate('/super-admin')} className="rounded-xl px-3 py-2 cursor-pointer gap-2">
                  <Crown className="w-4 h-4 text-amber-600" />
                  <span className="font-bold text-sm">Super Admin</span>
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
          <span className="text-xs bg-amber-500/10 border border-amber-500/20 text-amber-600 px-3 py-1 rounded-full font-bold">MODERATOR</span>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-8">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {([
            { label: 'Pending',   count: counts.pending,   icon: Clock,       color: 'text-amber-500',        bg: 'bg-amber-500/10' },
            { label: 'Reviewing', count: counts.reviewing, icon: Eye,         color: 'text-blue-500',         bg: 'bg-blue-500/10'  },
            { label: 'Resolved',  count: counts.resolved,  icon: CheckCircle, color: 'text-green-500',        bg: 'bg-green-500/10' },
            { label: 'Dismissed', count: counts.dismissed, icon: XCircle,     color: 'text-muted-foreground', bg: 'bg-muted'        },
          ] as const).map(({ label, count, icon: Icon, color, bg }) => (
            <motion.div key={label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
              className="glass-card p-5 rounded-2xl border border-border/50">
              <div className={`w-10 h-10 ${bg} rounded-xl flex items-center justify-center mb-3`}>
                <Icon className={`w-5 h-5 ${color}`} />
              </div>
              <div className="text-2xl font-black text-foreground">{count}</div>
              <div className="text-xs text-muted-foreground font-medium">{label} Reports</div>
            </motion.div>
          ))}
        </div>

        {/* Powers chips */}
        <div className="flex flex-wrap gap-2 mb-6">
          {[
            { l: 'Resolve Reports',  c: 'text-green-500 bg-green-500/10',   i: CheckCircle  },
            { l: 'Delete Posts',     c: 'text-red-500 bg-red-500/10',        i: Trash2       },
            { l: 'Issue Warnings',   c: 'text-amber-600 bg-amber-500/10',    i: AlertTriangle },
            { l: 'Ban Users',        c: 'text-red-600 bg-red-600/10',        i: VolumeX      },
            { l: 'Dismiss Reports',  c: 'text-muted-foreground bg-muted',    i: XCircle      },
          ].map(p => (
            <div key={p.l} className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold ${p.c}`}>
              <p.i className="w-3 h-3" /> {p.l}
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2 mb-6 flex-wrap">
          <Filter className="w-4 h-4 text-muted-foreground" />
          {(['pending', 'reviewing', 'resolved', 'dismissed', 'all'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-4 py-2 rounded-xl text-sm font-bold transition-all capitalize ${
                filter === f ? 'bg-primary text-white' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}>
              {f}
            </button>
          ))}
        </div>

        {/* Reports list */}
        <div className="glass-card rounded-2xl border border-border/50 overflow-hidden">
          {loading ? (
            <div className="p-12 text-center text-muted-foreground">Loading reports…</div>
          ) : reports.length === 0 ? (
            <div className="p-12 text-center">
              <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3 opacity-60" />
              <p className="text-muted-foreground font-medium">No {filter !== 'all' ? filter : ''} reports.</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {reports.map(report => {
                const TargetIcon = TARGET_ICONS[report.target_type] ?? Flag;
                const isActive = activeReport === report.id;
                return (
                  <div key={report.id} className="p-5 hover:bg-muted/20 transition-colors">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-4 flex-1 min-w-0">
                        <div className="w-10 h-10 rounded-xl bg-rose-500/10 flex items-center justify-center shrink-0">
                          <TargetIcon className="w-5 h-5 text-rose-500" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <span className="text-xs font-black text-foreground uppercase tracking-wider">{report.target_type}</span>
                            <span className="text-[10px] font-mono text-muted-foreground">#{report.target_id.slice(0, 8)}</span>
                            <Badge className={`text-[10px] border ${statusColor[report.status]}`}>{report.status}</Badge>
                          </div>
                          <p className="text-sm font-bold text-foreground">{REASON_LABELS[report.reason] ?? report.reason}</p>
                          {report.details && <p className="text-xs text-muted-foreground italic mt-0.5">"{report.details}"</p>}
                          <p className="text-[10px] text-muted-foreground uppercase font-black tracking-widest opacity-50 mt-2">
                            by @{report.reporter?.username ?? 'unknown'} · {new Date(report.created_at).toLocaleDateString()}
                          </p>
                          <ReportPreview targetType={report.target_type} targetId={report.target_id} />
                        </div>
                      </div>

                      <div className="flex flex-col gap-2 shrink-0">
                        {(report.status === 'pending' || report.status === 'reviewing') && (
                          <Button size="sm" variant="outline"
                            className={`text-xs border-amber-500/30 text-amber-600 hover:bg-amber-500/10 font-bold h-8 ${isActive ? 'bg-amber-500/10' : ''}`}
                            onClick={() => setActiveReport(isActive ? null : report.id)}>
                            {isActive ? 'Cancel' : 'Take Action'}
                          </Button>
                        )}
                        <Button size="sm" variant="ghost" className="text-xs text-muted-foreground h-8"
                          onClick={() => report.target_type === 'user' ? navigate(`/profile/${report.target_id}`) : window.open('/feed', '_blank')}>
                          <ExternalLink className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>

                    {isActive && (
                      <ActionPanel report={report} onDone={() => { setActiveReport(null); fetchReports(); }} />
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ModerationDashboard;
