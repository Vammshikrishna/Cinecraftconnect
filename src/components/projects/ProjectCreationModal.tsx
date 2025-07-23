
import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { MultiStepForm } from '@/components/ui/multi-step-form';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Plus, X, Calendar, DollarSign, MapPin, Users } from 'lucide-react';

interface ProjectCreationModalProps {
  onProjectCreated?: () => void;
}

export const ProjectCreationModal = ({ onProjectCreated }: ProjectCreationModalProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  
  const [projectData, setProjectData] = useState({
    title: '',
    description: '',
    genre: [] as string[],
    location: '',
    budget_min: '',
    budget_max: '',
    start_date: '',
    end_date: '',
    required_roles: [] as string[],
    status: 'planning',
    is_public: true,
  });

  const availableGenres = [
    'Action', 'Drama', 'Comedy', 'Thriller', 'Horror', 'Sci-Fi', 'Romance', 
    'Documentary', 'Animation', 'Fantasy', 'Mystery', 'Adventure', 'Musical'
  ];

  const availableRoles = [
    'Director', 'Producer', 'Cinematographer', 'Editor', 'Sound Designer',
    'Production Designer', 'Costume Designer', 'Makeup Artist', 'Actor',
    'Screenwriter', 'Composer', 'VFX Artist', 'Gaffer', 'Script Supervisor'
  ];

  const handleGenreToggle = (genre: string) => {
    setProjectData(prev => ({
      ...prev,
      genre: prev.genre.includes(genre)
        ? prev.genre.filter(g => g !== genre)
        : [...prev.genre, genre]
    }));
  };

  const handleRoleToggle = (role: string) => {
    setProjectData(prev => ({
      ...prev,
      required_roles: prev.required_roles.includes(role)
        ? prev.required_roles.filter(r => r !== role)
        : [...prev.required_roles, role]
    }));
  };

  const validateBasicInfo = () => {
    return projectData.title.trim() !== '' && projectData.description.trim() !== '';
  };

  const validateGenreAndRoles = () => {
    return projectData.genre.length > 0 && projectData.required_roles.length > 0;
  };

  const handleSubmit = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      const { error } = await supabase
        .from('projects')
        .insert({
          ...projectData,
          creator_id: user.id,
          budget_min: projectData.budget_min ? parseInt(projectData.budget_min) : null,
          budget_max: projectData.budget_max ? parseInt(projectData.budget_max) : null,
          start_date: projectData.start_date || null,
          end_date: projectData.end_date || null,
        });

      if (error) throw error;

      toast({
        title: "Project Created",
        description: "Your project has been created successfully!",
      });
      
      setIsOpen(false);
      setProjectData({
        title: '',
        description: '',
        genre: [],
        location: '',
        budget_min: '',
        budget_max: '',
        start_date: '',
        end_date: '',
        required_roles: [],
        status: 'planning',
        is_public: true,
      });
      
      onProjectCreated?.();
    } catch (error) {
      console.error('Error creating project:', error);
      toast({
        title: "Creation Failed",
        description: "There was an error creating your project.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const steps = [
    {
      title: "Basic Information",
      validation: validateBasicInfo,
      component: (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Project Title *</Label>
            <Input
              id="title"
              value={projectData.title}
              onChange={(e) => setProjectData(prev => ({ ...prev, title: e.target.value }))}
              placeholder="Enter your project title"
              className="bg-white/5 border-white/10"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Description *</Label>
            <Textarea
              id="description"
              value={projectData.description}
              onChange={(e) => setProjectData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Describe your project vision..."
              className="bg-white/5 border-white/10 min-h-[100px]"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="location" className="flex items-center">
              <MapPin className="mr-1 h-4 w-4" />
              Location
            </Label>
            <Input
              id="location"
              value={projectData.location}
              onChange={(e) => setProjectData(prev => ({ ...prev, location: e.target.value }))}
              placeholder="Filming location"
              className="bg-white/5 border-white/10"
            />
          </div>
        </div>
      )
    },
    {
      title: "Genre & Roles",
      validation: validateGenreAndRoles,
      component: (
        <div className="space-y-6">
          <div className="space-y-3">
            <Label className="text-white">Project Genre *</Label>
            <div className="flex flex-wrap gap-2">
              {availableGenres.map((genre) => (
                <Badge
                  key={genre}
                  variant={projectData.genre.includes(genre) ? "default" : "outline"}
                  className={`cursor-pointer transition-colors ${
                    projectData.genre.includes(genre)
                      ? 'bg-cinesphere-purple text-white'
                      : 'border-white/20 hover:bg-white/10'
                  }`}
                  onClick={() => handleGenreToggle(genre)}
                >
                  {genre}
                </Badge>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <Label className="text-white flex items-center">
              <Users className="mr-1 h-4 w-4" />
              Required Roles *
            </Label>
            <div className="flex flex-wrap gap-2">
              {availableRoles.map((role) => (
                <Badge
                  key={role}
                  variant={projectData.required_roles.includes(role) ? "default" : "outline"}
                  className={`cursor-pointer transition-colors ${
                    projectData.required_roles.includes(role)
                      ? 'bg-cinesphere-blue text-white'
                      : 'border-white/20 hover:bg-white/10'
                  }`}
                  onClick={() => handleRoleToggle(role)}
                >
                  {role}
                </Badge>
              ))}
            </div>
          </div>
        </div>
      )
    },
    {
      title: "Budget & Timeline",
      component: (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="budget_min" className="flex items-center">
                <DollarSign className="mr-1 h-4 w-4" />
                Minimum Budget
              </Label>
              <Input
                id="budget_min"
                type="number"
                value={projectData.budget_min}
                onChange={(e) => setProjectData(prev => ({ ...prev, budget_min: e.target.value }))}
                placeholder="0"
                className="bg-white/5 border-white/10"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="budget_max">Maximum Budget</Label>
              <Input
                id="budget_max"
                type="number"
                value={projectData.budget_max}
                onChange={(e) => setProjectData(prev => ({ ...prev, budget_max: e.target.value }))}
                placeholder="0"
                className="bg-white/5 border-white/10"
              />
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="start_date" className="flex items-center">
                <Calendar className="mr-1 h-4 w-4" />
                Start Date
              </Label>
              <Input
                id="start_date"
                type="date"
                value={projectData.start_date}
                onChange={(e) => setProjectData(prev => ({ ...prev, start_date: e.target.value }))}
                className="bg-white/5 border-white/10"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="end_date">End Date</Label>
              <Input
                id="end_date"
                type="date"
                value={projectData.end_date}
                onChange={(e) => setProjectData(prev => ({ ...prev, end_date: e.target.value }))}
                className="bg-white/5 border-white/10"
              />
            </div>
          </div>
        </div>
      )
    }
  ];

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button className="bg-cinesphere-purple hover:bg-cinesphere-purple/90">
          <Plus className="mr-2 h-4 w-4" />
          Create Project
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl bg-cinesphere-dark/95 border-white/10">
        <DialogHeader>
          <DialogTitle className="text-white text-2xl">Create New Project</DialogTitle>
        </DialogHeader>
        <MultiStepForm
          steps={steps}
          onComplete={handleSubmit}
          className="w-full"
        />
      </DialogContent>
    </Dialog>
  );
};
