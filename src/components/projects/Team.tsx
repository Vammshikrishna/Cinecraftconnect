import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/contexts/AuthContext';

interface TeamMember {
    id: string; // User ID
    name: string;
    role: string;
    email: string;
}

interface TeamProps {
    project_id: string;
}

const Team = ({ project_id }: TeamProps) => {
    const { user } = useAuth();
    const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [newMemberEmail, setNewMemberEmail] = useState('');
    const [isInviting, setIsInviting] = useState(false);

    const fetchTeamMembers = useCallback(async () => {
        if (!project_id) return;
        
        const { data, error } = await supabase
            .from('project_members')
            .select('role, profiles (id, full_name, email)')
            .eq('project_id', project_id);

        if (error) {
            console.error('Error fetching team members:', error);
            setError(error.message);
        } else if (data) {
            const members = data.map((item: any) => ({
                id: item.profiles.id,
                name: item.profiles.full_name,
                email: item.profiles.email,
                role: item.role,
            }));
            setTeamMembers(members);
        }
    }, [project_id]);

    useEffect(() => {
        fetchTeamMembers();

        const channel = supabase
            .channel(`team-updates-for-project-${project_id}`)
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'project_members', filter: `project_id=eq.${project_id}` },
                (payload) => {
                    console.log('Team members updated:', payload);
                    fetchTeamMembers();
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [project_id, fetchTeamMembers]);

    const handleInvite = async () => {
        if (newMemberEmail.trim() === '' || !user) return;

        setIsInviting(true);

        // The Supabase Edge Function should be updated to handle project-based invites.
        const { error } = await supabase.functions.invoke('invite-user-to-project', {
            body: { 
                email: newMemberEmail, 
                projectId: project_id,
                inviterId: user.id 
            },
        });

        if (error) {
            console.error('Error inviting user:', error);
            alert(`Failed to invite user: ${error.message}`);
        } else {
            setNewMemberEmail('');
            alert('Invitation sent successfully!');
        }

        setIsInviting(false);
    };

    if (error) {
        return <div className="p-8 text-destructive">Error loading team members: {error}</div>;
    }

    return (
        <div className="p-8 flex flex-col h-full">
            <h1 className="text-2xl font-bold mb-6">Team Management</h1>
            <div className="flex gap-4 mb-6">
                <Input
                    type="email"
                    value={newMemberEmail}
                    onChange={(e) => setNewMemberEmail(e.target.value)}
                    placeholder="Invite a new team member by email"
                    className="flex-grow"
                />
                <Button onClick={handleInvite} disabled={isInviting}>
                    {isInviting ? 'Inviting...' : 'Send Invite'}
                </Button>
            </div>
            <div className="flex-grow overflow-y-auto">
                <ul className="divide-y divide-border/50">
                    {teamMembers.map(member => (
                        <li key={member.id} className="flex justify-between items-center p-4 hover:bg-muted/50">
                            <div>
                                <p className="font-semibold">{member.name}</p>
                                <p className="text-sm text-muted-foreground">{member.email}</p>
                            </div>
                            <span className="text-sm font-medium bg-secondary text-secondary-foreground py-1 px-3 rounded-full capitalize">{member.role}</span>
                        </li>
                    ))}
                </ul>
            </div>
        </div>
    );
};

export default Team;
