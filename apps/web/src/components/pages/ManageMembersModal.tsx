import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { UserPlus, UserMinus, Search, Loader2, X, Users, Crown } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';

interface Props {
  pageId: string;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  existingMembers: any[];
  /** Only the owner can change roles. */
  isOwner?: boolean;
}

const db = supabase as any;
const ROLES = [
  { value: 'member', label: 'Team member' },
  { value: 'content_admin', label: 'Content admin' },
  { value: 'analyst', label: 'Analyst' },
  { value: 'super_admin', label: 'Super admin' },
];

const PersonRow = ({ p, children }: { p: any; children?: React.ReactNode }) => (
  <div className="flex items-center justify-between gap-2 p-2 rounded-lg bg-background border border-border">
    <div className="flex items-center gap-3 overflow-hidden min-w-0">
      <Avatar className="h-8 w-8 shrink-0">
        <AvatarImage src={p?.avatar_url || ''} />
        <AvatarFallback>{(p?.full_name || p?.username || '?').charAt(0)}</AvatarFallback>
      </Avatar>
      <div className="truncate min-w-0">
        <p className="font-medium text-sm truncate">{p?.full_name || p?.username}</p>
        <p className="text-xs text-muted-foreground truncate">{p?.craft || (p?.username ? `@${p.username}` : '')}</p>
      </div>
    </div>
    {children}
  </div>
);

