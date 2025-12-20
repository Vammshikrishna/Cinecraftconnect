import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, ArrowLeft, FileText } from "lucide-react";
import { Link } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { useToast } from "@/hooks/use-toast";

interface JobWithApplications {
    id: string;
    title: string;
    created_at: string | null;
    applications: {
        id: string;
        status: string;
        cover_letter: string | null;
        resume_url: string | null;
        created_at: string | null;
        applicant: {
            full_name: string;
            email: string; // Note: email might not be directly accessible depending on RLS, using profile data
            username: string;
            avatar_url: string | null;
        };
    }[];
}

const ManageJobs = () => {
    const [jobs, setJobs] = useState<JobWithApplications[]>([]);
    const [loading, setLoading] = useState(true);
    const { user } = useAuth();
    const { toast } = useToast();

    const fetchJobsAndApplications = async () => {
        if (!user) return;
        try {
            // First fetch jobs posted by user
            const { data: jobsData, error: jobsError } = await supabase
                .from('jobs')
                .select('id, title, created_at')
                .eq('posted_by', user.id)
                .order('created_at', { ascending: false });

            if (jobsError) throw jobsError;

            // Then fetch applications for these jobs
            const jobsWithApps = await Promise.all(jobsData.map(async (job) => {
                const { data: appsData, error: appsError } = await supabase
                    .from('job_applications')
                    .select(`
            id,
            status,
            cover_letter,
            resume_url,
            created_at,
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

            setJobs(jobsWithApps);
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
    }, [user?.id]);

    const handleStatusUpdate = async (applicationId: string, newStatus: string) => {
        try {
            const { error } = await supabase
                .from('job_applications')
                .update({ status: newStatus as "pending" | "reviewing" | "interviewing" | "accepted" | "rejected" })
                .eq('id', applicationId);

            if (error) throw error;

            toast({
                title: "Status Updated",
                description: "Application status has been updated successfully."
            });

            // Refresh data
            fetchJobsAndApplications();
        } catch (error) {
            console.error('Error updating status:', error);
            toast({
                title: "Error",
                description: "Failed to update status",
                variant: "destructive"
            });
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
        <div className="min-h-screen bg-background pt-24 px-4 md:px-8">
            <div className="max-w-6xl mx-auto">
                <div className="flex items-center gap-4 mb-8">
                    <Link to="/jobs">
                        <Button variant="ghost" size="icon">
                            <ArrowLeft className="h-5 w-5" />
                        </Button>
                    </Link>
                    <h1 className="text-3xl font-bold">Manage Jobs & Applications</h1>
                </div>

                {jobs.length === 0 ? (
                    <Card className="glass-card text-center py-12">
                        <CardContent>
                            <h3 className="text-xl font-semibold mb-2">No jobs posted</h3>
                            <p className="text-gray-400 mb-6">You haven't posted any jobs yet.</p>
                            <Link to="/jobs">
                                <Button>Post a Job</Button>
                            </Link>
                        </CardContent>
                    </Card>
                ) : (
                    <div className="space-y-8">
                        {jobs.map((job) => (
                            <Card key={job.id} className="glass-card border-white/5">
                                <CardHeader className="border-b border-white/5 pb-4">
                                    <div className="flex justify-between items-center">
                                        <div>
                                            <CardTitle className="text-xl">{job.title}</CardTitle>
                                            <p className="text-sm text-gray-400 mt-1">
                                                Posted {job.created_at ? formatDistanceToNow(new Date(job.created_at), { addSuffix: true }) : 'Unknown date'}
                                            </p>
                                        </div>
                                        <Badge variant="secondary">
                                            {job.applications.length} Applications
                                        </Badge>
                                    </div>
                                </CardHeader>
                                <CardContent className="pt-6">
                                    {job.applications.length === 0 ? (
                                        <p className="text-gray-500 text-center py-4">No applications yet.</p>
                                    ) : (
                                        <div className="space-y-4">
                                            {job.applications.map((app) => (
                                                <div key={app.id} className="bg-white/5 rounded-lg p-4 border border-white/5">
                                                    <div className="flex flex-col md:flex-row justify-between gap-4">
                                                        <div className="flex-grow">
                                                            <div className="flex items-center gap-2 mb-2">
                                                                <span className="font-semibold text-lg">
                                                                    {app.applicant.full_name || app.applicant.username}
                                                                </span>
                                                                <span className="text-xs text-gray-500">
                                                                    applied {app.created_at ? formatDistanceToNow(new Date(app.created_at), { addSuffix: true }) : 'Unknown date'}
                                                                </span>
                                                            </div>

                                                            <div className="mb-4">
                                                                <p className="text-sm text-gray-300 whitespace-pre-wrap bg-black/20 p-3 rounded-md">
                                                                    {app.cover_letter}
                                                                </p>
                                                            </div>

                                                            {app.resume_url && (
                                                                <a
                                                                    href={app.resume_url}
                                                                    target="_blank"
                                                                    rel="noopener noreferrer"
                                                                    className="inline-flex items-center text-sm text-primary hover:underline mb-4"
                                                                >
                                                                    <FileText className="h-4 w-4 mr-1" />
                                                                    View Resume
                                                                </a>
                                                            )}
                                                        </div>

                                                        <div className="min-w-[200px]">
                                                            <Select
                                                                defaultValue={app.status}
                                                                onValueChange={(value) => handleStatusUpdate(app.id, value)}
                                                            >
                                                                <SelectTrigger className="w-full">
                                                                    <SelectValue placeholder="Status" />
                                                                </SelectTrigger>
                                                                <SelectContent>
                                                                    <SelectItem value="pending">Pending</SelectItem>
                                                                    <SelectItem value="reviewing">Reviewing</SelectItem>
                                                                    <SelectItem value="interviewing">Interviewing</SelectItem>
                                                                    <SelectItem value="accepted">Accepted</SelectItem>
                                                                    <SelectItem value="rejected">Rejected</SelectItem>
                                                                </SelectContent>
                                                            </Select>
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
