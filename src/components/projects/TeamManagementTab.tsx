import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Check, X, UserX } from 'lucide-react';

interface TeamManagementTabProps {
  projectId: string;
  isOwner: boolean;
}

interface Applicant {
  id: string;
  role: string;
  message: string;
  profiles: {
    id: string;
    full_name: string;
    avatar_url: string;
    craft: string;
  } | null;
}

interface Member {
  user_id: string;
  role: string;
  profiles: {
    id: string;
    full_name: string;
    avatar_url: string;
    craft: string;
  } | null;
}

export const TeamManagementTab = ({ projectId, isOwner }: TeamManagementTabProps) => {
  const [applicants, setApplicants] = useState<Applicant[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: applicantsData, error: applicantsError } = await supabase
        .from('project_applications')
        .select('id, role, message, profiles (*)')
        .eq('project_id', projectId)
        .eq('status', 'pending');
      if (applicantsError) throw applicantsError;
      setApplicants(applicantsData as any);

      const { data: membersData, error: membersError } = await supabase
        .from('project_space_members')
        .select('user_id, role, profiles (*)')
        .eq('project_space_id', projectId);
      if (membersError) throw membersError;
      setMembers(membersData as any);

    } catch (error: any) {
      toast({ title: 'Error loading team data', description: error.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [projectId]);

  const handleApplication = async (applicationId: string, applicantProfile: Applicant['profiles'], role: string, accept: boolean) => {
    if (!applicantProfile) return;
    if (accept) {
      const { error: insertError } = await supabase.from('project_space_members').insert({ project_space_id: projectId, user_id: applicantProfile.id, role });
      if (insertError) {
        toast({ title: 'Error', description: 'Failed to add member.', variant: 'destructive' });
        return;
      }
    }

    const { error: updateError } = await supabase.from('project_applications').update({ status: accept ? 'accepted' : 'rejected' }).eq('id', applicationId);
    if (updateError) {
      toast({ title: 'Error', description: 'Failed to update application.', variant: 'destructive' });
    } else {
      toast({ title: 'Success', description: `Application ${accept ? 'accepted' : 'rejected'}.` });
      fetchData();
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    const { error } = await supabase.from('project_space_members').delete().eq('user_id', memberId).eq('project_space_id', projectId);
    if (error) {
      toast({ title: 'Error', description: 'Failed to remove member.', variant: 'destructive' });
    } else {
      toast({ title: 'Success', description: 'Member removed from project.' });
      fetchData();
    }
  };

  if (loading) return <div>Loading team...</div>;

  return (
    <div className="grid md:grid-cols-2 gap-8">
      {isOwner && (
        <Card>
          <CardHeader><CardTitle>Pending Applications ({applicants.length})</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {applicants.length === 0 ? <p className="text-muted-foreground">No pending applications.</p> : applicants.map(app => (
              <div key={app.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                <div className="flex items-center gap-3">
                  <Avatar><AvatarImage src={app.profiles?.avatar_url} /><AvatarFallback>{app.profiles?.full_name[0]}</AvatarFallback></Avatar>
                  <div>
                    <p className="font-semibold">{app.profiles?.full_name}</p>
                    <p className="text-sm text-muted-foreground">Applying for: <Badge variant="secondary">{app.role}</Badge></p>
                    {app.message && <p className="text-xs mt-1 italic">\"{app.message}\"</p>}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button size="icon" variant="outline" className="text-green-500 hover:text-green-600" onClick={() => handleApplication(app.id, app.profiles, app.role, true)}><Check className="h-4 w-4" /></Button>
                  <Button size="icon" variant="outline" className="text-red-500 hover:text-red-600" onClick={() => handleApplication(app.id, app.profiles, app.role, false)}><X className="h-4 w-4" /></Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card className={!isOwner ? 'md:col-span-2' : ''}>
        <CardHeader><CardTitle>Team Members ({members.length})</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {members.length === 0 ? <p className="text-muted-foreground">No team members yet.</p> : members.map(member => (
            <div key={member.user_id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
              <div className="flex items-center gap-3">
                <Avatar><AvatarImage src={member.profiles?.avatar_url} /><AvatarFallback>{member.profiles?.full_name[0]}</AvatarFallback></Avatar>
                <div>
                  <p className="font-semibold">{member.profiles?.full_name}</p>
                  <p className="text-sm text-muted-foreground">{member.profiles?.craft}</p>
                </div>
                <Badge variant="outline">{member.role}</Badge>
              </div>
              {isOwner && <Button size="icon" variant="ghost" className="text-muted-foreground hover:text-red-500" onClick={() => handleRemoveMember(member.user_id)}><UserX className="h-4 w-4" /></Button>}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
};
