import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { Check, X, UserPlus } from 'lucide-react';
import { useAppRole } from '@/hooks/useAppRole';

interface Applicant {
  id: string;
  user_id: string;
  status: string;
  message: string | null;
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
  const { isInternal } = useAppRole();
  const [applicants, setApplicants] = useState<Applicant[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const { toast } = useToast();

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
    const { data: requests, error } = await supabase
      .from('project_space_join_requests' as any)
      .select(`
        id,
        user_id,
        status,
        message,
        profiles:user_id (
          full_name,
          avatar_url,
          craft,
          is_internal
        )
      `)
      .eq('project_space_id', resolvedSpaceId)
      .eq('status', 'pending');

    if (error) {
      toast({ title: "Error", description: "Failed to load applicants.", variant: "destructive" });
    } else {
      const { data: members } = await supabase
        .from('project_space_members')
        .select('user_id')
        .eq('project_space_id', resolvedSpaceId);
      
      const memberIds = new Set(members?.map(m => m.user_id) || []);
      const pendingRequests = (requests || []).filter((req: any) => !memberIds.has(req.user_id) && !req.profiles?.is_internal);
      
      setApplicants(pendingRequests as any);
    }
    setLoading(false);
  }, [resolvedSpaceId, toast]);

  useEffect(() => {
    if (resolvedSpaceId) {
      fetchApplicants();
    }
  }, [resolvedSpaceId, fetchApplicants]);

  const handleApplication = async (requestId: string, _userId: string, newStatus: 'approved' | 'rejected') => {
    setProcessingId(requestId);

    try {
      if (newStatus === 'approved') {
        const { error: rpcError } = await supabase.rpc('approve_join_request' as any, { _request_id: requestId });
        if (rpcError) throw rpcError;
        
        await supabase
          .from('project_space_join_requests' as any)
          .update({ status: 'approved' })
          .eq('id', requestId);
      } else {
        const { error: rpcError } = await supabase.rpc('reject_join_request' as any, { _request_id: requestId });
        if (rpcError) throw rpcError;
        
        await supabase
          .from('project_space_join_requests' as any)
          .update({ status: 'rejected' })
          .eq('id', requestId);
      }

      toast({
        title: "Success",
        description: newStatus === 'approved' ? "User approved and added to team." : "Request rejected.",
      });

      fetchApplicants();

    } catch (err) {
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
        <div className="p-4 sm:p-8 h-full overflow-y-auto no-scrollbar pb-24">
            <div className="flex flex-col gap-1 mb-8">
                <h1 className="text-xs font-bold tracking-[0.2em] text-primary uppercase">Requests</h1>
                <p className="text-3xl font-extrabold text-foreground">Applicants</p>
            </div>

      {applicants.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mb-6 border border-primary/20">
            <UserPlus className="w-10 h-10 text-primary" />
          </div>
          <h3 className="text-xl font-bold text-foreground mb-2">No Pending Applicants</h3>
          <p className="text-muted-foreground max-w-xs">Check back later to see who has applied to your project.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {applicants.map(applicant => (
            <div key={applicant.id} className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-5 rounded-2xl bg-card border border-border gap-4 shadow-sm hover:bg-accent/50 hover:border-primary/20 transition-all duration-300">
              <div className="flex items-center gap-4">
                <Avatar className="h-12 w-12 border-2 border-primary/20">
                  <AvatarImage src={applicant.profiles?.avatar_url} />
                  <AvatarFallback className="bg-primary/15 text-primary font-bold">{applicant.profiles?.full_name?.charAt(0) || 'U'}</AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-bold text-foreground text-lg">{applicant.profiles?.full_name}</p>
                  <p className="text-sm text-primary font-medium">{applicant.profiles?.craft || 'No craft specified'}</p>
                  {applicant.message && (
                    <p className="text-sm text-muted-foreground mt-2 italic bg-muted/30 p-2 rounded-lg border border-border/50">
                      "{applicant.message}"
                    </p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 w-full sm:w-auto">
                {applicant.status === 'pending' ? (
                  !isInternal ? (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleApplication(applicant.id, applicant.user_id, 'approved')}
                        disabled={processingId === applicant.id}
                        className="flex-1 sm:flex-none border-primary/30 text-primary hover:bg-primary hover:text-primary-foreground rounded-xl h-11 font-bold transition-all"
                      >
                        <Check className="h-4 w-4 mr-2" />
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => handleApplication(applicant.id, applicant.user_id, 'rejected')}
                        disabled={processingId === applicant.id}
                        className="flex-1 sm:flex-none rounded-xl h-11 font-bold"
                      >
                        <X className="h-4 w-4 mr-2" />
                        Reject
                      </Button>
                    </>
                  ) : (
                    <div className="bg-muted/30 border border-border/50 px-4 py-2 rounded-xl text-xs text-muted-foreground font-bold uppercase tracking-widest">
                      Observation Mode
                    </div>
                  )
                ) : (
                  <p className={`text-sm font-semibold w-full text-center sm:text-left ${applicant.status === 'approved' ? 'text-primary' : 'text-red-500'}`}>
                    {applicant.status.charAt(0).toUpperCase() + applicant.status.slice(1)}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ProjectApplicants;

