import { orTerm } from '@/lib/postgrest';

import { useState, useEffect } from "react";
import { Search, MapPin, Clock, Briefcase, Filter, ArrowUpDown, CheckCircle, Bookmark } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { JobCreationModal } from "@/components/jobs/JobCreationModal";
import { JobApplicationModal } from "@/components/jobs/JobApplicationModal";
import { supabase } from "@/integrations/supabase/client";
import { Job, JOB_TYPES, EXPERIENCE_LEVELS, WORK_MODES, JOB_TYPE_LABELS, EXPERIENCE_LABELS, WORK_MODE_LABELS, DEPARTMENTS } from "@/types/jobs";
import { formatSalary, getDeadlineInfo } from "@cinecraft/core";
import { JobAlertsDialog } from "@/components/jobs/JobAlertsDialog";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { formatDistanceToNow } from "date-fns";
import { Link } from "react-router-dom";
import { useAppNavigation } from "@/contexts/NavigationContext";
import { motion, AnimatePresence } from "framer-motion";
import { useAccountType } from "@/hooks/useAccountType";
import { useAppRole } from "@/hooks/useAppRole";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { PageHeader } from '@/components/common/PageHeader';
import { JobSkeleton } from "@/components/ui/enhanced-skeleton";
import SEO from "@/components/common/SEO";
import { UnifiedSearchBar } from "@/components/ui/unified-search-bar";
import { cn } from "@/lib/utils";

