
import { useState, useEffect } from "react";
import { Search, MapPin, Clock, Briefcase, Filter, ArrowUpDown, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { JobCreationModal } from "@/components/jobs/JobCreationModal";
import { JobApplicationModal } from "@/components/jobs/JobApplicationModal";
import { supabase } from "@/integrations/supabase/client";
import { Job } from "@/types/jobs";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { formatDistanceToNow } from "date-fns";
import { Link, useNavigate } from "react-router-dom";
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


const Jobs = ({ openCreate = false }: { openCreate?: boolean }) => {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [appliedJobIds, setAppliedJobIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentSelectedJob, setCurrentSelectedJob] = useState<{ id: string, title: string } | null>(null);
  const [sortBy, setSortBy] = useState<'newest' | 'salary_high' | 'salary_low'>('newest');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterExperience, setFilterExperience] = useState<string>('all');
  const { toast } = useToast();
  const { user } = useAuth();
  const { isFan } = useAccountType();
  const { isAdmin } = useAppRole();
  const navigate = useNavigate();

  const fetchJobs = async () => {
    setLoading(true);
    try {
      let query = supabase
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
        .eq('is_active', true);

      // Apply Filters
      if (filterType !== 'all') {
        query = query.eq('type', filterType as any);
      }
      if (filterExperience !== 'all') {
        query = query.eq('experience_level', filterExperience as any);
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
        query = query.or(`title.ilike.%${searchQuery}%,description.ilike.%${searchQuery}%,company.ilike.%${searchQuery}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      setJobs(data as any);
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
      const appliedIds = new Set(data.map(app => app.job_id));
      setAppliedJobIds(appliedIds);
    } catch (error) {
      console.error('Error fetching applications:', error);
    }
  };

  useEffect(() => {
    fetchJobs();
  }, [searchQuery, sortBy, filterType, filterExperience]);

  useEffect(() => {
    fetchUserApplications();
  }, [user?.id]);

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
      {/* Background Orbs aligned with global theme */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-primary/5 blur-[120px]" />
      </div>

      <main className="max-w-7xl mx-auto px-4 md:px-8 pt-20 pb-40 relative z-10">
        <PageHeader 
          title="Jobs" 
          subtitle="Explore unique roles in film and creative production" 
          Icon={Briefcase}
          actions={
            !isFan && (
              <div className="flex flex-wrap gap-3">
                <Link to="/jobs/applications">
                  <Button variant="ghost" className="rounded-xl border border-border/50 hover:bg-muted/50 h-10 px-4 text-sm font-bold">My Applications</Button>
                </Link>
                <Link to="/jobs/manage">
                  <Button variant="ghost" className="rounded-xl border border-border/50 hover:bg-muted/50 h-10 px-4 text-sm font-bold">Manage Postings</Button>
                </Link>
                <JobCreationModal onJobCreated={fetchJobs} defaultOpen={openCreate} />
              </div>
            )
          }

        />

        {/* Search & Filter Bar using system glassmorphism */}
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-card/40 border border-border/50 rounded-3xl p-3 md:p-4 mb-12 backdrop-blur-xl"
        >
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-grow">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground/50" size={18} />
              <Input
                placeholder="Search for jobs, companies, or roles..."
                className="h-14 pl-12 bg-transparent border-transparent focus:bg-muted/30 rounded-2xl transition-all font-medium placeholder:text-muted-foreground/50"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <div className="flex gap-2">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="ghost" className={`h-14 px-6 rounded-2xl border border-border/50 hover:bg-muted/50 gap-2 font-bold uppercase tracking-widest text-xs transition-colors ${(filterType !== 'all' || filterExperience !== 'all') ? 'text-primary border-primary/30 bg-primary/5' : ''}`}>
                    <Filter size={16} /> Filters
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-80 p-6 glass-card border-border/40 rounded-[2rem] shadow-2xl mr-4" align="end">
                  <div className="space-y-6">
                    <div className="space-y-3">
                      <h4 className="text-sm font-black uppercase tracking-widest text-muted-foreground/50">Job Type</h4>
                      <div className="flex flex-wrap gap-2">
                        {['all', 'full-time', 'part-time', 'contract', 'project-based'].map((type) => (
                          <Button 
                            key={type}
                            variant={filterType === type ? 'default' : 'outline'}
                            onClick={() => setFilterType(type)}
                            className="h-9 px-4 rounded-xl text-xs font-bold"
                          >
                            {type === 'all' ? 'Any' : type.replace('-', ' ')}
                          </Button>
                        ))}
                      </div>
                    </div>

                    <DropdownMenuSeparator className="bg-border/20" />

                    <div className="space-y-3">
                      <h4 className="text-sm font-black uppercase tracking-widest text-muted-foreground/50">Experience</h4>
                      <div className="flex flex-wrap gap-2">
                        {['all', 'Entry', 'Mid', 'Senior', 'Lead'].map((level) => (
                          <Button 
                            key={level}
                            variant={filterExperience === level ? 'default' : 'outline'}
                            onClick={() => setFilterExperience(level)}
                            className="h-9 px-4 rounded-xl text-xs font-bold"
                          >
                            {level === 'all' ? 'Any' : level}
                          </Button>
                        ))}
                      </div>
                    </div>

                    {(filterType !== 'all' || filterExperience !== 'all') && (
                      <>
                        <DropdownMenuSeparator className="bg-border/20" />
                        <Button 
                          variant="ghost" 
                          className="w-full h-10 rounded-xl text-xs font-black text-primary uppercase"
                          onClick={() => {
                            setFilterType('all');
                            setFilterExperience('all');
                          }}
                        >
                          Clear All Filters
                        </Button>
                      </>
                    )}
                  </div>
                </PopoverContent>
              </Popover>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className={`h-14 px-6 rounded-2xl border border-border/50 hover:bg-muted/50 gap-2 font-bold uppercase tracking-widest text-xs transition-colors ${sortBy !== 'newest' ? 'text-primary border-primary/30 bg-primary/5' : ''}`}>
                    <ArrowUpDown size={16} /> Sort
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
            </div>
          </div>
        </motion.div>

        {/* Job Listings using system cards */}
        <div className="space-y-6">
          {loading ? (
            <div className="space-y-6">
              {[1, 2, 3].map((i) => (
                <div key={i} className="glass-card-premium p-8 h-48 animate-pulse" />
              ))}
            </div>

          ) : jobs.length === 0 ? (
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="text-center py-20 bg-card/10 border border-border/50 rounded-[3rem]"
            >
              <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-6">
                <Briefcase size={32} className="text-primary" />
              </div>
              <h3 className="text-2xl font-black mb-2">The set is quiet...</h3>
              <p className="text-muted-foreground mb-8 max-w-sm mx-auto">No job listings found matching your search. Be the one to start the next production!</p>
              <JobCreationModal onJobCreated={fetchJobs} />
            </motion.div>
          ) : (
            <div className="space-y-6">
              <AnimatePresence mode="popLayout">
              {jobs.map((job, index) => {
                const isApplied = appliedJobIds.has(job.id);
                const isOwner = user?.id === job.posted_by;
                
                return (
                  <motion.div 
                    layout
                    key={job.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                    onClick={() => navigate(`/jobs/${job.id}`)}
                    className="group glass-card-premium p-6 md:p-8 cursor-pointer relative overflow-hidden"
                  >
                    {/* Hover Glow */}
                    <div className="absolute top-0 right-0 w-1/2 h-full bg-gradient-to-l from-primary/[0.02] to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
                    
                    <div className="flex flex-col md:flex-row justify-between gap-6 relative z-10">
                      <div className="flex-grow space-y-4">
                        <div className="flex items-center gap-4">
                          <motion.div whileHover={{ scale: 1.05 }} className="shrink-0 p-0.5 rounded-2xl bg-gradient-to-br from-primary/20 to-transparent">
                            <Avatar className="h-16 w-16 md:h-20 md:w-20 rounded-[1.5rem] border-2 border-background">
                              <AvatarImage src={job.company_pages?.logo_url || ""} />
                              <AvatarFallback className="bg-primary/10 text-primary font-black uppercase text-2xl">
                                {(job.company_pages?.name || job.company).charAt(0)}
                              </AvatarFallback>
                            </Avatar>
                          </motion.div>
                          <div className="space-y-1">
                            <h3 className="text-2xl md:text-3xl font-black tracking-tight group-hover:text-primary transition-colors leading-none">
                              {job.title}
                            </h3>
                            <div className="flex items-center gap-2">
                              {job.company_pages ? (
                                <span className="font-bold text-muted-foreground/60 text-sm md:text-base">{job.company_pages.name}</span>
                              ) : (
                                <span className="font-bold text-muted-foreground/60 text-sm md:text-base">{job.company}</span>
                              )}
                              <span className="w-1 h-1 rounded-full bg-muted-foreground/20" />
                              <span className="text-[10px] font-black uppercase tracking-widest text-primary/60">
                                {formatDistanceToNow(new Date(job.created_at), { addSuffix: true })}
                              </span>
                            </div>
                          </div>
                        </div>

                        <p className="text-muted-foreground text-base md:text-lg font-medium leading-relaxed max-w-3xl line-clamp-2 md:line-clamp-3">
                          {job.description}
                        </p>

                        <div className="flex flex-wrap gap-3">
                          {[
                            { icon: MapPin, text: job.location || "Remote" },
                            { icon: Briefcase, text: job.type.replace('-', ' ') },
                            { icon: Clock, text: `${job.experience_level} Level` }
                          ].map((tag, i) => (
                            <div key={i} className="flex items-center gap-2 border border-border/50 bg-muted/20 px-4 py-2 rounded-xl text-muted-foreground/80 font-bold text-xs uppercase tracking-widest hover:bg-muted/30 hover:text-foreground transition-colors">
                              <tag.icon size={14} className="text-primary/60" />
                              {tag.text}
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="shrink-0 flex flex-col items-start md:items-end justify-between min-w-[240px]">
                        <div className="text-left md:text-right w-full mb-6">
                          {(job.salary_min || job.salary_max) ? (
                            <div className="space-y-1">
                              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/50">Est. Salary Range</p>
                              <p className="text-2xl md:text-3xl font-black text-primary tracking-tighter">
                                {job.salary_min ? `₹${job.salary_min.toLocaleString()}` : ''}
                                {job.salary_min && job.salary_max ? ' - ' : ''}
                                {job.salary_max ? `₹${job.salary_max.toLocaleString()}` : ''}
                              </p>
                            </div>
                          ) : (
                            <p className="text-sm font-bold text-muted-foreground/40 italic">Salary Competitive</p>
                          )}
                        </div>

                        <div className="w-full md:w-auto min-w-[200px]">
                          {(isOwner || isAdmin) ? (
                            <Button 
                              variant="ghost" 
                              onClick={(e) => { e.stopPropagation(); navigate("/jobs/manage"); }} 
                              className="w-full h-14 rounded-2xl border border-border/50 hover:bg-muted/20 font-bold uppercase tracking-widest text-xs"
                            >
                              Manage Listing
                            </Button>
                          ) : isApplied ? (
                            <Button disabled className="w-full h-14 rounded-2xl bg-primary/10 text-primary border border-primary/20 font-bold">
                              <CheckCircle className="mr-2 h-5 w-5" />
                              Applied
                            </Button>
                          ) : (
                            <Button 
                              className="w-full h-14 rounded-2xl bg-primary text-primary-foreground font-black text-lg shadow-xl shadow-primary/10 group-hover:scale-[1.02] transition-all" 
                              onClick={(e) => { e.stopPropagation(); handleApplyClick(job); }}
                            >
                              Apply Now
                            </Button>
                          )}
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

