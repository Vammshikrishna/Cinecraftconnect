import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { User, Check, X } from 'lucide-react';

interface Applicant {
  id: string;
  user_id: string;
  status: string;
  profiles: {
    full_name: string;
    avatar_url: string;
    craft: string;
  } | null;
}

interface ProjectApplicantsProps {
  projectId: string;
}

const ProjectApplicants = ({ projectId }: ProjectApplicantsProps) => {
  const [applicants, setApplicants] = useState<Applicant[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    fetchApplicants();
  }, [projectId]);

  const fetchApplicants = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('project_applications')
      .select(`
        id,
        user_id,
        status,
        profiles (
          full_name,
          avatar_url,
          craft
        )
      `)
      .eq('project_id', projectId);

    if (error) {
      console.error("Error fetching applicants:", error);
      toast({
        title: "Error",
        description: "Failed to load applicants. The database may be temporarily unavailable.",
        variant: "destructive",
      });
    } else {
      setApplicants(data as any);
    }
    setLoading(false);
  };

  const handleApplication = async (applicationId: string, userId: string, newStatus: 'approved' | 'rejected') => {
    setProcessingId(applicationId);

    const { error: updateError } = await supabase
      .from('project_applications')
      .update({ status: newStatus })
      .eq('id', applicationId);

    if (updateError) {
      toast({
        title: "Error",
        description: `Failed to ${newStatus === 'approved' ? 'approve' : 'reject'} application. Please try again.`,
        variant: "destructive",
      });
      setProcessingId(null);
      return;
    }

    if (newStatus === 'approved') {
      const { error: insertError } = await supabase
        .from('project_members')
        .upsert({ 
            project_id: projectId, 
            user_id: userId, 
            role: 'member' 
        });

      if (insertError) {
        toast({
            title: "Error",
            description: "Application was approved, but failed to add the user to the project team.",
            variant: "destructive",
        });
      } else {
        toast({
            title: "Success",
            description: "Application approved and user added to the project team.",
        });
      }
    } else {
        toast({
            title: "Success",
            description: "Application has been rejected.",
        });
    }

    setProcessingId(null);
    fetchApplicants();
  };

  if (loading) {
    return <div className="flex justify-center items-center py-8"><LoadingSpinner /></div>;
  }

  return (
    <div className="space-y-4">
      {applicants.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
            <User className="mx-auto h-12 w-12 mb-4" />
            <h3 className="text-lg font-semibold">No Applicants Yet</h3>
            <p className="text-sm">Check back later to see who has applied to your project.</p>
        </div>
      ) : (
        applicants.map(applicant => (
          <div key={applicant.id} className="flex items-center justify-between p-4 rounded-lg bg-card border">
            <div className="flex items-center gap-4">
              <Avatar>
                <AvatarImage src={applicant.profiles?.avatar_url} />
                <AvatarFallback>{applicant.profiles?.full_name?.charAt(0) || 'U'}</AvatarFallback>
              </Avatar>
              <div>
                <p className="font-semibold">{applicant.profiles?.full_name}</p>
                <p className="text-sm text-muted-foreground">{applicant.profiles?.craft || 'No craft specified'}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
                {applicant.status === 'pending' ? (
                    <>
                        <Button 
                            size="sm" 
                            variant="outline" 
                            onClick={() => handleApplication(applicant.id, applicant.user_id, 'approved')}
                            disabled={processingId === applicant.id}
                        >
                            <Check className="h-4 w-4 mr-2" />
                            Approve
                        </Button>
                        <Button 
                            size="sm" 
                            variant="destructive" 
                            onClick={() => handleApplication(applicant.id, applicant.user_id, 'rejected')}
                            disabled={processingId === applicant.id}
                        >
                            <X className="h-4 w-4 mr-2" />
                            Reject
                        </Button>
                    </>
                ) : (
                    <p className={`text-sm font-semibold ${applicant.status === 'approved' ? 'text-green-500' : 'text-red-500'}`}>
                        {applicant.status.charAt(0).toUpperCase() + applicant.status.slice(1)}
                    </p>
                )}
            </div>
          </div>
        ))
      )}
    </div>
  );
};

export default ProjectApplicants;