const Jobs = ({ openCreate = false }: { openCreate?: boolean }) => {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [appliedJobIds, setAppliedJobIds] = useState<string[]>([]);
  const [bookmarkedJobIds, setBookmarkedJobIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentSelectedJob, setCurrentSelectedJob] = useState<{ id: string, title: string } | null>(null);
  const [sortBy, setSortBy] = useState<'newest' | 'salary_high' | 'salary_low'>('newest');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterExperience, setFilterExperience] = useState<string>('all');
  const [filterWorkMode, setFilterWorkMode] = useState<string>('all');
  const [filterDepartment, setFilterDepartment] = useState<string>('all');
  const [closingSoonOnly, setClosingSoonOnly] = useState(false);
  const [savedOnly, setSavedOnly] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();
  const { isFan } = useAccountType();
  const { isInternal } = useAppRole();
  const { push } = useAppNavigation();
  const anyFilter =
    filterType !== 'all' || filterExperience !== 'all' || filterWorkMode !== 'all' || filterDepartment !== 'all' || closingSoonOnly || savedOnly;

  const fetchJobs = async () => {
    setLoading(true);
    try {
      let query = (supabase as any)
        .from('jobs')
        .select(`
          *,
          profiles:posted_by (
            full_name,
            avatar_url,
            username
          ),
          company_pages:page_id (
            id,
            name,
            logo_url,
            slug
          )
        `)
        .eq('is_active', true)
        .eq('is_draft', false);

      // Apply Filters
      if (filterType !== 'all') {
        query = query.eq('type', filterType as any);
      }
      if (filterExperience !== 'all') {
        query = query.eq('experience_level', filterExperience as any);
      }
      if (filterWorkMode !== 'all') {
        query = query.eq('work_mode', filterWorkMode);
      }
      if (filterDepartment !== 'all') {
        query = query.eq('department', filterDepartment);
      }

      // Apply Sorting
      if (sortBy === 'salary_high') {
        query = query.order('salary_max', { ascending: false });
      } else if (sortBy === 'salary_low') {
        query = query.order('salary_min', { ascending: true });
      } else {
        query = query.order('created_at', { ascending: false });
      }

      if (searchQuery) {
        query = query.or(`title.ilike.%${orTerm(searchQuery)}%,description.ilike.%${orTerm(searchQuery)}%,company.ilike.%${orTerm(searchQuery)}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      // Postings whose deadline has passed are not open any more, even if the database has not closed them yet.
      const now = Date.now();
      let list = ((data || []) as any[]).filter((j) => !j.deadline || new Date(j.deadline).getTime() > now);
      if (closingSoonOnly) list = list.filter((j) => getDeadlineInfo(j.deadline)?.urgent);
      setJobs(list as any);
    } catch (error: any) {
      console.error('Error fetching jobs:', error);
      toast({
        title: "Error",
        description: "Failed to load job listings.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchUserApplications = async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from('job_applications')
        .select('job_id')
        .eq('applicant_id', user.id);
      if (error) throw error;
      const appliedIds = data.map(app => app.job_id).filter((id): id is string => !!id);
      setAppliedJobIds(appliedIds);
    } catch (error) {
      console.error('Error fetching applications:', error);
    }
  };

  const fetchUserBookmarks = async () => {
    if (!user) {
      setBookmarkedJobIds([]);
      return;
    }
    try {
      const { data, error } = await supabase
        .from('job_bookmarks' as any)
        .select('job_id')
        .eq('user_id', user.id);
      if (error) throw error;
      const ids = (data || []).map((b: any) => b.job_id).filter(Boolean);
      setBookmarkedJobIds(ids);
    } catch (error) {
      console.error('Error fetching job bookmarks:', error);
    }
  };

  useEffect(() => {
    fetchJobs();
  }, [searchQuery, sortBy, filterType, filterExperience, filterWorkMode, filterDepartment, closingSoonOnly]);

  useEffect(() => {
    fetchUserApplications();
    fetchUserBookmarks();
  }, [user?.id]);

  // Real-time listener for job bookmarks across window and other tabs
  useEffect(() => {
    const handleBookmarkChange = (e: Event) => {
      const customEvent = e as CustomEvent<{ jobId: string; isBookmarked: boolean }>;
      if (customEvent.detail?.jobId) {
        setBookmarkedJobIds((prev) => {
          if (customEvent.detail.isBookmarked) {
            return prev.includes(customEvent.detail.jobId) ? prev : [...prev, customEvent.detail.jobId];
          } else {
            return prev.filter((id) => id !== customEvent.detail.jobId);
          }
        });
      }
    };

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'cc_job_bookmark_sync' && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          if (parsed?.jobId && typeof parsed?.isBookmarked === 'boolean') {
            setBookmarkedJobIds((prev) => {
              if (parsed.isBookmarked) {
                return prev.includes(parsed.jobId) ? prev : [...prev, parsed.jobId];
              } else {
                return prev.filter((id) => id !== parsed.jobId);
              }
            });
          }
        } catch {}
      }
    };

    window.addEventListener('jobBookmarkChanged', handleBookmarkChange);
    window.addEventListener('storage', handleStorageChange);
    return () => {
      window.removeEventListener('jobBookmarkChanged', handleBookmarkChange);
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  // Supabase Realtime subscription for jobs and bookmarks
  useEffect(() => {
    const channel = supabase
      .channel('jobs_realtime_web')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'jobs' }, () => {
        fetchJobs();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'job_bookmarks' }, () => {
        if (user) fetchUserBookmarks();
      })
      .subscribe();

    return () => {
      try {
        channel.unsubscribe();
        supabase.removeChannel(channel);
      } catch {}
    };
  }, [user?.id]);

  const handleToggleBookmark = async (jobId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user) {
      toast({
        title: "Sign in required",
        description: "Please sign in to save jobs.",
        variant: "destructive"
      });
      return;
    }

    const isCurrentlyBookmarked = bookmarkedJobIds.includes(jobId);
    const nextBookmarked = !isCurrentlyBookmarked;

    // Optimistic UI update
    setBookmarkedJobIds((prev) =>
      nextBookmarked ? [...prev, jobId] : prev.filter((id) => id !== jobId)
    );

    // Broadcast event across current window and other tabs
    window.dispatchEvent(
      new CustomEvent('jobBookmarkChanged', {
        detail: { jobId, isBookmarked: nextBookmarked }
      })
    );
    try {
      localStorage.setItem('cc_job_bookmark_sync', JSON.stringify({
        jobId,
        isBookmarked: nextBookmarked,
        ts: Date.now()
      }));
    } catch {}

    try {
      if (isCurrentlyBookmarked) {
        const { error } = await supabase
          .from('job_bookmarks' as any)
          .delete()
          .eq('job_id', jobId)
          .eq('user_id', user.id);
        if (error) throw error;
        toast({ title: "Removed from saved jobs" });
      } else {
        const { error } = await supabase
          .from('job_bookmarks' as any)
          .upsert({ job_id: jobId, user_id: user.id }, { onConflict: 'user_id,job_id' });
        if (error) throw error;
        toast({ title: "Job saved successfully" });
      }
    } catch (err) {
      console.error('Bookmark error:', err);
      // Revert
      setBookmarkedJobIds((prev) =>
        isCurrentlyBookmarked ? [...prev, jobId] : prev.filter((id) => id !== jobId)
      );
      window.dispatchEvent(
        new CustomEvent('jobBookmarkChanged', {
          detail: { jobId, isBookmarked: isCurrentlyBookmarked }
        })
      );
      try {
        localStorage.setItem('cc_job_bookmark_sync', JSON.stringify({
          jobId,
          isBookmarked: isCurrentlyBookmarked,
          ts: Date.now()
        }));
      } catch {}
      toast({
        title: "Error",
        description: "Could not update bookmark. Please try again.",
        variant: "destructive"
      });
    }
  };

  const visibleJobs = savedOnly ? jobs.filter((j) => bookmarkedJobIds.includes(j.id)) : jobs;

  const handleApplyClick = (job: Job) => {
    if (!user) {
      toast({
        title: "Sign in required",
        description: "Please sign in to apply for jobs",
        variant: "destructive"
      });
      return;
    }
    setCurrentSelectedJob({ id: job.id, title: job.title });
  };

  return (
    <div className="min-h-screen bg-background text-foreground selection:bg-primary/30 pb-36">
      <SEO 
        title="Jobs" 
        description="Find your next production role or hire top film talent on CineCraft Connect. Browse job listings for directors, actors, editors, and crew." 
      />
      {/* Background Orbs aligned with global theme */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-primary/5 blur-[120px]" />
      </div>

      <main className="max-w-7xl mx-auto px-4 md:px-8 pt-20 pb-40 relative z-10">
        <PageHeader 
          title="Jobs" 
          subtitle="Find your next production role or hire top film talent" 
          Icon={Briefcase}
          actions={
            (!isFan && !isInternal) && (
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full lg:w-auto">
                <div className="flex items-center gap-3 flex-1 sm:flex-none">
                  <Link to="/jobs/applications" className="flex-1 sm:flex-none">
                    <Button variant="ghost" className="w-full sm:w-auto rounded-xl border border-border/50 hover:bg-muted/50 h-11 px-4 text-xs font-bold whitespace-nowrap">My Applications</Button>
                  </Link>
                  <JobAlertsDialog />
                  <Link to="/jobs/manage" className="flex-1 sm:flex-none">
                    <Button variant="ghost" className="w-full sm:w-auto rounded-xl border border-border/50 hover:bg-muted/50 h-11 px-4 text-xs font-bold whitespace-nowrap">Manage Postings</Button>
                  </Link>
                </div>
                <div className="w-full sm:w-auto">
                  <JobCreationModal onJobCreated={fetchJobs} defaultOpen={openCreate} />
                </div>
              </div>
            )
          }
        />

        {/* Search & Filter Bar using system glassmorphism */}
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mb-8 md:mb-12"
        >
          <div className="flex flex-col md:flex-row gap-2 md:gap-4">
            <UnifiedSearchBar
              className="mb-0 flex-1"
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              searchPlaceholder="Search for jobs, companies, or roles..."
              hasActiveFilters={anyFilter}
              filterTitle="Filter Jobs"
              filterOpen={filterOpen}
              onFilterOpenChange={setFilterOpen}
              filterContent={
                <>
                  <div className="space-y-3">
                    <h4 className="text-sm font-black uppercase tracking-widest text-muted-foreground/50">Job Type</h4>
                    <div className="flex flex-wrap gap-2">
                      {['all', ...JOB_TYPES].map((type) => (
                        <Button
                          key={type}
                          variant={filterType === type ? 'default' : 'outline'}
                          onClick={() => setFilterType(type)}
                          className="h-9 px-4 rounded-xl text-xs font-bold"
                        >
                          {type === 'all' ? 'Any' : JOB_TYPE_LABELS[type as keyof typeof JOB_TYPE_LABELS]}
                        </Button>
                      ))}
                    </div>
                  </div>

                  <DropdownMenuSeparator className="bg-border/20" />

                  <div className="space-y-3">
                    <h4 className="text-sm font-black uppercase tracking-widest text-muted-foreground/50">Experience</h4>
                    <div className="flex flex-wrap gap-2">
                      {['all', ...EXPERIENCE_LEVELS].map((level) => (
                        <Button
                          key={level}
                          variant={filterExperience === level ? 'default' : 'outline'}
                          onClick={() => setFilterExperience(level)}
                          className="h-9 px-4 rounded-xl text-xs font-bold"
                        >
                          {level === 'all' ? 'Any' : EXPERIENCE_LABELS[level as keyof typeof EXPERIENCE_LABELS]}
                        </Button>
                      ))}
                    </div>
                  </div>

                  <DropdownMenuSeparator className="bg-border/20" />

                  <div className="space-y-3">
                    <h4 className="text-sm font-black uppercase tracking-widest text-muted-foreground/50">Where</h4>
                    <div className="flex flex-wrap gap-2">
                      {['all', ...WORK_MODES].map((mode) => (
                        <Button
                          key={mode}
                          variant={filterWorkMode === mode ? 'default' : 'outline'}
                          onClick={() => setFilterWorkMode(mode)}
                          className="h-9 px-4 rounded-xl text-xs font-bold"
                        >
                          {mode === 'all' ? 'Any' : WORK_MODE_LABELS[mode as keyof typeof WORK_MODE_LABELS]}
                        </Button>
                      ))}
                    </div>
                  </div>

                  <DropdownMenuSeparator className="bg-border/20" />

                  <div className="space-y-3">
                    <h4 className="text-sm font-black uppercase tracking-widest text-muted-foreground/50">Department</h4>
                    <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto">
                      {['all', ...DEPARTMENTS].map((d) => (
                        <Button
                          key={d}
                          variant={filterDepartment === d ? 'default' : 'outline'}
                          onClick={() => setFilterDepartment(d)}
                          className="h-8 px-3 rounded-xl text-[11px] font-bold"
                        >
                          {d === 'all' ? 'Any' : d}
                        </Button>
                      ))}
                    </div>
                  </div>

                  <DropdownMenuSeparator className="bg-border/20" />

                  <div className="flex flex-wrap gap-2">
                    <Button variant={closingSoonOnly ? 'default' : 'outline'} onClick={() => setClosingSoonOnly((v) => !v)} className="h-9 px-4 rounded-xl text-xs font-bold">
                      Closing soon
                    </Button>
                    {user && (
                      <Button variant={savedOnly ? 'default' : 'outline'} onClick={() => setSavedOnly((v) => !v)} className="h-9 px-4 rounded-xl text-xs font-bold">
                        Saved jobs
                      </Button>
                    )}
                  </div>

                  {anyFilter && (
                    <>
                      <DropdownMenuSeparator className="bg-border/20" />
                      <Button
                        variant="ghost"
                        className="w-full h-10 rounded-xl text-xs font-black text-primary uppercase"
                        onClick={() => {
                          setFilterType('all');
                          setFilterExperience('all');
                          setFilterWorkMode('all');
                          setFilterDepartment('all');
                          setClosingSoonOnly(false);
                          setSavedOnly(false);
                        }}
                      >
                        Clear All Filters
                      </Button>
                    </>
                  )}

                  {user && (
                    <>
                      <DropdownMenuSeparator className="bg-border/20" />
                      <JobAlertsDialog
                        prefill={{
                          keywords: searchQuery,
                          job_type: filterType !== 'all' ? filterType : null,
                          work_mode: filterWorkMode !== 'all' ? filterWorkMode : null,
                          department: filterDepartment !== 'all' ? filterDepartment : null,
                        }}
                        triggerButton={
                          <Button variant="outline" className="w-full h-10 rounded-xl text-xs font-black uppercase">
                            Alert me about jobs like this
                          </Button>
                        }
                      />
                    </>
                  )}
                </>
              }
              extraActions={
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className={cn(
                        "w-full sm:w-auto h-12 px-3 sm:px-5 rounded-xl border font-bold uppercase tracking-widest text-[10px] md:text-xs transition-colors shrink-0",
                        sortBy !== 'newest' ? 'text-primary border-primary/30 bg-primary/5' : 'border-border/50 hover:bg-muted/50'
                      )}>
                      <ArrowUpDown size={16} /> 
                      <span className="hidden sm:inline ml-2">Sort</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-56 p-2 glass-card border-border/40 rounded-2xl shadow-2xl" align="end">
                    <DropdownMenuLabel className="text-[10px] font-black uppercase tracking-tighter text-muted-foreground/50 px-3 py-2">Sort By</DropdownMenuLabel>
                    <DropdownMenuItem onClick={() => setSortBy('newest')} className={`rounded-xl px-3 py-2.5 font-bold cursor-pointer ${sortBy === 'newest' ? 'bg-primary/10 text-primary' : 'hover:bg-muted/50'}`}>
                      Newest First
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setSortBy('salary_high')} className={`rounded-xl px-3 py-2.5 font-bold cursor-pointer ${sortBy === 'salary_high' ? 'bg-primary/10 text-primary' : 'hover:bg-muted/50'}`}>
                      Highest Salary
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setSortBy('salary_low')} className={`rounded-xl px-3 py-2.5 font-bold cursor-pointer ${sortBy === 'salary_low' ? 'bg-primary/10 text-primary' : 'hover:bg-muted/50'}`}>
                      Lowest Salary
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              }
            />
          </div>
        </motion.div>

        {/* Job Listings using system cards */}
        <div className="space-y-6">
          {loading ? (
            <div className="space-y-6">
              {[1, 2, 3].map((i) => (
                <JobSkeleton key={i} />
              ))}
            </div>

          ) : visibleJobs.length === 0 ? (
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="text-center py-20 bg-card/10 border border-border/50 rounded-[3rem]"
            >
              <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-6">
                <Briefcase size={32} className="text-primary" />
              </div>
              <h3 className="text-2xl font-black mb-2">The set is quiet...</h3>
              <p className="text-muted-foreground mb-8 max-w-sm mx-auto">No job listings found matching your search. Be the one to start the next production!</p>
              {!isInternal && <JobCreationModal onJobCreated={fetchJobs} />}
            </motion.div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              <AnimatePresence mode="popLayout">
              {visibleJobs.map((job, index) => {
                const isApplied = appliedJobIds.includes(job.id);
                const isOwner = user?.id === job.posted_by;
                
                return (
                  <motion.div 
                    layout
                    key={job.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                    onClick={() => push(`/jobs/${job.id}`)}
                    className="group glass-card-premium p-4 md:p-6 cursor-pointer relative overflow-hidden flex flex-col h-full"
                  >
                    {/* Hover Glow */}
                    <div className="absolute top-0 right-0 w-1/2 h-full bg-gradient-to-l from-primary/[0.02] to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
                    
                    <div className="flex flex-col justify-between gap-6 h-full relative z-10">
                      <div className="flex-grow space-y-4">
                        <div className="flex items-center gap-4">
                          <motion.div whileHover={{ scale: 1.05 }} className="shrink-0 p-0.5 rounded-xl md:rounded-2xl bg-gradient-to-br from-primary/20 to-transparent">
                            <Avatar className="h-10 w-10 md:h-12 md:w-12 lg:h-14 lg:w-14 rounded-[0.8rem] md:rounded-[1rem] border-2 border-background">
                              <AvatarImage src={job.company_pages?.logo_url || ""} />
                              <AvatarFallback className="bg-primary/10 text-primary font-black uppercase text-base md:text-lg">
                                {(job.company_pages?.name || job.company).charAt(0)}
                              </AvatarFallback>
                            </Avatar>
                          </motion.div>
                          <div className="space-y-0.5 md:space-y-1">
                            <h3 className="font-serif text-lg lg:text-xl font-bold tracking-tight group-hover:text-primary transition-colors leading-tight line-clamp-1">
                              {job.title}
                            </h3>
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                              {job.company_pages ? (
                                <span className="font-bold text-muted-foreground/60 text-[10px] md:text-sm">{job.company_pages.name}</span>
                              ) : (
                                <span className="font-bold text-muted-foreground/60 text-[10px] md:text-sm">{job.company}</span>
                              )}
                              <span className="w-0.5 h-0.5 rounded-full bg-muted-foreground/20 hidden min-[400px]:block" />
                              <span className="text-[8px] md:text-[9px] font-black uppercase tracking-widest text-primary/60">
                                {formatDistanceToNow(new Date(job.created_at), { addSuffix: true })}
                              </span>
                            </div>
                          </div>
                        </div>



                        <div className="flex flex-wrap gap-3">
                          {[
                            { label: "LOC", text: job.work_mode === 'remote' ? 'Remote' : job.location || (job.work_mode ? WORK_MODE_LABELS[job.work_mode] : 'On set') },
                            { label: "TYPE", text: JOB_TYPE_LABELS[job.type] || job.type },
                            { label: "EXP", text: EXPERIENCE_LABELS[job.experience_level] || job.experience_level },
                            ...(job.department ? [{ label: "DEPT", text: job.department }] : []),
                          ].map((tag, i) => (
                            <div key={i} className="font-mono text-[9px] md:text-[10px] uppercase tracking-widest font-bold text-muted-foreground bg-muted/10 border border-border/40 px-2 py-1 rounded">
                              {tag.label} // {tag.text}
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="shrink-0 flex flex-col items-start justify-end mt-auto pt-6 border-t border-border/10 w-full">
                        <div className="text-left w-full mb-4">
                          {formatSalary(job) ? (
                            <div className="space-y-1">
                              <p className="text-[8px] md:text-[9px] font-black uppercase tracking-widest text-muted-foreground/50">Pay</p>
                              <p className="text-base md:text-lg lg:text-xl font-black text-primary tracking-tighter">{formatSalary(job)}</p>
                            </div>
                          ) : (
                            <p className="text-sm font-bold text-muted-foreground/40 italic">Pay on discussion</p>
                          )}
                          {(() => {
                            const dl = getDeadlineInfo(job.deadline);
                            return dl ? (
                              <p className={cn("mt-2 text-[10px] font-black uppercase tracking-widest", dl.urgent ? "text-amber-500" : "text-muted-foreground/60")}>
                                {dl.label}
                              </p>
                            ) : null;
                          })()}
                        </div>

                        <div className="w-full flex items-center gap-2">
                          {(isOwner || isInternal) ? (
                            <Button 
                              variant="ghost" 
                              onClick={(e) => { e.stopPropagation(); push("/jobs/manage"); }} 
                              className="flex-1 h-10 rounded-xl border border-border/50 hover:bg-muted/20 font-bold uppercase tracking-widest text-[10px]"
                            >
                              Manage Listing
                            </Button>
                          ) : isApplied ? (
                              <Button disabled className="flex-1 h-10 rounded-xl bg-primary/10 text-primary border border-primary/20 font-bold text-sm">
                              <CheckCircle className="mr-2 h-4 w-4" />
                              Applied
                            </Button>
                          ) : (
                            <Button 
                              className="flex-1 h-10 rounded-xl bg-primary text-primary-foreground font-black text-sm shadow-xl shadow-primary/10 group-hover:scale-[1.02] transition-all" 
                              onClick={(e) => { e.stopPropagation(); handleApplyClick(job); }}
                            >
                              Apply Now
                            </Button>
                          )}

                          <Button
                            variant="outline"
                            size="icon"
                            onClick={(e) => handleToggleBookmark(job.id, e)}
                            className={cn(
                              "h-10 w-10 shrink-0 rounded-xl border-border/50 hover:bg-muted/20 transition-colors",
                              bookmarkedJobIds.includes(job.id) && "text-primary border-primary/30 bg-primary/5"
                            )}
                            title={bookmarkedJobIds.includes(job.id) ? "Remove bookmark" : "Save job"}
                          >
                            <Bookmark
                              size={18}
                              className={cn(
                                bookmarkedJobIds.includes(job.id) ? "fill-primary text-primary" : "text-muted-foreground"
                              )}
                            />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
            </div>

          )}
        </div>

        {currentSelectedJob && (
          <JobApplicationModal
            jobId={currentSelectedJob.id}
            jobTitle={currentSelectedJob.title}
            isOpen={!!currentSelectedJob}
            onOpenChange={(open) => {
              if (!open) setCurrentSelectedJob(null);
              if (!open) fetchUserApplications();
            }}
          />
        )}
      </main>
    </div>
  );
};

export default Jobs;

