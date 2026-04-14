
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, ArrowLeft, FileText, CheckCircle2, XCircle, Clock, Search, Eye, Building2, Edit2, MessageSquare, Briefcase } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { JobCreationModal } from "@/components/jobs/JobCreationModal";
import { PageHeader } from "@/components/common/PageHeader";

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
    const navigate = useNavigate();

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
        <div className="min-h-screen bg-background pt-16 md:pt-20 pb-24 selection:bg-primary/30">
            {/* Background Orbs */}
            <div className="fixed inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-primary/5 blur-[120px]" />
            </div>

            <div className="max-w-6xl mx-auto px-4 md:px-8 relative z-10 space-y-8">
                <Button 
                    variant="ghost" 
                    onClick={() => navigate('/jobs')} 
                    className="mb-2 hover:bg-muted/50 rounded-xl px-4 h-10 border border-border/50"
                >
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back to Jobs
                </Button>

                <PageHeader 
                  title="Manage Postings" 
                  subtitle="Review applicant portfolios, update hiring status, and manage your active job listings." 
                  Icon={Briefcase}
                  actions={
                    <div className="flex gap-3">
                        <JobCreationModal 
                            onJobCreated={fetchJobsAndApplications}
                            triggerButton={
                                <Button className="bg-primary hover:bg-primary/90 rounded-xl h-12 px-8 font-bold text-primary-foreground shadow-lg shadow-primary/20 hover:scale-105 transition-transform">
                                    Post a New Job
                                </Button>
                            }
                        />
                    </div>
                  }
                />

                {jobs.length === 0 ? (
                    <div className="bg-card/40 backdrop-blur-xl border border-border/50 border-dashed rounded-[3rem] text-center py-24">
                        <div className="w-20 h-20 rounded-[2rem] bg-primary/10 flex items-center justify-center mx-auto mb-6">
                            <Search className="w-8 h-8 text-primary" />
                        </div>
                        <h3 className="text-2xl font-black tracking-tight mb-2">No active postings</h3>
                        <p className="text-muted-foreground max-w-sm mx-auto mb-8 font-medium">
                            You haven't posted any jobs or aren't managing any company pages with active postings right now.
                        </p>
                        <JobCreationModal 
                            onJobCreated={fetchJobsAndApplications}
                            triggerButton={
                                <Button className="bg-primary hover:bg-primary/90 rounded-xl h-12 px-8 font-bold">Post Your First Job</Button>
                            }
                        />
                    </div>
                ) : (
                    <div className="space-y-8">
                        {jobs.map((job) => (
                            <Card key={job.id} className="bg-card/40 border-border/50 backdrop-blur-xl overflow-hidden shadow-2xl rounded-[2.5rem] group hover:border-primary/30 transition-all duration-500">
                                <div className="p-1 min-h-[6px] bg-gradient-to-r from-primary via-primary/50 to-transparent w-full opacity-60" />
                                <CardHeader className="p-8 sm:flex-row sm:items-start justify-between gap-6">
                                    <div className="flex gap-6">
                                        <div className="w-16 h-16 rounded-2xl bg-muted/40 items-center justify-center shrink-0 border border-border/50 shadow-inner flex overflow-hidden">
                                            {job.company_pages?.logo_url ? (
                                                <img src={job.company_pages.logo_url} alt="Logo" className="w-full h-full object-cover" />
                                            ) : (
                                                <Building2 className="w-8 h-8 text-muted-foreground/40" />
                                            )}
                                        </div>
                                        <div>
                                            <div className="flex flex-wrap items-center gap-3 mb-2">
                                                <CardTitle className="text-2xl font-black tracking-tight leading-none group-hover:text-primary transition-colors">{job.title}</CardTitle>
                                                {!job.is_active && <Badge variant="destructive" className="text-[10px] uppercase font-black tracking-[0.2em] rounded-full px-3">Closed</Badge>}
                                                {job.company_pages && <Badge variant="secondary" className="text-[10px] font-black uppercase tracking-widest bg-primary/10 text-primary border-none">{job.company_pages.name}</Badge>}
                                            </div>
                                            <div className="flex items-center text-sm font-black uppercase tracking-[0.1em] text-muted-foreground/60 gap-4 flex-wrap">
                                                <span className="flex items-center gap-1.5">
                                                    <Clock className="w-4 h-4" /> 
                                                    Posted {job.created_at ? formatDistanceToNow(new Date(job.created_at), { addSuffix: true }) : 'Unknown'}
                                                </span>
                                                <span className="flex items-center gap-1.5 text-foreground">
                                                    <Badge variant="outline" className="px-3 py-1 border-primary/20 bg-primary/5 font-black">{job.applications.length} APPLICANTS</Badge>
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex sm:flex-col lg:flex-row items-center gap-3 shrink-0">
                                        <JobCreationModal 
                                            jobToEdit={job}
                                            onJobCreated={fetchJobsAndApplications}
                                            triggerButton={
                                                <Button variant="ghost" className="h-12 px-6 rounded-xl border border-border/50 hover:bg-muted/50 font-black uppercase tracking-widest text-[10px]">
                                                    <Edit2 className="w-4 h-4 mr-2" /> Edit Posting
                                                </Button>
                                            }
                                        />
                                        <Button
                                            variant={job.is_active ? "ghost" : "default"}
                                            className={`h-12 px-6 rounded-xl border ${job.is_active ? 'border-destructive/30 text-destructive hover:bg-destructive/5' : 'bg-primary text-primary-foreground'} font-black uppercase tracking-widest text-[10px]`}
                                            onClick={() => handleToggleActive(job.id, job.is_active)}
                                        >
                                            {job.is_active ? 'Close Submission' : 'Reactivate'}
                                        </Button>
                                    </div>
                                </CardHeader>
                                
                                <CardContent className="bg-muted/10 p-8 border-t border-border/50">
                                    <div className="flex items-center gap-3 mb-6">
                                        <div className="h-1 w-8 bg-primary/50 rounded-full" />
                                        <h4 className="text-xs font-black uppercase tracking-[0.2em] text-muted-foreground/80">
                                            Portfolio Review Grid
                                        </h4>
                                    </div>
                                    
                                    {job.applications.length === 0 ? (
                                        <div className="text-center py-12 bg-background/30 rounded-[2rem] border border-dashed border-border/50">
                                            <p className="text-muted-foreground font-medium">No candidates have applied to this position yet.</p>
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-1 gap-6">
                                            {job.applications.map((app) => (
                                                <div key={app.id} className="bg-card/60 backdrop-blur-md border border-border/50 rounded-[2rem] p-6 md:p-8 flex flex-col md:flex-row gap-8 hover:border-primary/50 transition-all duration-500 shadow-sm hover:shadow-xl">
                                                    <div className="flex-grow flex flex-col gap-6">
                                                        <div className="flex items-start gap-5">
                                                            <Link to={`/profile/${app.applicant_id}`}>
                                                                <Avatar className="w-16 h-16 border-2 border-border/50 shadow-xl hover:scale-110 transition-transform">
                                                                    <AvatarImage src={app.applicant?.avatar_url || ''} className="object-cover" />
                                                                    <AvatarFallback className="bg-primary/20 text-primary font-black text-2xl">
                                                                        {app.applicant?.full_name?.[0]?.toUpperCase() || 'U'}
                                                                    </AvatarFallback>
                                                                </Avatar>
                                                            </Link>
                                                            <div className="flex-1 pt-1">
                                                                <Link to={`/profile/${app.applicant_id}`} className="hover:text-primary transition-colors flex items-center gap-2">
                                                                    <h5 className="font-black text-2xl leading-none tracking-tight">
                                                                        {app.applicant?.full_name || app.applicant?.username || 'Unknown Applicant'}
                                                                    </h5>
                                                                </Link>
                                                                <div className="flex items-center gap-3 mt-3 flex-wrap">
                                                                    <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 bg-muted/50 px-3 py-1 rounded-full">
                                                                        Applied {app.created_at ? formatDistanceToNow(new Date(app.created_at), { addSuffix: true }) : ''}
                                                                    </span>
                                                                    <Badge className={`text-[10px] uppercase font-black tracking-widest border-none rounded-full px-4 py-1.5 shadow-sm ${getStatusColor(app.status)}`} variant="outline">
                                                                        {app.status}
                                                                    </Badge>
                                                                </div>
                                                            </div>
                                                        </div>

                                                        {app.cover_letter && (
                                                            <div className="bg-background/40 backdrop-blur-sm p-6 rounded-[1.5rem] text-muted-foreground font-medium leading-relaxed whitespace-pre-wrap border border-white/5 italic">
                                                                "{app.cover_letter}"
                                                            </div>
                                                        )}

                                                        <div className="flex flex-wrap items-center gap-4">
                                                            {app.resume_url && (
                                                                <a
                                                                    href={app.resume_url}
                                                                    target="_blank"
                                                                    rel="noopener noreferrer"
                                                                    className="flex items-center gap-3 text-xs font-black uppercase tracking-widest bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground px-6 py-3 rounded-2xl transition-all border border-primary/20"
                                                                >
                                                                    <FileText className="h-4 w-4" />
                                                                    View Application Package
                                                                </a>
                                                            )}
                                                            <Link to={`/messages/${app.applicant_id}`}>
                                                                <Button variant="ghost" className="h-12 px-6 rounded-2xl border border-border/50 hover:bg-muted/50 font-black uppercase tracking-widest text-[10px] gap-2">
                                                                    <MessageSquare className="h-4 w-4" />
                                                                    Direct Contact
                                                                </Button>
                                                            </Link>
                                                        </div>
                                                    </div>

                                                    <div className="md:w-[240px] shrink-0 border-t md:border-t-0 md:border-l border-border/50 pt-8 md:pt-0 md:pl-8 flex flex-col justify-center space-y-4">
                                                        <label className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] mb-2 block">Set Hiring Phase</label>
                                                        <Select
                                                            value={app.status || 'pending'}
                                                            onValueChange={(value) => handleStatusUpdate(app.id, value)}
                                                        >
                                                            <SelectTrigger className="h-14 bg-background border-border/50 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-inner">
                                                                <SelectValue placeholder="STATUS" />
                                                            </SelectTrigger>
                                                            <SelectContent className="bg-card/95 backdrop-blur-3xl border-border/50 rounded-2xl overflow-hidden">
                                                                <SelectItem value="pending" className="font-black text-[10px] uppercase tracking-widest p-4 cursor-pointer focus:bg-primary/10 transition-colors">
                                                                    <div className="flex items-center gap-3"><Clock className="w-4 h-4 text-muted-foreground/60"/> Queue</div>
                                                                </SelectItem>
                                                                <SelectItem value="reviewing" className="font-black text-[10px] uppercase tracking-widest p-4 cursor-pointer focus:bg-primary/10 transition-colors">
                                                                    <div className="flex items-center gap-3"><Eye className="w-4 h-4 text-yellow-500"/> Reviewing</div>
                                                                </SelectItem>
                                                                <SelectItem value="interviewing" className="font-black text-[10px] uppercase tracking-widest p-4 cursor-pointer focus:bg-primary/10 transition-colors">
                                                                    <div className="flex items-center gap-3"><MessageSquare className="w-4 h-4 text-blue-500"/> Interview</div>
                                                                </SelectItem>
                                                                <SelectItem value="accepted" className="font-black text-[10px] uppercase tracking-widest p-4 cursor-pointer focus:bg-primary/10 transition-colors">
                                                                    <div className="flex items-center gap-3"><CheckCircle2 className="w-4 h-4 text-emerald-500"/> Hire</div>
                                                                </SelectItem>
                                                                <SelectItem value="rejected" className="font-black text-[10px] uppercase tracking-widest p-4 cursor-pointer focus:bg-primary/10 transition-colors">
                                                                    <div className="flex items-center gap-3"><XCircle className="w-4 h-4 text-rose-500"/> Close</div>
                                                                </SelectItem>
                                                            </SelectContent>
                                                        </Select>
                                                        <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/40 text-center leading-tight">
                                                            Changing phase will notify the applicant immediately.
                                                        </p>
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
