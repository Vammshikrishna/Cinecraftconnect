import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Calendar, MapPin, Building2, Trash2, FileText, CalendarCheck, Check, X, Video, Phone, Users } from "lucide-react";
import { Link } from "react-router-dom";
import { format, formatDistanceToNow } from "date-fns";
import { PageHeader } from "@/components/common/PageHeader";
import { BackButton } from "@/components/common/BackButton";
import { getStage, stageProgress, interviewIcs, formatSalary, JOB_TYPE_LABELS } from "@cinecraft/core";

interface Interview {
    id: string;
    scheduled_at: string;
    duration_minutes: number;
    mode: 'video' | 'call' | 'in_person';
    location: string | null;
    notes: string | null;
    status: 'proposed' | 'confirmed' | 'declined' | 'completed' | 'cancelled';
}

interface Application {
    id: string;
    status: string;
    created_at: string;
    status_updated_at: string | null;
    rejection_reason: string | null;
    jobs: {
        id: string;
        title: string;
        company: string;
        location: string | null;
        type: string;
        salary_min: number | null;
        salary_max: number | null;
        currency: string | null;
        pay_period: string | null;
    } | null;
    interviews: Interview[];
}

const db = supabase as any;
const MODE_ICON = { video: Video, call: Phone, in_person: Users } as const;