/** Team, invitations, roles and followers for a company page. People join only by accepting an invitation. */
export function ManageMembersModal({ pageId, isOpen, onOpenChange, existingMembers, isOwner = false }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState('team');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [busy, setBusy] = useState(false);
  const [title, setTitle] = useState('');
  const [department, setDepartment] = useState('');

  const { data: admins = [] } = useQuery({
    queryKey: ['page-admins', pageId],
    enabled: isOpen,
    queryFn: async () => {
      const { data } = await db.from('company_page_admins').select('user_id, role').eq('page_id', pageId);
      return (data || []) as { user_id: string; role: string }[];
    },
  });

  const { data: invites = [] } = useQuery({
    queryKey: ['page-invites', pageId],
    enabled: isOpen,
    queryFn: async () => {
      const { data } = await db
        .from('company_page_invites')
        .select('id, title, department, created_at, invitee:invitee_id ( id, full_name, username, avatar_url )')
        .eq('page_id', pageId)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });
      return (data || []) as any[];
    },
  });

  const { data: followers = [], isLoading: followersLoading } = useQuery({
    queryKey: ['page-followers', pageId],
    enabled: isOpen && tab === 'followers',
    queryFn: async () => {
      const { data } = await db.rpc('page_followers', { p_page_id: pageId });
      return (data || []) as any[];
    },
  });

  useEffect(() => {
    const t = setTimeout(async () => {
      if (searchQuery.trim().length < 3) return setSearchResults([]);
      setIsSearching(true);
      const term = searchQuery.trim().replace(/[%_,()]/g, ' ');
      const { data } = await supabase.from('profiles').select('id, full_name, username, avatar_url, craft').ilike('full_name', `%${term}%`).limit(5);
      setSearchResults(data || []);
      setIsSearching(false);
    }, 400);
    return () => clearTimeout(t);
  }, [searchQuery]);

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['page-members', pageId] });
    queryClient.invalidateQueries({ queryKey: ['page-admins', pageId] });
    queryClient.invalidateQueries({ queryKey: ['page-invites', pageId] });
  };

  const call = async (fn: () => Promise<any>, ok: string) => {
    setBusy(true);
    try {
      const res = await fn();
      if (res?.error) throw res.error;
      if (res?.data?.success === false) throw new Error(res.data.message);
      toast({ title: ok });
      refresh();
    } catch (e: any) {
      toast({ title: 'Something went wrong', description: e?.message || 'Please try again.', variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  const invite = (userId: string) =>
    call(async () => {
      const r = await db.rpc('invite_to_page', { p_page_id: pageId, p_user_id: userId, p_title: title || null, p_department: department || null });
      if (!r.error && r.data?.success !== false) {
        setSearchQuery('');
        setSearchResults([]);
        setTitle('');
        setDepartment('');
      }
      return r;
    }, 'Invitation sent');

  const memberIds = new Set(existingMembers.map((m) => m.user_id));
  const invitedIds = new Set(invites.map((i: any) => i.invitee?.id));
  const roleOf = (userId: string) => admins.find((a) => a.user_id === userId)?.role || 'member';

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg w-[95vw] max-h-[88vh] overflow-y-auto bg-card/95 backdrop-blur-3xl border-white/10 shadow-2xl rounded-[32px]">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold flex items-center gap-2"><Users className="h-6 w-6 text-primary" /> Team & access</DialogTitle>
          <DialogDescription>People join your team only when they accept an invitation.</DialogDescription>
        </DialogHeader>

        <Tabs value={tab} onValueChange={setTab} className="pt-2">
          <TabsList className="grid grid-cols-3 w-full h-10 rounded-xl">
            <TabsTrigger value="team" className="rounded-lg font-bold text-xs">Team ({existingMembers.length})</TabsTrigger>
            <TabsTrigger value="invite" className="rounded-lg font-bold text-xs">Invite{invites.length ? ` (${invites.length})` : ''}</TabsTrigger>
            <TabsTrigger value="followers" className="rounded-lg font-bold text-xs">Followers</TabsTrigger>
          </TabsList>

          <TabsContent value="team" className="space-y-2 mt-4">
            {existingMembers.length === 0 ? (
              <p className="text-sm text-center text-muted-foreground py-6">No team members yet. Invite someone from the Invite tab.</p>
            ) : (
              existingMembers.map((m) => (
                <PersonRow key={m.id} p={m.profiles}>
                  <div className="flex items-center gap-2 shrink-0">
                    {isOwner ? (
                      <Select value={roleOf(m.user_id)} onValueChange={(v) => call(() => db.rpc('set_page_admin', { p_page_id: pageId, p_user_id: m.user_id, p_role: v }), 'Role updated')}>
                        <SelectTrigger className="h-8 w-[130px] text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>{ROLES.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}</SelectContent>
                      </Select>
                    ) : (
                      <span className="text-[11px] text-muted-foreground">{m.title}{m.department ? ` · ${m.department}` : ''}</span>
                    )}
                    {isOwner && m.user_id !== user?.id && (
                      <Button size="icon" variant="ghost" className="h-8 w-8" title="Make this person the owner" disabled={busy}
                        onClick={() => window.confirm(`Transfer ownership of this page to ${m.profiles?.full_name || 'this person'}? You will stay on as a super admin, but only they can transfer or delete the page.`) && call(() => db.rpc('transfer_page_ownership', { p_page_id: pageId, p_new_owner: m.user_id }), 'Ownership transferred').then(() => onOpenChange(false))}>
                        <Crown className="h-4 w-4" />
                      </Button>
                    )}
                    {m.user_id !== user?.id && (
                      <Button size="icon" variant="ghost" className="h-8 w-8 text-red-500 hover:bg-red-500/10" disabled={busy}
                        onClick={() => window.confirm('Remove this person from the team?') && call(() => db.from('company_page_members').delete().eq('page_id', pageId).eq('user_id', m.user_id), 'Removed from the team')}>
                        <UserMinus className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </PersonRow>
              ))
            )}
            {isOwner && <p className="text-[11px] text-muted-foreground pt-2">Roles: content admins edit the page and post as the company; analysts can see insights; super admins can also manage the team and hiring.</p>}
          </TabsContent>

          <TabsContent value="invite" className="space-y-4 mt-4">
            <div className="space-y-3 border rounded-xl p-4 bg-muted/20 border-border">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1"><Label className="text-xs">Job title</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Director" maxLength={80} className="h-8 text-sm" /></div>
                <div className="space-y-1"><Label className="text-xs">Department</Label><Input value={department} onChange={(e) => setDepartment(e.target.value)} placeholder="e.g. Production" maxLength={80} className="h-8 text-sm" /></div>
              </div>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Search a person by name…" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9" />
                {isSearching && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />}
              </div>
              {searchResults.map((r) => {
                const done = memberIds.has(r.id) || invitedIds.has(r.id);
                return (
                  <PersonRow key={r.id} p={r}>
                    <Button size="sm" variant={done ? 'secondary' : 'default'} disabled={done || busy} onClick={() => invite(r.id)} className="shrink-0">
                      <UserPlus className="h-3.5 w-3.5 mr-1" />{memberIds.has(r.id) ? 'On team' : invitedIds.has(r.id) ? 'Invited' : 'Invite'}
                    </Button>
                  </PersonRow>
                );
              })}
            </div>

            <div className="space-y-2">
              <h4 className="text-xs font-black uppercase tracking-widest text-muted-foreground">Waiting for a reply ({invites.length})</h4>
              {invites.length === 0 ? (
                <p className="text-sm text-muted-foreground">No pending invitations.</p>
              ) : (
                invites.map((i: any) => (
                  <PersonRow key={i.id} p={i.invitee}>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[11px] text-muted-foreground hidden sm:inline">{formatDistanceToNow(new Date(i.created_at), { addSuffix: true })}</span>
                      <Button size="icon" variant="ghost" className="h-8 w-8" title="Withdraw invitation" disabled={busy} onClick={() => call(() => db.rpc('cancel_page_invite', { p_invite_id: i.id }), 'Invitation withdrawn')}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </PersonRow>
                ))
              )}
            </div>
          </TabsContent>

          <TabsContent value="followers" className="space-y-2 mt-4">
            {followersLoading ? (
              <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin" /></div>
            ) : followers.length === 0 ? (
              <p className="text-sm text-center text-muted-foreground py-6">No followers yet.</p>
            ) : (
              followers.map((f: any) => (
                <PersonRow key={f.user_id} p={f}>
                  <span className="text-[11px] text-muted-foreground shrink-0">{formatDistanceToNow(new Date(f.followed_at), { addSuffix: true })}</span>
                </PersonRow>
              ))
            )}
          </TabsContent>
        </Tabs>

        <Button variant="outline" onClick={() => onOpenChange(false)} className="w-full rounded-xl mt-2">Done</Button>
      </DialogContent>
    </Dialog>
  );
}
