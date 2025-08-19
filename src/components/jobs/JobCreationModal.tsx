import { useState } from 'react';
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

interface JobCreationModalProps {
  onJobCreated?: () => void;
}

export const JobCreationModal = ({ onJobCreated }: JobCreationModalProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const [jobData, setJobData] = useState({
    title: '',
    description: '',
    company: '',
    location: '',
    type: '',
    salary_min: '',
    salary_max: '',
    experience_level: '',
    requirements: ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
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
      // Here you would typically save to your backend
      // For now, we'll just simulate success
      await new Promise(resolve => setTimeout(resolve, 1000));

      toast({
        title: "Job Posted Successfully!",
        description: "Your job posting has been created and is now live.",
      });

      // Reset form
      setJobData({
        title: '',
        description: '',
        company: '',
        location: '',
        type: '',
        salary_min: '',
        salary_max: '',
        experience_level: '',
        requirements: ''
      });

      setIsOpen(false);
      onJobCreated?.();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to create job posting. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button className="bg-primary hover:bg-primary/90">
          <Plus className="mr-2 h-4 w-4" />
          Post a Job
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center">
            <Briefcase className="mr-2 h-5 w-5" />
            Post New Job
          </DialogTitle>
          <DialogDescription>
            Create a new job posting to find the perfect candidates for your project.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="title">Job Title *</Label>
              <Input
                id="title"
                placeholder="e.g. Cinematographer, Sound Designer"
                value={jobData.title}
                onChange={(e) => setJobData(prev => ({...prev, title: e.target.value}))}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="company">Company *</Label>
              <Input
                id="company"
                placeholder="Company or Production Name"
                value={jobData.company}
                onChange={(e) => setJobData(prev => ({...prev, company: e.target.value}))}
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
              onChange={(e) => setJobData(prev => ({...prev, description: e.target.value}))}
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
                onChange={(e) => setJobData(prev => ({...prev, location: e.target.value}))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="type">Job Type</Label>
              <Select value={jobData.type} onValueChange={(value) => setJobData(prev => ({...prev, type: value}))}>
                <SelectTrigger>
                  <SelectValue placeholder="Select job type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="full-time">Full-time</SelectItem>
                  <SelectItem value="part-time">Part-time</SelectItem>
                  <SelectItem value="contract">Contract</SelectItem>
                  <SelectItem value="freelance">Freelance</SelectItem>
                  <SelectItem value="internship">Internship</SelectItem>
                  <SelectItem value="project-based">Project-based</SelectItem>
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
                onChange={(e) => setJobData(prev => ({...prev, salary_min: e.target.value}))}
                type="number"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="salary_max">Salary Range (Max)</Label>
              <Input
                id="salary_max"
                placeholder="e.g. 80000"
                value={jobData.salary_max}
                onChange={(e) => setJobData(prev => ({...prev, salary_max: e.target.value}))}
                type="number"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="experience_level">Experience Level</Label>
            <Select value={jobData.experience_level} onValueChange={(value) => setJobData(prev => ({...prev, experience_level: value}))}>
              <SelectTrigger>
                <SelectValue placeholder="Select experience level" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="entry">Entry Level (0-2 years)</SelectItem>
                <SelectItem value="junior">Junior (2-5 years)</SelectItem>
                <SelectItem value="mid">Mid Level (5-8 years)</SelectItem>
                <SelectItem value="senior">Senior (8+ years)</SelectItem>
                <SelectItem value="lead">Lead/Director Level</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="requirements">Requirements & Qualifications</Label>
            <Textarea
              id="requirements"
              placeholder="List the key requirements, skills, and qualifications needed for this role..."
              value={jobData.requirements}
              onChange={(e) => setJobData(prev => ({...prev, requirements: e.target.value}))}
              className="min-h-[100px]"
            />
          </div>

          <DialogFooter className="flex gap-2">
            <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Creating...' : 'Post Job'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};