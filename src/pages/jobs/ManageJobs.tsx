import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, ArrowLeft, FileText, CheckCircle2, XCircle, Clock, Search, Eye, Building2, Edit2, MessageSquare } from "lucide-react";
import { Link } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { JobCreationModal } from "@/components/jobs/JobCreationModal";

interface JobWithApplications {
    id: string;
    title: string;
    created_at: string | null;
    is_active: boolean;
    company_pages: {
        name: string;
        logo_url: string | null;
    } | null;
    applications: {
        id: string;
        status: string;
        cover_letter: string | null;
        resume_url: string | null;
        created_at: string | null;
        applicant_id: string;
        applicant: {
            full_name: string;
            username: string;
            avatar_url: string | null;
        };
    }[];
    [key: string]: any;
}

const ManageJobs = () => {
    const [jobs, setJobs] = useState<JobWithApplications[]>([]);
    const [loading, setLoading] = useState(true);
    const { user } = useAuth();
    const { toast } = useToast();

    const fetchJobsAndApplications = async () => {
        if (!user) return;
        try {
            // Check for pages the user manages (Owner, Member, or Admin)
            const [
                { data: ownedPages },
                { data: memberPages },
                { data: adminPages }
            ] = await Promise.all([
                supabase.from('company_pages' as any).select('id').eq('owner_id', user.id),
                supabase.from('company_page_members' as any).select('page_id').eq('user_id', user.id),
                supabase.from('company_page_admins' as any).select('page_id').eq('user_id', user.id)
            ]);
            
            const pageIds = [
                ...((ownedPages as any[])?.map(p => p.id) || []),
                ...((memberPages as any[])?.map(p => p.page_id) || []),
                ...((adminPages as any[])?.map(p => p.page_id) || [])
            ];
            
            // Remove duplicates
            const uniquePageIds = Array.from(new Set(pageIds));
            
            // Build query: jobs posted by user OR by pages they manage
            let query = supabase
                .from('jobs')
                .select('*, company_pages(name, logo_url)');
                
            if (uniquePageIds.length > 0) {
                query = query.or(`posted_by.eq.${user.id},page_id.in.(${uniquePageIds.join(',')})`);
            } else {
                query = query.eq('posted_by', user.id);
            }

            const { data: jobsData, error: jobsError } = await query.order('created_at', { ascending: false });

            if (jobsError) throw jobsError;

            // Fetch applications for these jobs
            const jobsWithApps = await Promise.all((jobsData || []).map(async (job) => {
                const { data: appsData, error: appsError } = await supabase
                    .from('job_applications')
                    .select(`
                        id,
                        status,
                        cover_letter,
                        resume_url,
                        created_at,
                        applicant_id,
                        applicant:applicant_id (
                            full_name,
                            username,
                            avatar_url
                        )
                    `)
                    .eq('job_id', job.id)
                    .order('created_at', { ascending: false });

                if (appsError) throw appsError;

                return {
                    ...job,
                    applications: appsData.map(app => ({
                        ...app,
                        applicant: app.applicant as any
                    }))
                };
            }));

            setJobs(jobsWithApps as any);
        } catch (error) {
            console.error('Error fetching jobs:', error);
            toast({
                title: "Error",
                description: "Failed to load your jobs and applications",
                variant: "destructive"
            });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchJobsAndApplications();

        // Real-time updates for jobs
        const channel = supabase
            .channel('jobs_management')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'jobs'
                },
                () => {
                    fetchJobsAndApplications();
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [user?.id]);

    const handleStatusUpdate = async (applicationId: string, newStatus: string) => {
        try {
            const { error } = await supabase
                .from('job_applications')
                .update({ status: newStatus as any })
                .eq('id', applicationId);

            if (error) throw error;

            toast({
                title: "Status Updated",
                description: "Application status has been updated successfully."
            });

            // Update local state instead of full refetch to be faster
            setJobs(prev => prev.map(job => ({
                ...job,
                applications: job.applications.map(app => 
                    app.id === applicationId ? { ...app, status: newStatus } : app
                )
            })));
        } catch (error) {
            console.error('Error updating status:', error);
            toast({
                title: "Error",
                description: "Failed to update status",
                variant: "destructive"
            });
        }
    };

    const handleToggleActive = async (jobId: string, currentStatus: boolean) => {
        try {
            const { error } = await supabase
                .from('jobs')
                .update({ is_active: !currentStatus })
                .eq('id', jobId);

            if (error) throw error;

            toast({
                title: "Job Updated",
                description: `Job has been marked as ${!currentStatus ? 'Active' : 'Closed'}.`
            });

            setJobs(prev => prev.map(job => job.id === jobId ? { ...job, is_active: !currentStatus } : job));
        } catch (error) {
            console.error('Error updating job status:', error);
            toast({
                title: "Error",
                description: "Failed to update job status",
                variant: "destructive"
            });
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'accepted': return 'bg-green-500/10 text-green-500 border-green-500/20';
            case 'rejected': return 'bg-red-500/10 text-red-500 border-red-500/20';
            case 'interviewing': return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
            case 'reviewing': return 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20';
            default: return 'bg-gray-500/10 text-gray-500 border-gray-500/20';
        }
    };

    if (loading) {
        return (
            <div className="flex justify-center items-center min-h-screen bg-background">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background pt-24 pb-24 px-4 md:px-8">
            <div className="max-w-6xl mx-auto space-y-8">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <Link to="/jobs">
                            <Button variant="ghost" size="icon" className="hover:bg-primary/10">
                                <ArrowLeft className="h-5 w-5" />
                            </Button>
                        </Link>
                        <div>
                            <h1 className="text-3xl font-bold tracking-tight">Manage Jobs</h1>
                            <p className="text-muted-foreground mt-1">Review applications and manage your postings.</p>
                        </div>
                    </div>
                    <Link to="/jobs">
                        <Button className="bg-primary hover:bg-primary/90">Post a New Job</Button>
                    </Link>
                </div>

                {jobs.length === 0 ? (
                    <Card className="glass-card text-center py-16 border-dashed border-2">
                        <CardContent className="flex flex-col items-center justify-center">
                            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                                <Search className="w-8 h-8 text-primary" />
                            </div>
                            <h3 className="text-xl font-semibold mb-2">No jobs posted currently</h3>
                            <p className="text-muted-foreground max-w-md mx-auto mb-6">
                                You haven't posted any jobs or aren't managing any company pages with active postings right now.
                            </p>
                        </CardContent>
                    </Card>
                ) : (
                    <div className="space-y-6">
                        {jobs.map((job) => (
                            <Card key={job.id} className="bg-card/40 border-border/50 backdrop-blur-sm overflow-hidden shadow-sm hover:shadow-md transition-all">
                                <div className="p-1 min-h-[4px] bg-gradient-to-r from-primary/40 to-primary/10 w-full" />
                                <CardHeader className="pb-4 sm:flex-row sm:items-start justify-between gap-4">
                                    <div className="flex gap-4">
                                        <div className="hidden sm:flex w-12 h-12 rounded-lg bg-primary/10 items-center justify-center shrink-0 border border-primary/20">
                                            {job.company_pages?.logo_url ? (
                                                <img src={job.company_pages.logo_url} alt="Logo" className="w-full h-full object-cover rounded-lg" />
                                            ) : (
                                                <Building2 className="w-6 h-6 text-primary" />
                                            )}
                                        </div>
                                        <div>
                                            <div className="flex flex-wrap items-center gap-2 mb-1">
                                                <CardTitle className="text-xl leading-tight">{job.title}</CardTitle>
                                                {!job.is_active && <Badge variant="destructive" className="text-[10px] uppercase font-bold tracking-wider">Closed</Badge>}
                                                {job.company_pages && <Badge variant="outline" className="text-xs text-primary bg-primary/5">{job.company_pages.name}</Badge>}
                                            </div>
                                            <div className="flex items-center text-sm text-muted-foreground gap-3 flex-wrap">
                                                <span className="flex items-center gap-1.5">
                                                    <Clock className="w-3.5 h-3.5" /> 
                                                    Posted {job.created_at ? formatDistanceToNow(new Date(job.created_at), { addSuffix: true }) : 'Unknown date'}
                                                </span>
                                                <span className="flex items-center gap-1.5 font-medium text-foreground">
                                                    <Badge variant="secondary" className="px-2 py-0 border-primary/20 bg-primary/5">{job.applications.length} Apps</Badge>
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="mt-4 sm:mt-0 flex items-center gap-2">
                                        <JobCreationModal 
                                            jobToEdit={job}
                                            onJobCreated={fetchJobsAndApplications}
                                            triggerButton={
                                                <Button variant="outline" size="sm" className="w-full sm:w-auto text-xs bg-background">
                                                    <Edit2 className="w-3.5 h-3.5 mr-1" /> Edit
                                                </Button>
                                            }
                                        />
                                        <Button
                                            variant={job.is_active ? "outline" : "secondary"}
                                            size="sm"
                                            className="w-full sm:w-auto text-xs"
                                            onClick={() => handleToggleActive(job.id, job.is_active)}
                                        >
                                            {job.is_active ? 'Close Job' : 'Reopen Job'}
                                        </Button>
                                    </div>
                                </CardHeader>
                                
                                <CardContent className="bg-muted/10 pt-6 border-t border-border/50">
                                    <h4 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4">
                                        Applicants
                                    </h4>
                                    
                                    {job.applications.length === 0 ? (
                                        <div className="text-center py-8 bg-background/50 rounded-lg border border-dashed border-border/60">
                                            <p className="text-muted-foreground text-sm">No one has applied to this position yet.</p>
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-1 gap-4">
                                            {job.applications.map((app) => (
                                                <div key={app.id} className="bg-background border border-border/80 rounded-xl p-4 sm:p-5 flex flex-col md:flex-row gap-5 hover:border-primary/40 transition-colors">
                                                    <div className="flex-grow flex flex-col gap-4">
                                                        <div className="flex items-start justify-between sm:justify-start gap-4">
                                                            <Link to={`/profile/${app.applicant_id}`}>
                                                                <Avatar className="w-12 h-12 border-2 border-background shadow-sm hover:border-primary/40 transition-colors">
                                                                    <AvatarImage src={app.applicant?.avatar_url || ''} />
                                                                    <AvatarFallback className="bg-primary/10 text-primary font-bold">
                                                                        {app.applicant?.full_name?.[0]?.toUpperCase() || 'U'}
                                                                    </AvatarFallback>
                                                                </Avatar>
                                                            </Link>
                                                            <div className="flex-1">
                                                                <Link to={`/profile/${app.applicant_id}`} className="hover:underline hover:text-primary transition-colors inline-block">
                                                                    <h5 className="font-semibold text-base leading-none mb-1">
                                                                        {app.applicant?.full_name || app.applicant?.username || 'Unknown Applicant'}
                                                                    </h5>
                                                                </Link>
                                                                <div className="flex items-center gap-2 mt-1 flex-wrap">
                                                                    <span className="text-xs text-muted-foreground">
                                                                        Applied {app.created_at ? formatDistanceToNow(new Date(app.created_at), { addSuffix: true }) : ''}
                                                                    </span>
                                                                    <Badge className={`text-[10px] uppercase font-bold border rounded px-2 py-0 ${getStatusColor(app.status)}`} variant="outline">
                                                                        {app.status}
                                                                    </Badge>
                                                                </div>
                                                            </div>
                                                        </div>

                                                        {app.cover_letter && (
                                                            <div className="bg-muted/30 p-3 sm:p-4 rounded-lg text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap border border-white/5">
                                                                {app.cover_letter}
                                                            </div>
                                                        )}

                                                        {app.resume_url && (
                                                            <div>
                                                                <a
                                                                    href={app.resume_url}
                                                                    target="_blank"
                                                                    rel="noopener noreferrer"
                                                                    className="inline-flex items-center gap-2 text-sm font-medium bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground px-4 py-2 rounded-lg transition-colors border border-primary/20"
                                                                >
                                                                    <FileText className="h-4 w-4" />
                                                                    View Application Documents
                                                                </a>
                                                            </div>
                                                        )}
                                                    </div>

                                                    <div className="md:w-[200px] shrink-0 border-t md:border-t-0 md:border-l border-border pt-4 md:pt-0 md:pl-5 flex flex-col justify-center gap-2">
                                                        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1 block">Update Status</label>
                                                        <div className="flex gap-2">
                                                            <Select
                                                                value={app.status || 'pending'}
                                                                onValueChange={(value) => handleStatusUpdate(app.id, value)}
                                                            >
                                                                <SelectTrigger className="flex-1 bg-background border-border shadow-sm">
                                                                    <SelectValue placeholder="Status" />
                                                                </SelectTrigger>
                                                                <SelectContent>
                                                                    <SelectItem value="pending">
                                                                        <div className="flex items-center gap-2"><Clock className="w-4 h-4 text-gray-500"/> Pending</div>
                                                                    </SelectItem>
                                                                    <SelectItem value="reviewing">
                                                                        <div className="flex items-center gap-2"><Eye className="w-4 h-4 text-yellow-500"/> Reviewing</div>
                                                                    </SelectItem>
                                                                    <SelectItem value="interviewing">
                                                                        <div className="flex items-center gap-2"><FileText className="w-4 h-4 text-blue-500"/> Interviewing</div>
                                                                    </SelectItem>
                                                                    <SelectItem value="accepted">
                                                                        <div className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-green-500"/> Accepted</div>
                                                                    </SelectItem>
                                                                    <SelectItem value="rejected">
                                                                        <div className="flex items-center gap-2"><XCircle className="w-4 h-4 text-red-500"/> Rejected</div>
                                                                    </SelectItem>
                                                                </SelectContent>
                                                            </Select>
                                                            <Link to={`/dm/${app.applicant_id}`}>
                                                                <Button size="icon" variant="outline" className="shrink-0 border-primary/20 text-primary hover:bg-primary hover:text-primary-foreground transition-all duration-300">
                                                                    <MessageSquare className="h-4 w-4" />
                                                                </Button>
                                                            </Link>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default ManageJobs;
