import { useState, useEffect, useCallback } from 'react';
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
  // const { user } = useAuth(); // Not currently used

  // Resolve space ID if different from projectId
  const [resolvedSpaceId, setResolvedSpaceId] = useState<string>(projectId);

  useEffect(() => {
    let mounted = true;
    const resolveSpace = async () => {
      if (!projectId) return;
      try {
        const { data } = await supabase
          .from('project_spaces')
          .select('id')
          .eq('project_id', projectId)
          .maybeSingle();

        if (mounted && data) {
          setResolvedSpaceId(data.id);
        }
      } catch (e) {
        // Ignore
      }
    };
    resolveSpace();
    return () => { mounted = false; };
  }, [projectId]);

  const fetchApplicants = useCallback(async () => {
    setLoading(true);
    // Fetch join requests for this Space
    const { data: requests, error } = await supabase
      .from('project_space_join_requests' as any)
      .select(`
        id,
        user_id,
        status,
        profiles:user_id (
          full_name,
          avatar_url,
          craft
        )
      `)
      .eq('project_space_id', resolvedSpaceId); // Use resolvedSpaceId!

    if (error) {
      console.error("Error fetching applicants:", error);
      toast({
        title: "Error",
        description: "Failed to load applicants.",
        variant: "destructive",
      });
    } else {
      // Map to expected format if needed, but the Select matches the interface roughly
      setApplicants(requests as any);
    }
    setLoading(false);
  }, [resolvedSpaceId, toast]); // resolvedSpaceId dependency

  useEffect(() => {
    if (resolvedSpaceId) {
      fetchApplicants();
    }
  }, [resolvedSpaceId, fetchApplicants]);

  const handleApplication = async (requestId: string, _userId: string, newStatus: 'approved' | 'rejected') => {
    setProcessingId(requestId);

    try {
      let error;
      if (newStatus === 'approved') {
        const { error: rpcError } = await supabase.rpc('approve_join_request' as any, { _request_id: requestId });
        error = rpcError;
      } else {
        const { error: rpcError } = await supabase.rpc('reject_join_request' as any, { _request_id: requestId });
        error = rpcError;
      }

      if (error) throw error;

      toast({
        title: "Success",
        description: newStatus === 'approved' ? "User approved and added to team." : "Request rejected.",
      });

      // Optimistic update or refetch
      fetchApplicants();

    } catch (err) {
      console.error("Error processing request:", err);
      toast({
        title: "Error",
        description: "Failed to process request. Please try again.",
        variant: "destructive",
      });
    } finally {
      setProcessingId(null);
    }
  };

  if (loading) {
    return <div className="flex justify-center items-center py-8"><LoadingSpinner /></div>;
  }

  return (
    <div className="space-y-4 h-full overflow-y-auto p-4 sm:p-8">
      {applicants.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <User className="mx-auto h-12 w-12 mb-4" />
          <h3 className="text-lg font-semibold">No Applicants Yet</h3>
          <p className="text-sm">Check back later to see who has applied to your project.</p>
        </div>
      ) : (
        applicants.map(applicant => (
          <div key={applicant.id} className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 rounded-lg bg-card border gap-4">
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
            <div className="flex items-center gap-2 w-full sm:w-auto">
              {applicant.status === 'pending' ? (
                <>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleApplication(applicant.id, applicant.user_id, 'approved')}
                    disabled={processingId === applicant.id}
                    className="flex-1 sm:flex-none"
                  >
                    <Check className="h-4 w-4 mr-2" />
                    Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => handleApplication(applicant.id, applicant.user_id, 'rejected')}
                    disabled={processingId === applicant.id}
                    className="flex-1 sm:flex-none"
                  >
                    <X className="h-4 w-4 mr-2" />
                    Reject
                  </Button>
                </>
              ) : (
                <p className={`text-sm font-semibold w-full text-center sm:text-left ${applicant.status === 'approved' ? 'text-green-500' : 'text-red-500'}`}>
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
