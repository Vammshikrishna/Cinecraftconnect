import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Plus, Briefcase } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useJobMutation } from '@/hooks/mutations/useJobMutation';
import { Job, JobType, ExperienceLevel, JOB_TYPES, EXPERIENCE_LEVELS } from '@/types/jobs';
import { useMyPages } from '@/hooks/useCompanyPages';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { User, Building2 } from 'lucide-react';

interface JobCreationModalProps {
  onJobCreated?: () => void;
  defaultOpen?: boolean;
  defaultPageId?: string;
  triggerButton?: React.ReactNode;
  jobToEdit?: Job;
}

export const JobCreationModal = ({ onJobCreated, defaultOpen = false, defaultPageId = "user", triggerButton, jobToEdit }: JobCreationModalProps) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();
  const { data: myPages } = useMyPages();
  const { createJob, updateJob } = useJobMutation();
  const [selectedPageId, setSelectedPageId] = useState<string | "user">(jobToEdit?.page_id || defaultPageId);

  useEffect(() => {
    if (defaultOpen) setIsOpen(true);
  }, [defaultOpen]);

  useEffect(() => {
    if (jobToEdit && isOpen) {
      setJobData({
        title: jobToEdit.title || '',
        description: jobToEdit.description || '',
        company: jobToEdit.company || jobToEdit.company_pages?.name || '',
        location: jobToEdit.location || '',
        type: jobToEdit.type || '' as JobType,
        salary_min: jobToEdit.salary_min ? String(jobToEdit.salary_min) : '',
        salary_max: jobToEdit.salary_max ? String(jobToEdit.salary_max) : '',
        experience_level: jobToEdit.experience_level || '' as ExperienceLevel,
        requirements: jobToEdit.requirements || ''
      });
      setSelectedPageId(jobToEdit.page_id || "user");
    } else if (!jobToEdit && isOpen) {
      setJobData({
        title: '',
        description: '',
        company: '',
        location: '',
        type: '' as JobType,
        salary_min: '',
        salary_max: '',
        experience_level: '' as ExperienceLevel,
        requirements: ''
      });
      setSelectedPageId(defaultPageId);
    }
  }, [jobToEdit, isOpen, defaultPageId]);

  const [jobData, setJobData] = useState({
    title: '',
    description: '',
    company: '',
    location: '',
    type: '' as JobType,
    salary_min: '',
    salary_max: '',
    experience_level: '' as ExperienceLevel,
    requirements: ''
  });

  const handlePageChange = (value: string) => {
    setSelectedPageId(value);
    if (value !== "user") {
      const page = myPages?.find(p => p.id === value);
      if (page) {
        setJobData(prev => ({ ...prev, company: page.name }));
      }
    } else {
      setJobData(prev => ({ ...prev, company: "" }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user) {
      toast({
        title: "Authentication Required",
        description: "Please sign in to post a job.",
        variant: "destructive",
      });
      return;
    }

    if (!jobData.title.trim() || !jobData.description.trim() || !jobData.company.trim()) {
      toast({
        title: "Missing Information",
        description: "Please fill in the job title, description, and company name.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      if (!user) return;

      const payload = {
        title: jobData.title,
        description: jobData.description,
        company: jobData.company,
        location: jobData.location,
        type: jobData.type || 'full-time',
        salary_min: jobData.salary_min ? parseFloat(jobData.salary_min) : null,
        salary_max: jobData.salary_max ? parseFloat(jobData.salary_max) : null,
        experience_level: jobData.experience_level || 'mid',
        requirements: jobData.requirements,
        posted_by: user.id,
        page_id: selectedPageId === "user" ? null : selectedPageId
      };

      if (jobToEdit?.id) {
          await updateJob(jobToEdit.id, payload);
          toast({
            title: "Job Updated Successfully!",
            description: "Your job posting has been updated.",
          });
      } else {
          await createJob(payload);
          toast({
            title: "Job Posted Successfully!",
            description: "Your job posting has been created and is now live.",
          });
      }

      // Reset form if it is a new post
      if (!jobToEdit) {
          setJobData({
            title: '',
            description: '',
            company: '',
            location: '',
            type: '' as JobType,
            salary_min: '',
            salary_max: '',
            experience_level: '' as ExperienceLevel,
            requirements: ''
          });
      }

      setIsOpen(false);
      onJobCreated?.();
    } catch (error: any) {
      console.error('Error creating job:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to create job posting. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {triggerButton || (
          <Button className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold h-10 px-4 rounded-xl shadow-lg shadow-primary/20 hover:scale-105 transition-all shrink-0 text-sm">
            <Plus className="mr-2 h-4 w-4" />
            <span>{jobToEdit ? "Edit Job" : "Post a Job"}</span>
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto w-[95vw]">
        <DialogHeader>
          <DialogTitle className="flex items-center">
            <Briefcase className="mr-2 h-5 w-5" />
            {jobToEdit ? "Edit Job Posting" : "Post New Job"}
          </DialogTitle>
          <DialogDescription>
            {jobToEdit ? "Update the details of this job posting." : "Create a new job posting to find the perfect candidates for your project."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2 pb-4 border-b border-white/10">
            <Label className="text-muted-foreground text-xs uppercase font-bold tracking-wider">Post job as:</Label>
            <Select value={selectedPageId} onValueChange={handlePageChange}>
              <SelectTrigger className="w-full glass-card border-white/10">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="glass-card border-white/10">
                <SelectItem value="user">
                  <div className="flex items-center gap-2 py-1">
                    <Avatar className="h-6 w-6">
                      <AvatarImage src={user?.user_metadata?.avatar_url} />
                      <AvatarFallback><User className="h-3 w-3" /></AvatarFallback>
                    </Avatar>
                    <span className="font-medium text-foreground">Personal Identity</span>
                  </div>
                </SelectItem>
                {(myPages || []).map(page => (
                  <SelectItem key={page.id} value={page.id}>
                    <div className="flex items-center gap-2 py-1 text-primary">
                      <Avatar className="h-6 w-6">
                        <AvatarImage src={page.logo_url || ""} />
                        <AvatarFallback><Building2 className="h-3 w-3" /></AvatarFallback>
                      </Avatar>
                      <span className="font-medium">{page.name}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="title">Job Title *</Label>
              <Input
                id="title"
                placeholder="e.g. Cinematographer, Sound Designer"
                value={jobData.title}
                onChange={(e) => setJobData(prev => ({ ...prev, title: e.target.value }))}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="company">Company *</Label>
              <Input
                id="company"
                placeholder="Company or Production Name"
                value={jobData.company}
                onChange={(e) => setJobData(prev => ({ ...prev, company: e.target.value }))}
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Job Description *</Label>
            <Textarea
              id="description"
              placeholder="Describe the role, responsibilities, and what you're looking for..."
              value={jobData.description}
              onChange={(e) => setJobData(prev => ({ ...prev, description: e.target.value }))}
              className="min-h-[120px]"
              required
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="location">Location</Label>
              <Input
                id="location"
                placeholder="e.g. Los Angeles, CA or Remote"
                value={jobData.location}
                onChange={(e) => setJobData(prev => ({ ...prev, location: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="type">Job Type</Label>
              <Select value={jobData.type} onValueChange={(value) => setJobData(prev => ({ ...prev, type: value as JobType }))}>
                <SelectTrigger id="type">
                  <SelectValue placeholder="Select job type" />
                </SelectTrigger>
                <SelectContent>
                  {JOB_TYPES.map(type => (
                    <SelectItem key={type} value={type}>
                      {type.charAt(0).toUpperCase() + type.slice(1).replace('-', ' ')}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="salary_min">Salary Range (Min)</Label>
              <Input
                id="salary_min"
                placeholder="e.g. 50000"
                value={jobData.salary_min}
                onChange={(e) => setJobData(prev => ({ ...prev, salary_min: e.target.value }))}
                type="number"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="salary_max">Salary Range (Max)</Label>
              <Input
                id="salary_max"
                placeholder="e.g. 80000"
                value={jobData.salary_max}
                onChange={(e) => setJobData(prev => ({ ...prev, salary_max: e.target.value }))}
                type="number"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="experience_level">Experience Level</Label>
            <Select value={jobData.experience_level} onValueChange={(value) => setJobData(prev => ({ ...prev, experience_level: value as ExperienceLevel }))}>
              <SelectTrigger id="experience_level">
                <SelectValue placeholder="Select experience level" />
              </SelectTrigger>
              <SelectContent>
                {EXPERIENCE_LEVELS.map(level => (
                  <SelectItem key={level} value={level}>
                    {level.charAt(0).toUpperCase() + level.slice(1)} Level
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="requirements">Requirements & Qualifications</Label>
            <Textarea
              id="requirements"
              placeholder="List the key requirements, skills, and qualifications needed for this role..."
              value={jobData.requirements}
              onChange={(e) => setJobData(prev => ({ ...prev, requirements: e.target.value }))}
              className="min-h-[100px]"
            />
          </div>

          <DialogFooter className="flex gap-2">
            <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? (jobToEdit ? 'Updating...' : 'Creating...') : (jobToEdit ? 'Update Job' : 'Post Job')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};