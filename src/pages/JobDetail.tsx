import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { useAppNavigation } from "@/contexts/NavigationContext";
import { motion } from "framer-motion";
import { 
  MapPin, Briefcase, CheckCircle, 
  Share2, Bookmark, DollarSign, ExternalLink,
  Info, Flag,
  Users, 
  Globe, 
  Trash2,
  Settings,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { JobApplicationModal } from "@/components/jobs/JobApplicationModal";
import { UniversalShareSheet } from "@/components/common/UniversalShareSheet";
import { supabase } from "@/integrations/supabase/client";
import { Job } from "@/types/jobs";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { formatDistanceToNow } from "date-fns";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import ReportDialog from "@/components/common/ReportDialog";
import { useAppRole } from "@/hooks/useAppRole";
import { BackButton } from "@/components/common/BackButton";

const JobDetail = () => {
  const { jobId } = useParams<{ jobId: string }>();
  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);
  const [isApplying, setIsApplying] = useState(false);
  const [isApplied, setIsApplied] = useState(false);
  const [isShareSheetOpen, setIsShareSheetOpen] = useState(false);
  const [isReportOpen, setIsReportOpen] = useState(false);
  const [applicationCount, setApplicationCount] = useState(0);
  const { user } = useAuth();
  const { isInternal } = useAppRole();
  const { toast } = useToast();
    const { push, goBack } = useAppNavigation();
  const isOwner = user?.id === job?.posted_by;

  const fetchJobDetail = async () => {
    if (!jobId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('jobs')
        .select(`
          *,
          profiles:posted_by (
            id,
            full_name,
            avatar_url,
            username
          ),
          company_pages:page_id (
            id,
            name,
            logo_url,
            slug,
            tagline,
            description,
            headquarters,
            company_size
          )
        `)
        .eq('id', jobId)
        .single();

      if (error) throw error;
      setJob(data as any);

      if (user) {
        const { data: application } = await supabase
          .from('job_applications')
          .select('id')
          .eq('job_id', jobId)
          .eq('applicant_id', user.id)
          .maybeSingle();
        if (application) setIsApplied(true);
      }

      // Fetch application count
      const { count, error: countError } = await supabase
        .from('job_applications')
        .select('*', { count: 'exact', head: true })
        .eq('job_id', jobId);
      
      if (!countError) setApplicationCount(count || 0);

    } catch (error: any) {
      console.error('Error fetching job:', error);
      toast({
        title: "Error",
        description: "Failed to load job details.",
        variant: "destructive",
      });
      goBack();
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchJobDetail();

    // Real-time subscription
    const channel = supabase
      .channel(`job_${jobId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'jobs',
          filter: `id=eq.${jobId}`
        },
        () => {
          fetchJobDetail();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [jobId, user?.id]);

  const handleApplyClick = () => {
    if (!user) {
      toast({
        title: "Sign in required",
        description: "Please sign in to apply for jobs",
        variant: "destructive"
      });
      return;
    }
    setIsApplying(true);
  };

  const handleWithdraw = async () => {
    if (!user || !jobId) return;
    if (!confirm("Are you sure you want to withdraw your application? This action cannot be undone.")) return;

    try {
      const { error } = await supabase
        .from('job_applications')
        .delete()
        .eq('job_id', jobId)
        .eq('applicant_id', user.id);

      if (error) throw error;

      toast({
        title: "Application Withdrawn",
        description: "Your application has been successfully removed.",
      });

      setIsApplied(false);
      setApplicationCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Error withdrawing application:', error);
      toast({
        title: "Error",
        description: "Failed to withdraw application. Please try again.",
        variant: "destructive"
      });
    }
  };

  const shareJob = () => {
    setIsShareSheetOpen(true);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!job) return null;


  return (
    <div className="min-h-screen bg-background text-foreground selection:bg-primary/30 pb-36">
      {/* Background Elements aligned with global theme */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-primary/5 blur-[120px]" />
      </div>


      <main className="max-w-7xl mx-auto px-4 md:px-8 pt-16 md:pt-28 relative z-10">
        <div className="hidden md:block mb-6">
          <BackButton label="BACK TO JOBS" />
        </div>
        {/* Mobile Header Icons - Now integrated into the hero for better flow */}
        <div className="md:hidden flex items-center justify-between mb-2">
          <BackButton label="BACK TO JOBS" />
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" onClick={shareJob} className="rounded-full h-10 w-10">
              <Share2 size={20} />
            </Button>
            <Button variant="ghost" size="icon" className="rounded-full h-10 w-10">
              <Bookmark size={20} />
            </Button>
            <Button variant="ghost" size="icon" className="rounded-full h-10 w-10">
              <Info size={20} />
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Main Content Area */}
          <div className="lg:col-span-8 space-y-8">
            
            <motion.section 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="relative overflow-hidden rounded-[2.5rem] bg-card/40 backdrop-blur-md border border-border/50 p-8 md:p-10 shadow-2xl"
            >
              {/* Top Header: Logo + High-Level Branding */}
              <div className="flex items-center justify-between mb-8 pb-6 border-b border-border/20">
                <div className="flex items-center gap-4">
                  <div className="p-1 rounded-2xl bg-gradient-to-br from-primary/30 to-transparent">
                    <Avatar className="h-14 w-14 rounded-xl border border-background shadow-lg">
                      <AvatarImage src={job.company_pages?.logo_url || ""} />
                      <AvatarFallback className="bg-primary/5 text-primary text-xl font-black rounded-xl">
                        {(job.company_pages?.name || job.company).charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                  </div>
                  <div className="flex flex-col">
                    <h3 className="text-xl font-black text-foreground hover:text-primary transition-all cursor-pointer" onClick={() => job.company_pages && push(`/pages/${job.company_pages.slug}`)}>
                      {job.company_pages?.name || job.company}
                    </h3>
                  </div>
                </div>

                <div className="hidden md:flex items-center gap-2">
                  <Button variant="ghost" size="icon" onClick={shareJob} className="rounded-full hover:bg-muted/30">
                    <Share2 size={20} />
                  </Button>
                  <Button variant="ghost" size="icon" className="rounded-full hover:bg-muted/30">
                    <Bookmark size={20} />
                  </Button>
                  {user && !isOwner && (
                    <Button variant="ghost" size="icon" onClick={() => setIsReportOpen(true)} className="rounded-full hover:bg-rose-500/10 hover:text-rose-500">
                      <Flag size={18} />
                    </Button>
                  )}
                </div>
              </div>

              {/* Main Content: Clean Title + Metadata */}
              <div className="space-y-6">
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="text-white text-[10px] font-black uppercase tracking-[0.15em] px-3.5 py-1.5 rounded-full bg-gradient-to-r from-orange-500 to-red-500 shadow-xl shadow-orange-500/20 ring-4 ring-orange-500/10">
                      Hiring Now
                    </span>
                  </div>
                  <h1 className="text-2xl md:text-3xl font-black tracking-tighter text-foreground leading-tight">
                    {job.title}
                  </h1>
                </div>

                {/* Desktop-only Action Row: LinkedIn Style */}
                <div className="hidden md:flex flex-row items-center gap-3 pt-6 border-t border-border/20 mt-6">
                  {isOwner ? (
                    <Button onClick={() => push('/jobs/manage')} size="lg" className="h-14 px-12 rounded-full bg-primary text-primary-foreground font-black shadow-lg shadow-primary/20 hover:scale-105 active:scale-95 transition-all text-lg">
                      <Settings className="mr-2 h-5 w-5" /> Manage Job
                    </Button>
                  ) : isApplied ? (
                    <div className="flex items-center gap-2">
                        <Button disabled className="h-14 px-10 rounded-full bg-primary/10 text-primary border border-primary/20 font-black">
                        <CheckCircle className="mr-2 h-5 w-5" />
                        Applied
                        </Button>
                        <Button 
                        variant="outline"
                        onClick={handleWithdraw}
                        className="h-14 px-8 rounded-full border-red-500/30 text-red-500 font-bold hover:bg-red-500/5 hover:border-red-500/50 transition-all text-base"
                        >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Withdraw
                        </Button>
                    </div>
                  ) : (
                    <Button onClick={handleApplyClick} disabled={isInternal} size="lg" className="h-14 px-12 rounded-full bg-primary text-primary-foreground font-black shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all text-lg">
                      {isInternal ? "Staff Cannot Apply" : "Apply Now"} <ExternalLink size={20} className="ml-2" />
                    </Button>
                  )}
                  
                  <Button variant="outline" size="lg" className="h-14 px-10 rounded-full border-primary text-primary font-black hover:bg-primary/5 transition-all text-lg">
                    Save
                  </Button>
                </div>

                {/* Refined Metadata Footer */}
                <div className="flex flex-wrap items-center gap-x-6 gap-y-3 pt-8 border-t border-border/20 text-sm md:text-base text-muted-foreground/70 font-bold">
                    <div className="flex items-center gap-2">
                        <MapPin size={18} className="text-secondary" />
                        <span>{job.location || "Remote"}</span>
                    </div>
                    <div className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-muted/20">
                        <span className="text-muted-foreground/30">•</span>
                        <span className="text-primary font-black">{formatDistanceToNow(new Date(job.created_at), { addSuffix: true })}</span>
                        <span className="text-muted-foreground/30">•</span>
                        <span className="text-muted-foreground/80 font-black">{applicationCount > 0 ? `${applicationCount} applicants` : 'Be the first to apply'}</span>
                    </div>
                </div>
              </div>
            </motion.section>


            {/* Quick Specs Grid using system variables */}
            <motion.div 
               initial={{ opacity: 0 }}
               animate={{ opacity: 1 }}
               transition={{ delay: 0.2 }}
               className="grid grid-cols-2 md:grid-cols-4 gap-4"
            >
              {[
                { label: 'Job Type', value: job.type.replace('-', ' '), icon: Briefcase, color: 'text-primary' },
                { label: 'Experience', value: job.experience_level, icon: Users, color: 'text-primary' },
                { label: 'Salary', value: job.salary_min ? `₹${job.salary_min.toLocaleString()}` : 'Competitive', icon: DollarSign, color: 'text-primary' },
                { label: 'Status', value: applicationCount > 5 ? 'High demand' : 'New listing', icon: Info, color: 'text-primary' }
              ].map((spec, i) => (
                <div key={i} className="bg-card/40 border border-border/50 rounded-2xl p-4 transition-colors group">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                      <spec.icon size={16} />
                    </div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">{spec.label}</p>
                  </div>
                  <p className="text-sm font-bold text-foreground capitalize">{spec.value}</p>
                </div>
              ))}
            </motion.div>

            {/* Content Sections */}
            <div className="space-y-6">
              <motion.div 
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                className="bg-card/20 border border-border/50 rounded-[2rem] overflow-hidden"
              >
                <div className="p-8 md:p-10">
                  <h2 className="text-2xl font-black mb-8 flex items-center gap-3">
                    <span className="w-1 h-8 bg-primary rounded-full" />
                    Role Overview
                  </h2>
                  <div className="space-y-6 text-muted-foreground text-lg leading-relaxed font-medium">
                    {job.description.split('\n').filter(p => p.trim()).map((para, i) => (
                      <p key={i}>{para}</p>
                    ))}
                  </div>
                </div>
              </motion.div>

              {job.requirements && (
                <motion.div 
                  initial={{ opacity: 0, x: 20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  className="bg-card/20 border border-border/50 rounded-[2rem] overflow-hidden"
                >
                  <div className="p-8 md:p-10">
                    <h2 className="text-lg font-black mb-8 flex items-center gap-3">
                      <span className="w-1 h-8 bg-primary rounded-full" />
                      Key Requirements
                    </h2>
                    <ul className="space-y-4">
                      {job.requirements.split('\n').filter(r => r.trim()).map((req, i) => (
                        <li key={i} className="flex gap-4 group">
                          <div className="shrink-0 w-6 h-6 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-white transition-colors duration-300">
                            <CheckCircle size={12} />
                          </div>
                          <span className="text-muted-foreground text-lg leading-tight group-hover:text-foreground transition-colors capitalize">
                            {req.replace(/^[\-\*]\s*/, '')}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </motion.div>
              )}
            </div>
          </div>

          {/* Sidebar Area */}
          <div className="lg:col-span-4 space-y-6">
            
            {/* Company Profile Sidebar */}
            <motion.aside 
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              className="sticky top-24 space-y-6"
            >
              <div className="bg-card/40 backdrop-blur-md border border-border/50 rounded-[2.5rem] p-8 shadow-2xl relative overflow-hidden group">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
                
                <h3 className="text-xs font-black uppercase tracking-[0.2em] text-muted-foreground/60 mb-8 px-1">Organization</h3>
                
                <div className="space-y-8">
                  <div className="flex flex-col items-center text-center space-y-4">
                    <Avatar className="h-20 w-20 rounded-2xl shadow-xl border border-border/50 ring-4 ring-muted/5">
                      <AvatarImage src={job.company_pages?.logo_url || ""} />
                      <AvatarFallback className="bg-primary/5 text-primary text-2xl font-black">
                         {(job.company_pages?.name || job.company).charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="space-y-1">
                      <h4 className="text-xl font-black text-foreground leading-tight">
                        {job.company_pages?.name || job.company}
                      </h4>
                      <p className="text-sm text-primary font-bold uppercase tracking-wider italic">
                        {job.company_pages?.tagline || "Industry Leaders"}
                      </p>
                    </div>
                  </div>

                  {job.company_pages?.description && (
                    <div className="bg-muted/10 rounded-2xl p-5 border border-border/10 italic text-sm text-muted-foreground leading-relaxed relative">
                      <span className="absolute -top-2 -left-2 text-4xl text-primary/20 font-serif">"</span>
                      {job.company_pages.description}
                      <span className="absolute -bottom-4 -right-2 text-4xl text-primary/20 font-serif">"</span>
                    </div>
                  )}

                  <div className="space-y-3 pt-4 px-2">
                    <div className="flex items-center justify-between py-3 border-b border-border/30">
                      <div className="flex items-center gap-2 text-muted-foreground/60 font-bold text-[10px] uppercase tracking-widest">
                        <MapPin size={14} /> Location
                      </div>
                      <span className="text-sm font-bold text-foreground/80">{job.company_pages?.headquarters || "Hyderabad, IND"}</span>
                    </div>
                    <div className="flex items-center justify-between py-3 border-b border-border/30">
                      <div className="flex items-center gap-2 text-muted-foreground/60 font-bold text-[10px] uppercase tracking-widest">
                        <Users size={14} /> Size
                      </div>
                      <span className="text-sm font-bold text-foreground/80">{job.company_pages?.company_size || "50-100 People"}</span>
                    </div>
                    <div className="flex items-center justify-between py-3">
                      <div className="flex items-center gap-2 text-muted-foreground/60 font-bold text-[10px] uppercase tracking-widest">
                        <Globe size={14} /> Presence
                      </div>
                      <span className="text-sm font-bold text-primary">{job.company_pages?.headquarters ? "Registered" : "Worldwide"}</span>
                    </div>
                  </div>
                  
                  {job.company_pages && (
                    <motion.div whileHover={{ y: -4 }}>
                      <Link to={`/pages/${job.company_pages?.slug}`} className="w-full">
                        <Button 
                          variant="outline" 
                          className="w-full h-14 rounded-2xl border-border/50 bg-muted/5 hover:bg-muted/20 text-foreground font-bold gap-2"
                        >
                          Visit Page Profile
                          <ExternalLink size={16} />
                        </Button>
                      </Link>
                    </motion.div>
                  )}
                </div>
              </div>

              {/* Recruiter Widget */}
              <div className="bg-card/20 border border-border/50 rounded-[2rem] p-6 flex items-center gap-4 group hover:bg-card/40 transition-colors">
                <Avatar className="h-14 w-14 border-2 border-border/50 rounded-2xl group-hover:scale-105 transition-transform">
                  <AvatarImage src={job.profiles?.avatar_url || ""} />
                  <AvatarFallback className="bg-primary/10 text-primary font-bold">
                    {job.profiles?.username?.charAt(0) || "U"}
                  </AvatarFallback>
                </Avatar>
                <div className="overflow-hidden">
                   <p className="text-[10px] font-black uppercase text-primary/60 tracking-[0.2em] mb-1">Posted By</p>
                   <h5 className="font-black text-foreground truncate text-base">{job.profiles?.full_name || "@" + job.profiles?.username}</h5>
                </div>
              </div>
            </motion.aside>

          </div>
        </div>
      </main>

      {/* Sticky Bottom Apply Bar for Mobile */}
      <div className="lg:hidden fixed bottom-[calc(env(safe-area-inset-bottom)+70px)] left-0 right-0 z-50 bg-card/80 backdrop-blur-3xl border-t border-white/10 p-4 shadow-2xl transition-transform duration-500">
        <div className="flex items-center gap-3">
          {isOwner ? (
            <Button onClick={() => push('/jobs/manage')} className="h-12 flex-1 rounded-2xl bg-primary text-primary-foreground font-black shadow-lg shadow-primary/20 active:scale-95 transition-all">
              <Settings className="mr-1.5 h-3.5 w-3.5" /> Manage Job
            </Button>
          ) : isApplied ? (
            <div className="flex flex-1 items-center gap-2">
                <Button disabled className="h-12 flex-[2] rounded-2xl bg-primary/10 text-primary border border-primary/20 font-black text-xs">
                <CheckCircle className="mr-1.5 h-3.5 w-3.5" />
                Applied
                </Button>
                <Button 
                variant="outline"
                onClick={handleWithdraw}
                className="h-12 flex-1 rounded-2xl border-red-500/30 text-red-500 font-bold text-xs"
                >
                Withdraw
                </Button>
            </div>
          ) : (
            <Button onClick={handleApplyClick} disabled={isInternal} className="h-12 flex-1 rounded-2xl bg-primary text-primary-foreground font-black shadow-lg shadow-primary/20">
              {isInternal ? "Staff Only" : "Apply Now"}
            </Button>
          )}
          <Button variant="outline" className="h-12 w-12 p-0 rounded-2xl border-primary text-primary">
            <Bookmark size={20} />
          </Button>
          <Button variant="outline" onClick={shareJob} className="h-12 w-12 p-0 rounded-2xl border-primary text-primary">
            <Share2 size={20} />
          </Button>
        </div>
      </div>

      <JobApplicationModal 
        isOpen={isApplying}
        onOpenChange={setIsApplying}
        jobTitle={job.title}
        jobId={job.id}
        onSuccess={() => setIsApplied(true)}
      />

      <UniversalShareSheet 
        isOpen={isShareSheetOpen}
        onOpenChange={setIsShareSheetOpen}
        shareType="job"
        shareId={job.id}
        shareData={{
          jobId: job.id,
          title: job.title,
          company: job.company_pages?.name || job.company,
          location: job.location,
          type: job.type,
          logoUrl: job.company_pages?.logo_url,
          subtitle: `${job.company_pages?.name || job.company} • ${job.location}`
        }}
      />
      {job && (
        <ReportDialog
          open={isReportOpen}
          onOpenChange={setIsReportOpen}
          targetType="job"
          targetId={job.id}
        />
      )}
    </div>
  );
};

export default JobDetail;