const downloadIcs = (title: string, i: Interview) => {
    const blob = new Blob(
        [interviewIcs({ id: i.id, title, startsAt: i.scheduled_at, durationMinutes: i.duration_minutes, location: i.location, description: i.notes })],
        { type: 'text/calendar' }
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'interview.ics';
    a.click();
    URL.revokeObjectURL(url);
};

const MyApplications = () => {
    const [applications, setApplications] = useState<Application[]>([]);
    const [loading, setLoading] = useState(true);
    const [busyInterview, setBusyInterview] = useState<string | null>(null);
    const { user } = useAuth();
    const { toast } = useToast();

    const fetchApplications = useCallback(async () => {
        if (!user) return;
        try {
            const { data, error } = await db
                .from('job_applications')
                .select(`
                    id, status, created_at, status_updated_at, rejection_reason,
                    jobs ( id, title, company, location, type, salary_min, salary_max, currency, pay_period )
                `)
                .eq('applicant_id', user.id)
                .order('created_at', { ascending: false });
            if (error) throw error;

            const rows = (data || []) as any[];
            const ids = rows.map((r) => r.id);
            const byApp: Record<string, Interview[]> = {};
            if (ids.length) {
                const { data: ivs } = await db
                    .from('job_interviews')
                    .select('id, application_id, scheduled_at, duration_minutes, mode, location, notes, status')
                    .in('application_id', ids)
                    .order('scheduled_at', { ascending: true });
                (ivs || []).forEach((iv: any) => {
                    (byApp[iv.application_id] ||= []).push(iv);
                });
            }
            setApplications(rows.map((r) => ({ ...r, interviews: byApp[r.id] || [] })));
        } catch (error) {
            console.error('Error fetching applications:', error);
        } finally {
            setLoading(false);
        }
    }, [user?.id]);

    useEffect(() => {
        fetchApplications();
        if (!user) return;
        // Status changes and interview invites show up without a refresh.
        const channel = supabase
            .channel(`my_applications_${user.id}`)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'job_applications', filter: `applicant_id=eq.${user.id}` }, () => fetchApplications())
            .on('postgres_changes', { event: '*', schema: 'public', table: 'job_interviews' }, () => fetchApplications())
            .subscribe();
        return () => {
            supabase.removeChannel(channel);
        };
    }, [user?.id, fetchApplications]);

    const handleWithdraw = async (applicationId: string) => {
        if (!confirm("Are you sure you want to withdraw this application? This action cannot be undone.")) return;

        try {
            const { error } = await supabase.from('job_applications').delete().eq('id', applicationId);
            if (error) throw error;
            toast({ title: "Application Withdrawn", description: "Your application has been successfully removed." });
            setApplications((prev) => prev.filter((app) => app.id !== applicationId));
        } catch (error) {
            console.error('Error withdrawing application:', error);
            toast({ title: "Error", description: "Failed to withdraw application. Please try again.", variant: "destructive" });
        }
    };

    const respond = async (interview: Interview, accept: boolean) => {
        setBusyInterview(interview.id);
        const { data, error } = await db.rpc('respond_to_interview', { p_interview_id: interview.id, p_accept: accept });
        setBusyInterview(null);
        if (error || data?.success === false) {
            toast({ title: "Could not update the interview", description: error?.message || data?.message, variant: "destructive" });
            return;
        }
        toast({ title: accept ? "Interview confirmed" : "Interview declined" });
        fetchApplications();
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
                    subtitle={`Track the progress of your professional journey. You have ${applications.length} submission${applications.length === 1 ? '' : 's'}.`}
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
                        {applications.map((app) => {
                            const stage = getStage(app.status);
                            const progress = stageProgress(app.status);
                            const job = app.jobs;
                            const pay = job ? formatSalary(job) : null;
                            const open = app.interviews.filter((i) => i.status === 'proposed' || i.status === 'confirmed');
                            return (
                                <Card key={app.id} className="bg-card/40 backdrop-blur-xl border-border/50 hover:border-primary/40 transition-all duration-500 rounded-[2rem] overflow-hidden group shadow-lg hover:shadow-2xl">
                                    <CardHeader className="p-6 md:p-8 pb-4">
                                        <div className="flex justify-between items-start gap-4">
                                            <div className="flex gap-5 min-w-0">
                                                <div className="w-14 h-14 rounded-2xl bg-muted/30 border border-white/5 flex items-center justify-center shrink-0 shadow-inner">
                                                    <Building2 className="h-7 w-7 text-muted-foreground/40" />
                                                </div>
                                                <div className="min-w-0">
                                                    <Link to={job ? `/jobs/${job.id}` : '/jobs'}>
                                                        <CardTitle className="text-2xl font-black tracking-tight mb-2 group-hover:text-primary transition-colors">{job?.title || 'Job removed'}</CardTitle>
                                                    </Link>
                                                    <div className="flex items-center text-xs font-black uppercase tracking-widest text-muted-foreground/60">
                                                        <Building2 className="h-3.5 w-3.5 mr-2 opacity-50" />
                                                        {job?.company}
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-3 shrink-0">
                                                <span
                                                    className="text-[10px] font-black uppercase tracking-widest px-4 py-1.5 rounded-full"
                                                    style={{ color: stage.color, backgroundColor: stage.tint }}
                                                >
                                                    {stage.applicantLabel}
                                                </span>
                                                {(app.status === 'pending' || app.status === 'reviewing') && (
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
                                    <CardContent className="p-6 md:p-8 pt-0 space-y-5">
                                        {/* Progress: five steps, rejected shows as a stopped bar */}
                                        <div>
                                            <div className="flex gap-1.5">
                                                {Array.from({ length: progress.total }).map((_, i) => (
                                                    <div
                                                        key={i}
                                                        className="h-1.5 flex-1 rounded-full"
                                                        style={{
                                                            backgroundColor: progress.stopped ? stage.tint : i <= progress.index ? stage.color : 'rgba(148,163,184,0.2)',
                                                        }}
                                                    />
                                                ))}
                                            </div>
                                            <p className="text-[11px] font-bold text-muted-foreground/70 mt-2">
                                                {app.status_updated_at && app.status !== 'pending'
                                                    ? `Updated ${formatDistanceToNow(new Date(app.status_updated_at), { addSuffix: true })}`
                                                    : 'Waiting for the hiring team to look at it'}
                                            </p>
                                            {app.status === 'rejected' && app.rejection_reason && (
                                                <p className="mt-2 text-sm rounded-xl px-3 py-2" style={{ color: stage.color, backgroundColor: stage.tint }}>
                                                    {app.rejection_reason}
                                                </p>
                                            )}
                                        </div>

                                        {open.map((iv) => {
                                            const Mode = MODE_ICON[iv.mode] || Video;
                                            return (
                                                <div key={iv.id} className="rounded-2xl border border-blue-500/30 bg-blue-500/5 p-4 space-y-3">
                                                    <div className="flex items-start gap-3">
                                                        <div className="h-9 w-9 rounded-xl bg-blue-500/15 text-blue-500 flex items-center justify-center shrink-0"><CalendarCheck size={18} /></div>
                                                        <div className="min-w-0 flex-1">
                                                            <p className="text-sm font-black">
                                                                {iv.status === 'confirmed' ? 'Interview confirmed' : 'Interview invitation'}
                                                            </p>
                                                            <p className="text-sm font-bold">{format(new Date(iv.scheduled_at), 'EEE d MMM, h:mm a')} · {iv.duration_minutes} min</p>
                                                            <p className="text-xs text-muted-foreground flex items-center gap-1.5 mt-0.5">
                                                                <Mode size={12} /> {iv.location || (iv.mode === 'in_person' ? 'In person' : iv.mode === 'call' ? 'Phone call' : 'Video call')}
                                                            </p>
                                                            {iv.notes && <p className="text-xs text-muted-foreground mt-1">{iv.notes}</p>}
                                                        </div>
                                                    </div>
                                                    <div className="flex flex-wrap gap-2">
                                                        {iv.status === 'proposed' && (
                                                            <>
                                                                <Button size="sm" className="rounded-xl" disabled={busyInterview === iv.id} onClick={() => respond(iv, true)}>
                                                                    <Check className="h-4 w-4 mr-1" /> Confirm
                                                                </Button>
                                                                <Button size="sm" variant="outline" className="rounded-xl" disabled={busyInterview === iv.id} onClick={() => respond(iv, false)}>
                                                                    <X className="h-4 w-4 mr-1" /> Decline
                                                                </Button>
                                                            </>
                                                        )}
                                                        {iv.status === 'confirmed' && (
                                                            <>
                                                                <Button size="sm" variant="outline" className="rounded-xl" onClick={() => downloadIcs(`Interview: ${job?.title || 'Job'}`, iv)}>
                                                                    <Calendar className="h-4 w-4 mr-1" /> Add to calendar
                                                                </Button>
                                                                <Button size="sm" variant="ghost" className="rounded-xl text-rose-500" disabled={busyInterview === iv.id} onClick={() => respond(iv, false)}>
                                                                    Can't make it
                                                                </Button>
                                                            </>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}

                                        <div className="flex flex-wrap gap-3 text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 border-t border-border/20 pt-5">
                                            {job?.location && (
                                                <div className="flex items-center bg-muted/20 px-3 py-1.5 rounded-lg border border-white/5">
                                                    <MapPin className="h-3.5 w-3.5 mr-2 text-primary/40" />
                                                    {job.location}
                                                </div>
                                            )}
                                            {job && (
                                                <div className="flex items-center bg-muted/20 px-3 py-1.5 rounded-lg border border-white/5">
                                                    {JOB_TYPE_LABELS[job.type as keyof typeof JOB_TYPE_LABELS] || job.type}
                                                </div>
                                            )}
                                            {pay && (
                                                <div className="flex items-center bg-muted/20 px-3 py-1.5 rounded-lg border border-white/5">{pay}</div>
                                            )}
                                            <div className="flex items-center bg-muted/20 px-3 py-1.5 rounded-lg border border-white/5">
                                                <Calendar className="h-3.5 w-3.5 mr-2 text-primary/40" />
                                                Applied {formatDistanceToNow(new Date(app.created_at), { addSuffix: true })}
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
};

export default MyApplications;
