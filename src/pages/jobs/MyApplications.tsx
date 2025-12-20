import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, Calendar, MapPin, Building2, ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";

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

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'pending': return 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20';
            case 'reviewing': return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
            case 'interviewing': return 'bg-purple-500/10 text-purple-500 border-purple-500/20';
            case 'accepted': return 'bg-green-500/10 text-green-500 border-green-500/20';
            case 'rejected': return 'bg-red-500/10 text-red-500 border-red-500/20';
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
        <div className="min-h-screen bg-background pt-24 px-4 md:px-8">
            <div className="max-w-4xl mx-auto">
                <div className="flex items-center gap-4 mb-8">
                    <Link to="/jobs">
                        <Button variant="ghost" size="icon">
                            <ArrowLeft className="h-5 w-5" />
                        </Button>
                    </Link>
                    <h1 className="text-3xl font-bold">My Applications</h1>
                </div>

                {applications.length === 0 ? (
                    <Card className="glass-card text-center py-12">
                        <CardContent>
                            <h3 className="text-xl font-semibold mb-2">No applications yet</h3>
                            <p className="text-gray-400 mb-6">Start applying for jobs to see them here!</p>
                            <Link to="/jobs">
                                <Button>Browse Jobs</Button>
                            </Link>
                        </CardContent>
                    </Card>
                ) : (
                    <div className="space-y-4">
                        {applications.map((app) => (
                            <Card key={app.id} className="glass-card border-white/5 hover:border-white/10 transition-colors">
                                <CardHeader className="pb-2">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <CardTitle className="text-xl mb-1">{app.jobs.title}</CardTitle>
                                            <div className="flex items-center text-gray-400 text-sm">
                                                <Building2 className="h-4 w-4 mr-1" />
                                                {app.jobs.company}
                                            </div>
                                        </div>
                                        <Badge className={`${getStatusColor(app.status)} capitalize`}>
                                            {app.status}
                                        </Badge>
                                    </div>
                                </CardHeader>
                                <CardContent>
                                    <div className="flex gap-4 text-sm text-gray-500 mt-2">
                                        <div className="flex items-center">
                                            <MapPin className="h-4 w-4 mr-1" />
                                            {app.jobs.location}
                                        </div>
                                        <div className="flex items-center">
                                            <Calendar className="h-4 w-4 mr-1" />
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
