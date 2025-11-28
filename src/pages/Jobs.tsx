import { useState, useEffect } from "react";

import { Search, MapPin, Clock, Briefcase, Filter, ArrowUpDown, Building2, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { JobCreationModal } from "@/components/jobs/JobCreationModal";
import { JobApplicationModal } from "@/components/jobs/JobApplicationModal";
import { supabase } from "@/integrations/supabase/client";
import { Job } from "@/types/jobs";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { formatDistanceToNow } from "date-fns";
import { Link } from "react-router-dom";

const Jobs = () => {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [appliedJobIds, setAppliedJobIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedJob, setSelectedJob] = useState<{ id: string, title: string } | null>(null);
  const { toast } = useToast();
  const { user } = useAuth();

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
          )
        `)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

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
  }, [searchQuery]);

  useEffect(() => {
    fetchUserApplications();
  }, [user]);

  const handleJobCreated = () => {
    fetchJobs();
  };

  const handleApplyClick = (job: Job) => {
    if (!user) {
      toast({
        title: "Sign in required",
        description: "Please sign in to apply for jobs",
        variant: "destructive"
      });
      return;
    }
    setSelectedJob({ id: job.id, title: job.title });
  };

  return (
    <div className="min-h-screen bg-background">
      <main className="max-w-7xl mx-auto px-4 md:px-8 pt-24 pb-24">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold mb-2">Jobs</h1>
            <p className="text-gray-400">Find your next role in film and television</p>
          </div>
          <div className="flex gap-2">
            <Link to="/jobs/applications">
              <Button variant="outline">My Applications</Button>
            </Link>
            <Link to="/jobs/manage">
              <Button variant="outline">Manage Jobs</Button>
            </Link>
            <JobCreationModal onJobCreated={handleJobCreated} />
          </div>
        </div>

        {/* Search and Filter Bar */}
        <div className="glass-card rounded-xl p-4 mb-8">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-grow">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <Input
                placeholder="Search for jobs, companies, or roles..."
                className="pl-10 bg-input border-border"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="border-border">
                <Filter size={18} className="mr-2" /> Filters
              </Button>
              <Button variant="outline" className="border-border">
                <ArrowUpDown size={18} className="mr-2" /> Sort
              </Button>
            </div>
          </div>
        </div>

        {/* Job Listings */}
        <div className="space-y-4">
          {loading ? (
            // Loading Skeletons
            [1, 2, 3].map((i) => (
              <div key={i} className="glass-card rounded-xl p-6 animate-pulse">
                <div className="h-6 bg-gray-700 rounded w-1/3 mb-4"></div>
                <div className="h-4 bg-gray-700 rounded w-1/4 mb-2"></div>
                <div className="h-4 bg-gray-700 rounded w-1/2"></div>
              </div>
            ))
          ) : jobs.length === 0 ? (
            <div className="text-center py-12 glass-card rounded-xl">
              <Briefcase size={48} className="mx-auto text-gray-500 mb-4" />
              <h3 className="text-xl font-semibold mb-2">No jobs found</h3>
              <p className="text-gray-400 mb-6">Be the first to post a job opportunity!</p>
              <JobCreationModal onJobCreated={handleJobCreated} />
            </div>
          ) : (
            jobs.map((job) => {
              const isApplied = appliedJobIds.has(job.id);
              const isOwner = user?.id === job.posted_by;

              return (
                <div key={job.id} className="glass-card rounded-xl p-6 hover:shadow-lg transition-all border border-white/5 hover:border-primary/20 group">
                  <div className="flex flex-col md:flex-row justify-between gap-4">
                    <div className="flex-grow">
                      <div className="flex justify-between items-start mb-2">
                        <h3 className="text-xl font-semibold group-hover:text-primary transition-colors">{job.title}</h3>
                        {job.created_at && (
                          <span className="text-xs text-gray-500 whitespace-nowrap ml-2">
                            {formatDistanceToNow(new Date(job.created_at), { addSuffix: true })}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center text-gray-300 mb-4">
                        <Building2 size={16} className="mr-2 text-primary" />
                        <span className="font-medium">{job.company}</span>
                      </div>

                      <p className="text-gray-400 text-sm mb-4 line-clamp-2">{job.description}</p>

                      <div className="flex flex-wrap gap-3 text-sm text-gray-400">
                        {job.location && (
                          <div className="flex items-center bg-white/5 px-2 py-1 rounded">
                            <MapPin size={14} className="mr-1.5" />
                            {job.location}
                          </div>
                        )}
                        <div className="flex items-center bg-white/5 px-2 py-1 rounded">
                          <Briefcase size={14} className="mr-1.5" />
                          <span className="capitalize">{job.type}</span>
                        </div>
                        <div className="flex items-center bg-white/5 px-2 py-1 rounded">
                          <Clock size={14} className="mr-1.5" />
                          <span className="capitalize">{job.experience_level} Level</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col md:items-end justify-between min-w-[140px] border-t md:border-t-0 md:border-l border-white/10 pt-4 md:pt-0 md:pl-6 mt-4 md:mt-0">
                      <div className="mb-4">
                        {(job.salary_min || job.salary_max) ? (
                          <div className="text-right">
                            <span className="text-xs text-gray-500 block mb-1">Salary Range</span>
                            <span className="font-semibold text-primary text-lg">
                              {job.salary_min ? `$${job.salary_min.toLocaleString()}` : ''}
                              {job.salary_min && job.salary_max ? ' - ' : ''}
                              {job.salary_max ? `$${job.salary_max.toLocaleString()}` : ''}
                            </span>
                          </div>
                        ) : (
                          <span className="text-sm text-gray-500">Salary not specified</span>
                        )}
                      </div>

                      {isOwner ? (
                        <Button variant="outline" className="w-full" disabled>
                          Posted by You
                        </Button>
                      ) : isApplied ? (
                        <Button className="w-full bg-green-600 hover:bg-green-700" disabled>
                          <CheckCircle className="mr-2 h-4 w-4" />
                          Applied
                        </Button>
                      ) : (
                        <Button className="w-full" onClick={() => handleApplyClick(job)}>
                          Apply Now
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {selectedJob && (
          <JobApplicationModal
            jobId={selectedJob.id}
            jobTitle={selectedJob.title}
            isOpen={!!selectedJob}
            onOpenChange={(open) => {
              if (!open) setSelectedJob(null);
              if (!open) fetchUserApplications();
            }}
          />
        )}
      </main>
    </div>
  );
};

export default Jobs;
