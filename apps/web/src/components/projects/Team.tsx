import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/contexts/AuthContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { UserPlus, Link as LinkIcon, Copy, Search, Trash2, Check, Users } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { WorkspaceHero } from './WorkspaceUI';
import { useAppRole } from '@/hooks/useAppRole';
import { copyToClipboard, getAppOrigin } from '@/lib/utils/share';
import { confirmDialog } from '@/lib/confirmDialog';
import { friendlyError } from '@cinecraft/core';

interface TeamMember {
    /** the project owner: always shown as Owner, their role can never be changed or removed */
    is_owner?: boolean;
    user_id: string;
    role: string;
    profiles: {
        full_name: string | null;
        avatar_url: string | null;
        is_internal: boolean;
        platform_role: string;
    };
}

interface SearchResult {
    id: string;
    full_name: string | null;
    avatar_url: string | null;
    bio: string | null;
}

interface TeamProps {
    project_id: string; // This is actually the space ID
    real_project_id?: string; // This is the actual project ID
    /** true only for the space / project creator: add, invite, remove, change roles */
    canManage?: boolean;
}

const Team = ({ project_id, real_project_id, canManage = false }: TeamProps) => {
    const { user } = useAuth();
    const { isInternal } = useAppRole();
    const { toast } = useToast();
    const [members, setMembers] = useState<TeamMember[]>([]);
    const [loading, setLoading] = useState(true);
    const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
    const [searchDialogOpen, setSearchDialogOpen] = useState(false);
    const [inviteCode, setInviteCode] = useState('');
    const [copied, setCopied] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
    const [searching, setSearching] = useState(false);
    
    const [editingRole, setEditingRole] = useState<string | null>(null);
    const [tempRoleName, setTempRoleName] = useState<string>('');

    const [resolvedSpaceId, setResolvedSpaceId] = useState<string>(project_id);

    useEffect(() => {
        let mounted = true;
        const resolveSpace = async () => {
            if (!project_id) return;
            try {
                const { data, error } = await supabase
                    .from('project_spaces')
                    .select('id')
                    .eq('project_id', project_id)
                    .maybeSingle();

                if (error) {
                    // Ignore
                } else if (mounted && data) {
                    setResolvedSpaceId(data.id);
                }
            } catch (e) {
                // Ignore
            }
        };
        resolveSpace();
        return () => { mounted = false; };
    }, [project_id]);

    const fetchMembers = useCallback(async () => {
        try {
            setLoading(true);

            let creatorId = null;
            if (real_project_id) {
                // Fetch the project creator to identify the admin
                const { data: projectData } = await supabase
                    .from('projects')
                    .select('creator_id')
                    .eq('id', real_project_id)
                    .maybeSingle();
                creatorId = projectData?.creator_id;
            }

            const { data, error } = await supabase
                .from('project_space_members' as any)
                .select(`
                    *,
                    profiles:user_id (
                        full_name,
                        avatar_url,
                        is_internal
                    )
                `)
                .eq('project_space_id', resolvedSpaceId);

            if (error) throw error;

            const userIds = data?.map((m: any) => m.user_id) || [];
            let staffUserIds = new Set<string>();
            
            if (userIds.length > 0) {
                const { data: rolesData } = await (supabase as any).rpc('staff_roles_for', { p_ids: userIds });
                
                rolesData?.forEach((r: any) => {
                    if (r.role === 'admin' || r.role === 'super_admin' || r.role === 'moderator') {
                        staffUserIds.add(r.user_id);
                    }
                });
            }

            const formattedMembers = data?.map((member: any) => {
                const isInternalRole = staffUserIds.has(member.user_id) || member.profiles?.is_internal;
                return {
                    user_id: member.user_id,
                    is_owner: !!creatorId && member.user_id === creatorId,
                    role: member.user_id === creatorId ? 'admin' : member.role, // Creator is always an admin
                    profiles: {
                        full_name: member.profiles?.full_name || null,
                        avatar_url: member.profiles?.avatar_url || null,
                        is_internal: isInternalRole,
                        platform_role: isInternalRole ? 'Staff' : 'user'
                    }
                };
            }).filter((m: any) => !m.profiles.is_internal) || [];

            setMembers(formattedMembers);
        } catch (error: any) {
            toast({ title: "Error", description: "Failed to load team members", variant: "destructive" });
        } finally {
            setLoading(false);
        }
    }, [resolvedSpaceId, toast]);

    useEffect(() => {
        fetchMembers();

        const channel = supabase
            .channel(`project_space_members:${resolvedSpaceId}`)
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'project_space_members',
                filter: `project_space_id=eq.${resolvedSpaceId}`
            }, () => {
                fetchMembers();
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [resolvedSpaceId, fetchMembers]);

    const generateInviteLink = async () => {
        try {
            // an invite code is a secret: use the browser's secure random numbers, not Math.random
            const bytes = new Uint8Array(12);
            crypto.getRandomValues(bytes);
            const code = Array.from(bytes, (b) => b.toString(36).padStart(2, '0')).join('').slice(0, 18);

            const { error } = await supabase
                .from('project_invites' as any)
                .insert([{
                    project_id: resolvedSpaceId,
                    invite_code: code,
                    created_by: user?.id,
                    expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
                }]);

            if (error) throw error;

            setInviteCode(code);
            toast({ title: "Success", description: "Invite link generated" });
        } catch (error: any) {
            toast({ title: "Error", description: "Failed to generate invite link", variant: "destructive" });
        }
    };

    const copyInviteLink = async () => {
        const link = `${getAppOrigin()}/projects/join/${inviteCode}`;
        const success = await copyToClipboard(link);
        if (success) {
            setCopied(true);
            toast({ title: "Copied!", description: "Invite link copied to clipboard" });
            setTimeout(() => setCopied(false), 2000);
        }
    };

    const searchUsers = async () => {
        if (!searchQuery.trim()) return;

        setSearching(true);
        try {
            const { data, error } = await supabase
                .from('profiles')
                .select('id, full_name, avatar_url, bio, is_internal')
                .ilike('full_name', `%${searchQuery}%`)
                .limit(20);

            if (error) throw error;

            const userIds = data?.map((u: any) => u.id) || [];
            let staffUserIds = new Set<string>();
            if (userIds.length > 0) {
                const { data: rolesData } = await (supabase as any).rpc('staff_roles_for', { p_ids: userIds });
                
                rolesData?.forEach((r: any) => {
                    if (r.role === 'admin' || r.role === 'super_admin' || r.role === 'moderator') {
                        staffUserIds.add(r.user_id);
                    }
                });
            }

            const memberIds = members.map(m => m.user_id);
            const filtered = data?.filter((user: any) => 
                !memberIds.includes(user.id) && 
                !user.is_internal && 
                !staffUserIds.has(user.id)
            ).map((u: any) => ({
                id: u.id,
                full_name: u.full_name,
                avatar_url: u.avatar_url,
                bio: u.bio
            })) as SearchResult[] || [];

            setSearchResults(filtered);
        } catch (error: any) {
            toast({ title: "Error", description: "Failed to search users", variant: "destructive" });
        } finally {
            setSearching(false);
        }
    };

    const addMember = async (targetUser: SearchResult) => {
        try {
            const { error } = await supabase
                .from('project_space_members' as any)
                .insert([{
                    project_space_id: resolvedSpaceId,
                    user_id: targetUser.id
                }]);

            if (error) throw error;

            toast({ title: "Success", description: "Member added to project" });
            setSearchResults(searchResults.filter(u => u.id !== targetUser.id));
            fetchMembers();
        } catch (error: any) {
            toast({
                title: "Error",
                description: error.message || error.error_description || "Failed to add member",
                variant: "destructive"
            });
        }
    };

    const removeMember = async (userId: string) => {
        if (!await confirmDialog('Remove this member from the project?')) return;

        try {
            const { data: removed, error } = await supabase
                .from('project_space_members' as any)
                .delete()
                .eq('project_space_id', resolvedSpaceId)
                .eq('user_id', userId)
                .select('user_id');

            if (error) throw error;
            if (!removed || removed.length === 0) {
                toast({ title: "Not removed", description: "You are not allowed to remove this member.", variant: "destructive" });
                return;
            }

            toast({ title: "Success", description: "Member removed" });
            fetchMembers();
        } catch (error: any) {
            toast({ title: "Error", description: "Failed to remove member", variant: "destructive" });
        }
    };

    const handleUpdateRole = async (memberId: string) => {
        if (!tempRoleName.trim()) {
            setEditingRole(null);
            return;
        }
        try {
            const { error } = await supabase
                .from('project_space_members' as any)
                .update({ role: tempRoleName.trim() })
                .eq('project_space_id', resolvedSpaceId)
                .eq('user_id', memberId);

            if (error) throw error;
            
            setMembers(prev => prev.map(m => m.user_id === memberId ? { ...m, role: tempRoleName.trim() } : m));
            setEditingRole(null);
            toast({ title: 'Success', description: 'Role updated successfully.' });
        } catch (error: any) {
            toast({ title: 'Error', description: friendlyError(error), variant: 'destructive' });
        }
    };

    // who may change roles: the owner, and members whose role is Admin. An admin cannot touch another admin (only the owner can),
    // and nobody can change the owner. The database enforces the same rules (SQL part FT); this only decides what to show.
    const me = members.find((m) => m.user_id === user?.id);
    const meIsAdmin = me?.role === 'admin';
    const canEditRoles = (canManage || meIsAdmin) && !isInternal;
    const crewRoles = Array.from(new Set(members.map((m) => (m.role || '').trim()).filter((r) => r && r.toLowerCase() !== 'admin' && r.toLowerCase() !== 'member')));
    const OTHER = '__other__';

    const applyRole = async (userId: string, role: string) => {
        try {
            const { error } = await supabase
                .from('project_space_members' as any)
                .update({ role })
                .eq('project_space_id', resolvedSpaceId)
                .eq('user_id', userId);
            if (error) throw error;
            toast({ title: 'Role updated', description: 'They have been told, and the change applies to them right away.' });
            fetchMembers();
        } catch (error: any) {
            toast({ title: 'Could not change the role', description: friendlyError(error), variant: 'destructive' });
            fetchMembers();
        }
    };

    const handleRoleChoice = async (member: TeamMember, choice: string) => {
        if (choice === OTHER) { setEditingRole(member.user_id); setTempRoleName(''); return; }
        const next = choice === 'admin' ? 'admin' : choice === 'member' ? 'member' : choice;
        if (next === (member.role || 'member')) return;
        if (member.role === 'admin' && next !== 'admin') {
            if (!await confirmDialog('They keep their place in the team but can no longer add people, remove members or change roles.', { title: 'Remove admin rights?', confirmLabel: 'Remove admin rights', destructive: true })) { fetchMembers(); return; }
        }
        if (next === 'admin') {
            if (!await confirmDialog('Admins can add people, remove members and change crew roles.', { title: 'Make this person an admin?', confirmLabel: 'Make admin', destructive: false })) { fetchMembers(); return; }
        }
        await applyRole(member.user_id, next);
    };

    const renderRoleSelect = (member: TeamMember) => {
        const current = (member.role || 'member').trim() || 'member';
        const known = ['admin', 'member', ...crewRoles];
        const options = known.includes(current) ? known : [...known, current];
        return (
            <select
                aria-label={`Role for ${member.profiles.full_name || 'member'}`}
                value={current}
                onChange={(e) => handleRoleChoice(member, e.target.value)}
                className="mt-0.5 h-7 max-w-[11rem] rounded-md border border-border bg-background px-1.5 text-xs font-medium capitalize text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            >
                {options.map((r) => (<option key={r} value={r}>{r === 'admin' ? 'Admin' : r === 'member' ? 'Member' : r}</option>))}
                <option value={OTHER}>Other role…</option>
            </select>
        );
    };

    if (loading) {
        return <div className="p-8 text-muted-foreground">Loading team members...</div>;
    }

    return (
        <div className="p-4 sm:p-8 h-full overflow-y-auto no-scrollbar pb-24">
            <div className="mb-6">
                <WorkspaceHero
                    icon={Users}
                    title="Team"
                    description="The people working on this production."
                    stats={[
                        { label: 'Members', value: members.length },
                        { label: 'Admins', value: members.filter((m) => m.role === 'admin').length, tone: 'primary' },
                        { label: 'Crew', value: members.filter((m) => m.role !== 'admin').length, tone: 'success' },
                    ]}
                />
            </div>
            <div className="flex flex-wrap items-center justify-end gap-3 mb-6">
                {isInternal ? (
                    <div className="bg-muted/30 border border-border/50 px-6 py-2 rounded-2xl text-xs text-muted-foreground font-bold flex items-center gap-2">
                        <Users className="w-4 h-4" /> Observation Mode
                    </div>
                ) : canManage ? (
                    <div className="flex gap-3 w-full sm:w-auto">
                        <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
                            <DialogTrigger asChild>
                                <Button variant="outline" className="flex-1 sm:flex-none border-border bg-card hover:bg-accent rounded-2xl px-6 h-12 font-bold transition">
                                    <LinkIcon className="h-4 w-4 mr-2" />Invite Link
                                </Button>
                            </DialogTrigger>
                            <DialogContent className="sm:max-w-md bg-card border-border rounded-2xl">
                                <DialogHeader>
                                    <DialogTitle className="text-foreground">Generate Invite Link</DialogTitle>
                                    <DialogDescription className="text-muted-foreground">Share this link to invite collaborators.</DialogDescription>
                                </DialogHeader>
                                <div className="space-y-4">
                                    {!inviteCode ? (
                                        <Button onClick={generateInviteLink} className="w-full bg-primary text-primary-foreground rounded-xl h-12 font-bold">
                                            Generate Invite Link
                                        </Button>
                                    ) : (
                                        <>
                                            <div>
                                                <Label className="text-foreground">Invite Link</Label>
                                                <div className="flex gap-2 mt-2">
                                                    <Input
                                                        value={`${getAppOrigin()}/projects/join/${inviteCode}`}
                                                        readOnly
                                                        className="flex-1 bg-background border-border"
                                                    />
                                                    <Button onClick={copyInviteLink} variant="outline" className="border-border">
                                                        {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                                                    </Button>
                                                </div>
                                            </div>
                                            <p className="text-sm text-muted-foreground">
                                                This link will expire in 7 days. Share it with people you want to invite to this project.
                                            </p>
                                        </>
                                    )}
                                </div>
                            </DialogContent>
                        </Dialog>

                        <Dialog open={searchDialogOpen} onOpenChange={setSearchDialogOpen}>
                            <DialogTrigger asChild>
                                <Button className="flex-1 sm:flex-none bg-primary hover:bg-primary/80 text-primary-foreground rounded-2xl px-6 h-12 font-bold shadow-sm transition">
                                    <UserPlus className="h-4 w-4 mr-2" />Add Member
                                </Button>
                            </DialogTrigger>
                            <DialogContent className="sm:max-w-md bg-card border-border rounded-2xl">
                                <DialogHeader>
                                    <DialogTitle className="text-foreground">Search Users</DialogTitle>
                                    <DialogDescription className="text-muted-foreground">Find and add team members by name.</DialogDescription>
                                </DialogHeader>
                                <div className="space-y-4">
                                    <div className="flex gap-2">
                                        <Input
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                            placeholder="Search by name..."
                                            className="bg-background border-border"
                                            onKeyPress={(e) => e.key === 'Enter' && searchUsers()}
                                        />
                                        <Button aria-label="Search" onClick={searchUsers} disabled={searching} className="bg-primary text-primary-foreground">
                                            <Search className="h-4 w-4" />
                                        </Button>
                                    </div>

                                    {searchResults.length > 0 && (
                                        <div className="space-y-2 max-h-96 overflow-y-auto">
                                            {searchResults.map(user => (
                                                <div key={user.id} className="flex items-center justify-between p-3 bg-accent/50 border border-border rounded-xl">
                                                    <div className="flex items-center gap-3">
                                                        {user.avatar_url ? (
                                                            <img loading="lazy" decoding="async" src={user.avatar_url} alt={user.full_name || 'User'} className="h-10 w-10 rounded-full object-cover" />
                                                        ) : (
                                                            <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold">
                                                                {(user.full_name || 'U')[0].toUpperCase()}
                                                            </div>
                                                        )}
                                                        <div>
                                                            <p className="font-medium text-foreground">{user.full_name || 'Unknown User'}</p>
                                                            {user.bio && <p className="text-sm text-muted-foreground line-clamp-1">{user.bio}</p>}
                                                        </div>
                                                    </div>
                                                    <Button size="sm" onClick={() => addMember(user)} className="bg-primary text-primary-foreground rounded-xl">
                                                        Add
                                                    </Button>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {searchQuery && searchResults.length === 0 && !searching && (
                                        <p className="text-center text-muted-foreground py-4">No users found</p>
                                    )}
                                </div>
                            </DialogContent>
                        </Dialog>
                    </div>
                ) : null}
            </div>

            {/* Admins Section */}
            {members.filter(m => m.role === 'admin').length > 0 && (
                <div className="mb-8">
                    <h3 className="text-xs font-bold text-muted-foreground mb-4 px-1">Project Admins</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {members.filter(m => m.role === 'admin').map(member => (
                            <div key={member.user_id} className="p-5 bg-card border border-border rounded-2xl hover:bg-accent/50 hover:border-primary/20 transition duration-300 shadow-sm group relative overflow-hidden">
                                <div className="absolute top-0 right-0 w-16 h-16 bg-primary/5 -rotate-45 translate-x-8 -translate-y-8" />
                                <div className="flex items-center justify-between relative z-10">
                                    <div className="flex items-center gap-3">
                                        {member.profiles.avatar_url ? (
                                            <img loading="lazy" decoding="async" src={member.profiles.avatar_url} alt={member.profiles.full_name || 'Member'} className="h-12 w-12 rounded-full object-cover border-2 border-primary/20 shadow-sm" />
                                        ) : (
                                            <div className="h-12 w-12 rounded-full bg-primary/15 flex items-center justify-center text-lg font-bold text-primary shadow-sm">
                                                {(member.profiles.full_name || 'U')[0].toUpperCase()}
                                            </div>
                                        )}
                                        <div>
                                            <p className="font-bold text-foreground">{member.profiles.full_name || 'Unknown User'}</p>
                                            {member.is_owner ? (
                                                <p className="text-xs font-bold text-primary mt-0.5">Owner</p>
                                            ) : canManage && !isInternal ? (
                                                renderRoleSelect(member)
                                            ) : (
                                                <p className="text-xs font-bold text-primary mt-0.5">Admin</p>
                                            )}
                                        </div>
                                    </div>
                                    {canManage && !isInternal && !member.is_owner && member.user_id !== user?.id && (
                                        <Button aria-label="Delete" size="sm" variant="ghost" onClick={() => removeMember(member.user_id)} className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive rounded-full h-9 w-9 p-0">
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Regular Members Section */}
            {members.filter(m => m.role !== 'admin').length > 0 && (
                <div>
                    <h3 className="text-xs font-bold text-muted-foreground mb-4 px-1">Team Members</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {members.filter(m => m.role !== 'admin').map(member => (
                            <div key={member.user_id} className="p-5 bg-card border border-border rounded-2xl hover:bg-accent/50 hover:border-primary/20 transition duration-300 shadow-sm group">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        {member.profiles.avatar_url ? (
                                            <img loading="lazy" decoding="async" src={member.profiles.avatar_url} alt={member.profiles.full_name || 'Member'} className="h-12 w-12 rounded-full object-cover border-2 border-border" />
                                        ) : (
                                            <div className="h-12 w-12 rounded-full bg-secondary flex items-center justify-center text-lg font-bold text-muted-foreground">
                                                {(member.profiles.full_name || 'U')[0].toUpperCase()}
                                            </div>
                                        )}
                                        <div>
                                            <p className="font-bold text-foreground">{member.profiles.full_name || 'Unknown User'}</p>
                                            {!canEditRoles ? (
                                                <p className="text-xs font-medium capitalize text-muted-foreground mt-0.5">{member.role || 'Member'}</p>
                                            ) : editingRole === member.user_id ? (
                                                <div className="flex items-center gap-2 mt-0.5">
                                                    <Input 
                                                        value={tempRoleName} 
                                                        onChange={(e) => setTempRoleName(e.target.value)} 
                                                        className="h-6 text-xs p-1 border-primary/20 bg-background focus-visible:ring-1 focus-visible:ring-primary w-32" 
                                                        autoFocus 
                                                        onKeyDown={(e) => { if(e.key === 'Enter') handleUpdateRole(member.user_id); else if(e.key === 'Escape') setEditingRole(null); }}
                                                        onBlur={() => handleUpdateRole(member.user_id)}
                                                    />
                                                </div>
                                            ) : (
                                                renderRoleSelect(member)
                                            )}
                                        </div>
                                    </div>
                                    {canEditRoles && !member.is_owner && member.user_id !== user?.id && (
                                        <Button aria-label="Delete" size="sm" variant="ghost" onClick={() => removeMember(member.user_id)} className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive rounded-full h-9 w-9 p-0">
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {members.length === 0 && (
                <div className="flex flex-col items-center justify-center py-24 text-center">
                    <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mb-6 border border-primary/20">
                        <Users className="w-10 h-10 text-primary" />
                    </div>
                    <h3 className="text-xl font-bold text-foreground mb-2">No Team Members</h3>
                    <p className="text-muted-foreground max-w-xs">Click "Add Member" or "Invite Link" to get started building your crew.</p>
                </div>
            )}
        </div>
    );
};

export default Team;
