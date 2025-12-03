
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { MultiStepForm } from '@/components/ui/multi-step-form';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { Plus, Calendar, DollarSign, MapPin, Users, Image as ImageIcon, Lock, Globe } from 'lucide-react';

interface ProjectCreationModalProps {
  onProjectCreated?: () => void;
}

export const ProjectCreationModal = ({ onProjectCreated }: ProjectCreationModalProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);

  const [projectData, setProjectData] = useState({
    name: '',
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
  const [projectImage, setProjectImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  const availableGenres = [
    'Action', 'Drama', 'Comedy', 'Thriller', 'Horror', 'Sci-Fi', 'Romance',
    'Documentary', 'Animation', 'Fantasy', 'Mystery', 'Adventure', 'Musical'
  ];

  const availableRoles = [
    'Director', 'Producer', 'Cinematographer', 'Editor', 'Sound Designer',
    'Production Designer', 'Costume Designer', 'Makeup Artist', 'Actor',
    'Screenwriter', 'Composer', 'VFX Artist', 'Gaffer', 'Script Supervisor'
  ];

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setProjectImage(file);
      setImagePreview(URL.createObjectURL(file));
    }
  };

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
    return projectData.name.trim() !== '' && projectData.description.trim() !== '';
  };

  const validateGenreAndRoles = () => {
    return projectData.genre.length > 0;
  };

  const handleSubmit = async () => {
    if (!user) return;

    try {
      // let imageUrl: string | undefined = undefined; // Unused - image upload prepared for future use
      if (projectImage) {
        const fileExt = projectImage.name.split('.').pop();
        const fileName = `${user.id}-${Date.now()}.${fileExt}`;
        const { error: uploadError } = await supabase.storage
          .from('project-images')
          .upload(fileName, projectImage);

        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage.from('project-images').getPublicUrl(fileName);
        // imageUrl = urlData.publicUrl; // Prepared for future use
        console.log('Project image uploaded:', urlData.publicUrl);
      }

      const { data: newProject, error } = await supabase
        .from('projects')
        .insert({
          title: projectData.name,
          description: projectData.description,
          creator_id: user.id,
          genre: projectData.genre,
          location: projectData.location,
          required_roles: projectData.required_roles,
          status: projectData.status,
          is_public: projectData.is_public,
          start_date: projectData.start_date || null,
          end_date: projectData.end_date || null,
          budget_min: projectData.budget_min ? parseFloat(projectData.budget_min) : null,
          budget_max: projectData.budget_max ? parseFloat(projectData.budget_max) : null,
        })
        .select()
        .single();

      if (error) throw error;

      // Add creator as project member with owner role
      if (newProject) {
        await supabase.from('project_members').insert({
          project_id: newProject.id,
          user_id: user.id,
          role: 'owner',
        });
      }

      toast({
        title: "Project Created",
        description: "Your project has been created successfully!",
      });

      setIsOpen(false);
      onProjectCreated?.();

      if (newProject) {
        navigate(`/projects/${newProject.id}/space`);
      }

    } catch (error) {
      console.error('Error creating project:', error);
      console.error('Error details:', JSON.stringify(error, null, 2));
      toast({
        title: "Creation Failed",
        description: error instanceof Error ? error.message : "There was an error creating your project.",
        variant: "destructive",
      });
    }
  };

  const steps = [
    {
      title: "Basic Information",
      validation: validateBasicInfo,
      component: (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Project Name *</Label>
              <Input id="name" value={projectData.name} onChange={(e) => setProjectData(prev => ({ ...prev, name: e.target.value }))} placeholder="Enter your project name" className="bg-input border-border" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description *</Label>
              <Textarea id="description" value={projectData.description} onChange={(e) => setProjectData(prev => ({ ...prev, description: e.target.value }))} placeholder="Describe your project vision..." className="bg-input border-border min-h-[100px]" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="location" className="flex items-center"><MapPin className="mr-1 h-4 w-4" />Location</Label>
              <Input id="location" value={projectData.location} onChange={(e) => setProjectData(prev => ({ ...prev, location: e.target.value }))} placeholder="Filming location" className="bg-input border-border" />
            </div>
            <div className="space-y-2">
              <Label className="flex items-center">
                {projectData.is_public ? <Globe className="mr-1 h-4 w-4" /> : <Lock className="mr-1 h-4 w-4" />}
                Project Visibility
              </Label>
              <div className="flex items-center justify-between p-4 border border-border rounded-lg bg-muted/20">
                <div className="flex-1">
                  <p className="font-medium">{projectData.is_public ? 'Public Project' : 'Private Project'}</p>
                  <p className="text-sm text-muted-foreground">
                    {projectData.is_public
                      ? 'Visible to everyone. Anyone can view and apply to join.'
                      : 'Only visible to invited members. Others cannot see this project.'}
                  </p>
                </div>
                <Switch
                  checked={projectData.is_public}
                  onCheckedChange={(checked) => setProjectData(prev => ({ ...prev, is_public: checked }))}
                />
              </div>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Project Image</Label>
            <div className="w-full h-48 border-2 border-dashed border-border rounded-lg flex items-center justify-center text-muted-foreground hover:bg-muted/50 transition-colors cursor-pointer relative" onClick={() => document.getElementById('image-upload')?.click()}>
              {!imagePreview ? (
                <div className="text-center">
                  <ImageIcon className="mx-auto h-10 w-10 mb-2" />
                  <p>Click to upload an image</p>
                  <p className="text-xs">Recommended: 16:9 aspect ratio</p>
                </div>
              ) : (
                <img src={imagePreview} alt="Project preview" className="object-cover w-full h-full rounded-lg" />
              )}
              <Input id="image-upload" type="file" accept="image/*" onChange={handleImageChange} className="hidden" />
            </div>
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
            <Label className="text-foreground">Project Genre *</Label>
            <div className="flex flex-wrap gap-2">
              {availableGenres.map((genre) => (
                <Badge key={genre} variant={projectData.genre.includes(genre) ? "default" : "outline"} className={`cursor-pointer transition-colors ${projectData.genre.includes(genre) ? 'bg-primary text-primary-foreground' : 'border-white/20 hover:bg-white/10'}`} onClick={() => handleGenreToggle(genre)}>{genre}</Badge>
              ))}
            </div>
          </div>
          <div className="space-y-3">
            <Label className="text-foreground flex items-center"><Users className="mr-1 h-4 w-4" />Required Roles</Label>
            <div className="flex flex-wrap gap-2">
              {availableRoles.map((role) => (
                <Badge key={role} variant={projectData.required_roles.includes(role) ? "default" : "outline"} className={`cursor-pointer transition-colors ${projectData.required_roles.includes(role) ? 'bg-secondary text-secondary-foreground' : 'border-white/20 hover:bg-white/10'}`} onClick={() => handleRoleToggle(role)}>{role}</Badge>
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
              <Label htmlFor="budget_min" className="flex items-center"><DollarSign className="mr-1 h-4 w-4" />Minimum Budget</Label>
              <Input id="budget_min" type="number" value={projectData.budget_min} onChange={(e) => setProjectData(prev => ({ ...prev, budget_min: e.target.value }))} placeholder="0" className="bg-input border-border" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="budget_max">Maximum Budget</Label>
              <Input id="budget_max" type="number" value={projectData.budget_max} onChange={(e) => setProjectData(prev => ({ ...prev, budget_max: e.target.value }))} placeholder="0" className="bg-input border-border" />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="start_date" className="flex items-center"><Calendar className="mr-1 h-4 w-4" />Start Date</Label>
              <Input id="start_date" type="date" value={projectData.start_date} onChange={(e) => setProjectData(prev => ({ ...prev, start_date: e.target.value }))} className="bg-input border-border" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="end_date">End Date</Label>
              <Input id="end_date" type="date" value={projectData.end_date} onChange={(e) => setProjectData(prev => ({ ...prev, end_date: e.target.value }))} className="bg-input border-border" />
            </div>
          </div>
        </div>
      )
    }
  ];

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button className="bg-primary hover:bg-primary/90"><Plus className="mr-2 h-4 w-4" />Create Project</Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-background border-border p-4 sm:p-6">
        <DialogHeader className="mb-4">
          <DialogTitle className="text-foreground text-xl sm:text-2xl">Create New Project</DialogTitle>
        </DialogHeader>
        <MultiStepForm steps={steps} onComplete={handleSubmit} className="w-full" />
      </DialogContent>
    </Dialog>
  );
};
