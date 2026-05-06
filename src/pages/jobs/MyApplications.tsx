
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Calendar, MapPin, Building2, Trash2, FileText } from "lucide-react";
import { Link } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { PageHeader } from "@/components/common/PageHeader";
import { BackButton } from "@/components/common/BackButton";

interface Application {
    id: string;
    status: 'pending' | 'reviewing' | 'interviewing' | 'accepted' | 'rejected';
    created_at: string;
    jobs: {
        title: string;
        company: string;
        location: string;
        type: string;
    };
}

const MyApplications = () => {
    const [applications, setApplications] = useState<Application[]>([]);
    const [loading, setLoading] = useState(true);
    const { user } = useAuth();
    const { toast } = useToast();

    useEffect(() => {
        const fetchApplications = async () => {
            if (!user) return;
            try {
                const { data, error } = await supabase
                    .from('job_applications')
                    .select(`
            id,
            status,
            created_at,
            jobs (
              title,
              company,
              location,
              type
            )
          `)
                    .eq('applicant_id', user.id)
                    .order('created_at', { ascending: false });

                if (error) throw error;
                setApplications(data as any);
            } catch (error) {
                console.error('Error fetching applications:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchApplications();
    }, [user?.id]);

    const handleWithdraw = async (applicationId: string) => {
        if (!confirm("Are you sure you want to withdraw this application? This action cannot be undone.")) return;
        
        try {
            const { error } = await supabase
                .from('job_applications')
                .delete()
                .eq('id', applicationId);

            if (error) throw error;

            toast({
                title: "Application Withdrawn",
                description: "Your application has been successfully removed.",
            });

            setApplications(prev => prev.filter(app => app.id !== applicationId));
        } catch (error) {
            console.error('Error withdrawing application:', error);
            toast({
                title: "Error",
                description: "Failed to withdraw application. Please try again.",
                variant: "destructive"
            });
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'pending': return 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20';
            case 'reviewing': return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
            case 'interviewing': return 'bg-purple-500/10 text-purple-400 border-purple-500/20';
            case 'accepted': return 'bg-primary/10 text-primary/80 border-primary/20';
            case 'rejected': return 'bg-rose-500/10 text-rose-400 border-rose-500/20';
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
            <div className="max-w-4xl mx-auto px-4 md:px-8 relative z-10">
                <BackButton label="BACK TO JOBS" to="/jobs" className="mb-8" />

                <PageHeader 
                  title="My Applications" 
                   subtitle={`Track the progress of your professional journey. You have ${applications.length} active submissions.`} 
                   Icon={FileText}
                />

                {applications.length === 0 ? (
                    <div className="bg-card/40 backdrop-blur-xl border border-border/50 border-dashed rounded-[3rem] text-center py-20 mt-8">
                        <div className="w-16 h-16 rounded-[1.5rem] bg-muted/20 flex items-center justify-center mx-auto mb-6">
                            <FileText className="h-8 w-8 text-muted-foreground/30" />
                        </div>
                        <h3 className="text-2xl font-black mb-2">No applications yet</h3>
                        <p className="text-muted-foreground mb-8 font-medium">Capture your next big role. Your applications will synchronize here.</p>
                        <Link to="/jobs">
                            <Button className="bg-primary hover:bg-primary/90 h-12 px-8 rounded-xl font-bold">Discover Jobs</Button>
                        </Link>
                    </div>
                ) : (
                    <div className="space-y-6 mt-8">
                        {applications.map((app) => (
                            <Card key={app.id} className="bg-card/40 backdrop-blur-xl border-border/50 hover:border-primary/40 transition-all duration-500 rounded-[2rem] overflow-hidden group shadow-lg hover:shadow-2xl">
                                <CardHeader className="p-6 md:p-8 pb-4">
                                    <div className="flex justify-between items-start gap-4">
                                        <div className="flex gap-5">
                                            <div className="w-14 h-14 rounded-2xl bg-muted/30 border border-white/5 flex items-center justify-center shrink-0 shadow-inner">
                                                <Building2 className="h-7 w-7 text-muted-foreground/40" />
                                            </div>
                                            <div>
                                                <CardTitle className="text-2xl font-black tracking-tight mb-2 group-hover:text-primary transition-colors">{app.jobs.title}</CardTitle>
                                                <div className="flex items-center text-xs font-black uppercase tracking-widest text-muted-foreground/60">
                                                    <Building2 className="h-3.5 w-3.5 mr-2 opacity-50" />
                                                    {app.jobs.company}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <Badge className={`text-[10px] font-black uppercase tracking-widest border-none px-4 py-1.5 rounded-full shadow-sm ${getStatusColor(app.status)}`}>
                                                {app.status}
                                            </Badge>
                                            {app.status === 'pending' && (
                                                <Button 
                                                    variant="ghost" 
                                                    size="icon" 
                                                    className="h-10 w-10 text-rose-500 hover:text-white hover:bg-rose-500 transition-all duration-300 rounded-xl"
                                                    onClick={() => handleWithdraw(app.id)}
                                                    title="Withdraw Application"
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                </CardHeader>
                                <CardContent className="p-6 md:p-8 pt-0">
                                    <div className="flex flex-wrap gap-6 text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 mt-4 border-t border-border/20 pt-6">
                                        <div className="flex items-center bg-muted/20 px-3 py-1.5 rounded-lg border border-white/5">
                                            <MapPin className="h-3.5 w-3.5 mr-2 text-primary/40" />
                                            {app.jobs.location}
                                        </div>
                                        <div className="flex items-center bg-muted/20 px-3 py-1.5 rounded-lg border border-white/5">
                                            <Calendar className="h-3.5 w-3.5 mr-2 text-primary/40" />
                                            Applied {formatDistanceToNow(new Date(app.created_at), { addSuffix: true })}
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default MyApplications;

