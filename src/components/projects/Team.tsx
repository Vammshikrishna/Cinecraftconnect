import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/contexts/AuthContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { UserPlus, Link as LinkIcon, Copy, Search, Trash2, Check } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface TeamMember {
    user_id: string;
    role: string;
    profiles: {
        full_name: string | null;
        avatar_url: string | null;
    };
}

interface SearchResult {
    id: string;
    full_name: string | null;
    avatar_url: string | null;
    bio: string | null;
}

interface TeamProps {
    project_id: string;
}

const Team = ({ project_id }: TeamProps) => {
    const { user } = useAuth();
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

    const fetchMembers = useCallback(async () => {
        try {
            const { data, error } = await supabase
                .from('project_space_members' as any)
                .select(`
                    user_id,
                    role,
                    profiles:user_id (
                        full_name,
                        avatar_url
                    )
                `)
                .eq('project_space_id', project_id);

            if (error) throw error;

            const formattedMembers = data?.map((member: any) => ({
                user_id: member.user_id,
                role: member.role,
                profiles: {
                    full_name: member.profiles?.full_name || null,
                    avatar_url: member.profiles?.avatar_url || null
                }
            })) || [];

            setMembers(formattedMembers);
        } catch (error: any) {
            console.error('Error fetching members:', error);
        } finally {
            setLoading(false);
        }
    }, [project_id]);

    useEffect(() => {
        fetchMembers();

        const channel = supabase
            .channel(`project_space_members:${project_id}`)
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'project_space_members',
                filter: `project_space_id=eq.${project_id}`
            }, () => {
                fetchMembers();
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [project_id, fetchMembers]);

    const generateInviteLink = async () => {
        try {
            // Generate random invite code
            const code = Math.random().toString(36).substring(2, 15);

            const { error } = await supabase
                .from('project_invites' as any)
                .insert([{
                    project_id,
                    invite_code: code,
                    created_by: user?.id,
                    expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() // 7 days
                }]);

            if (error) throw error;

            setInviteCode(code);
            toast({ title: "Success", description: "Invite link generated" });
        } catch (error: any) {
            toast({ title: "Error", description: "Failed to generate invite link", variant: "destructive" });
        }
    };

    const copyInviteLink = () => {
        const link = `${window.location.origin}/projects/join/${inviteCode}`;
        navigator.clipboard.writeText(link);
        setCopied(true);
        toast({ title: "Copied!", description: "Invite link copied to clipboard" });
        setTimeout(() => setCopied(false), 2000);
    };

    const searchUsers = async () => {
        if (!searchQuery.trim()) return;

        setSearching(true);
        try {
            const { data, error } = await supabase
                .from('profiles')
                .select('id, full_name, avatar_url, bio')
                .ilike('full_name', `%${searchQuery}%`)
                .limit(10);

            if (error) throw error;

            // Filter out users already in the project
            const memberIds = members.map(m => m.user_id);
            const filtered = data?.filter(user => !memberIds.includes(user.id)) || [];

            setSearchResults(filtered);
        } catch (error: any) {
            toast({ title: "Error", description: "Failed to search users", variant: "destructive" });
        } finally {
            setSearching(false);
        }
    };

    const addMember = async (userId: string) => {
        try {
            const { error } = await supabase
                .from('project_space_members' as any)
                .insert([{
                    project_space_id: project_id,
                    user_id: userId,
                    role: 'member'
                }]);

            if (error) throw error;

            toast({ title: "Success", description: "Member added to project" });
            setSearchResults(searchResults.filter(u => u.id !== userId));
            fetchMembers();
        } catch (error: any) {
            toast({ title: "Error", description: "Failed to add member", variant: "destructive" });
        }
    };

    const removeMember = async (userId: string) => {
        if (!confirm('Remove this member from the project?')) return;

        try {
            const { error } = await supabase
                .from('project_space_members' as any)
                .delete()
                .eq('project_space_id', project_id)
                .eq('user_id', userId);

            if (error) throw error;

            toast({ title: "Success", description: "Member removed" });
            fetchMembers();
        } catch (error: any) {
            toast({ title: "Error", description: "Failed to remove member", variant: "destructive" });
        }
    };

    if (loading) {
        return <div className="p-8">Loading team members...</div>;
    }

    return (
        <div className="p-8">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold">Team Management</h1>
                <div className="flex gap-2">
                    <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
                        <DialogTrigger asChild>
                            <Button variant="outline"><LinkIcon className="h-4 w-4 mr-2" />Invite Link</Button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>Generate Invite Link</DialogTitle>
                            </DialogHeader>
                            <div className="space-y-4">
                                {!inviteCode ? (
                                    <Button onClick={generateInviteLink} className="w-full">
                                        Generate Invite Link
                                    </Button>
                                ) : (
                                    <>
                                        <div>
                                            <Label>Invite Link</Label>
                                            <div className="flex gap-2 mt-2">
                                                <Input
                                                    value={`${window.location.origin}/projects/join/${inviteCode}`}
                                                    readOnly
                                                    className="flex-1"
                                                />
                                                <Button onClick={copyInviteLink} variant="outline">
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
                            <Button><UserPlus className="h-4 w-4 mr-2" />Add Member</Button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>Search Users</DialogTitle>
                            </DialogHeader>
                            <div className="space-y-4">
                                <div className="flex gap-2">
                                    <Input
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        placeholder="Search by name..."
                                        onKeyPress={(e) => e.key === 'Enter' && searchUsers()}
                                    />
                                    <Button onClick={searchUsers} disabled={searching}>
                                        <Search className="h-4 w-4" />
                                    </Button>
                                </div>

                                {searchResults.length > 0 && (
                                    <div className="space-y-2 max-h-96 overflow-y-auto">
                                        {searchResults.map(user => (
                                            <div key={user.id} className="flex items-center justify-between p-3 bg-slate-800/50 rounded">
                                                <div className="flex items-center gap-3">
                                                    {user.avatar_url ? (
                                                        <img src={user.avatar_url} alt={user.full_name || 'User'} className="h-10 w-10 rounded-full" />
                                                    ) : (
                                                        <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center">
                                                            {(user.full_name || 'U')[0].toUpperCase()}
                                                        </div>
                                                    )}
                                                    <div>
                                                        <p className="font-medium">{user.full_name || 'Unknown User'}</p>
                                                        {user.bio && <p className="text-sm text-muted-foreground line-clamp-1">{user.bio}</p>}
                                                    </div>
                                                </div>
                                                <Button size="sm" onClick={() => addMember(user.id)}>
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
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {members.map(member => (
                    <div key={member.user_id} className="p-4 bg-slate-800/50 rounded-lg hover:bg-slate-800/70 transition-colors">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                {member.profiles.avatar_url ? (
                                    <img src={member.profiles.avatar_url} alt={member.profiles.full_name || 'Member'} className="h-12 w-12 rounded-full" />
                                ) : (
                                    <div className="h-12 w-12 rounded-full bg-primary/20 flex items-center justify-center text-lg font-semibold">
                                        {(member.profiles.full_name || 'U')[0].toUpperCase()}
                                    </div>
                                )}
                                <div>
                                    <p className="font-medium">{member.profiles.full_name || 'Unknown User'}</p>
                                    <p className="text-sm text-muted-foreground capitalize">{member.role}</p>
                                </div>
                            </div>
                            {member.user_id !== user?.id && (
                                <Button size="sm" variant="ghost" onClick={() => removeMember(member.user_id)}>
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            {members.length === 0 && (
                <div className="text-center py-12">
                    <UserPlus className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">No team members yet.</p>
                    <p className="text-sm text-muted-foreground mt-2">Click "Add Member" or "Invite Link" to get started.</p>
                </div>
            )}
        </div>
    );
};

export default Team;
