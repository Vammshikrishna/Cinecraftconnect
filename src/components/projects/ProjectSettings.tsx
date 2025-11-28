import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Globe, Lock, X } from 'lucide-react';
import { Separator } from '@/components/ui/separator';

interface ProjectSettingsProps {
    projectId: string;
}

const PROJECT_STATUSES = ['planning', 'in-production', 'post-production', 'completed', 'on-hold'];

const AVAILABLE_GENRES = [
    'Action', 'Drama', 'Comedy', 'Thriller', 'Horror', 'Sci-Fi', 'Romance',
    'Documentary', 'Animation', 'Fantasy', 'Mystery', 'Adventure', 'Musical'
];

const AVAILABLE_ROLES = [
    'Director', 'Producer', 'Cinematographer', 'Editor', 'Sound Designer',
    'Production Designer', 'Costume Designer', 'Makeup Artist', 'Actor',
    'Screenwriter', 'Composer', 'VFX Artist', 'Gaffer', 'Script Supervisor'
];

export default function ProjectSettings({ projectId }: ProjectSettingsProps) {
    const { toast } = useToast();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [projectData, setProjectData] = useState({
        name: '',
        description: '',
        status: 'planning',
        location: '',
        budget_min: '',
        budget_max: '',
        start_date: '',
        end_date: '',
        genre: [] as string[],
        required_roles: [] as string[],
        project_space_type: 'public' as 'public' | 'private',
    });

    useEffect(() => {
        fetchProjectData();
    }, [projectId]);

    const fetchProjectData = async () => {
        try {
            const { data, error } = await supabase
                .from('project_spaces')
                .select('*')
                .eq('id', projectId)
                .single();

            if (error) throw error;

            if (data) {
                setProjectData({
                    name: data.name || '',
                    description: data.description || '',
                    status: data.status || 'planning',
                    location: data.location || '',
                    budget_min: data.budget_min?.toString() || '',
                    budget_max: data.budget_max?.toString() || '',
                    start_date: data.start_date || '',
                    end_date: data.end_date || '',
                    genre: data.genre || [],
                    required_roles: data.required_roles || [],
                    project_space_type: (data.project_space_type as 'public' | 'private') || 'public',
                });
            }
        } catch (error: any) {
            toast({
                title: 'Error',
                description: 'Failed to load project settings',
                variant: 'destructive',
            });
        } finally {
            setLoading(false);
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

    const handleSave = async () => {
        setSaving(true);
        try {
            const { error } = await supabase
                .from('project_spaces')
                .update({
                    name: projectData.name,
                    description: projectData.description,
                    status: projectData.status,
                    location: projectData.location,
                    budget_min: projectData.budget_min ? parseInt(projectData.budget_min) : null,
                    budget_max: projectData.budget_max ? parseInt(projectData.budget_max) : null,
                    start_date: projectData.start_date || null,
                    end_date: projectData.end_date || null,
                    genre: projectData.genre,
                    required_roles: projectData.required_roles,
                    project_space_type: projectData.project_space_type,
                })
                .eq('id', projectId);

            if (error) throw error;

            toast({
                title: 'Success',
                description: 'Project settings updated successfully',
            });
        } catch (error: any) {
            toast({
                title: 'Error',
                description: error.message || 'Failed to update project settings',
                variant: 'destructive',
            });
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="h-full overflow-y-auto">
            <div className="max-w-4xl mx-auto p-6 space-y-8 pb-24">
                <div>
                    <h2 className="text-2xl font-bold text-foreground mb-2">Project Settings</h2>
                    <p className="text-sm text-muted-foreground">Manage your project details and configuration</p>
                </div>

                {/* Basic Information */}
                <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-foreground">Basic Information</h3>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2 md:col-span-2">
                            <Label htmlFor="name">Project Name *</Label>
                            <Input
                                id="name"
                                value={projectData.name}
                                onChange={(e) => setProjectData({ ...projectData, name: e.target.value })}
                                placeholder="Enter project name"
                            />
                        </div>

                        <div className="space-y-2 md:col-span-2">
                            <Label htmlFor="description">Description</Label>
                            <Textarea
                                id="description"
                                value={projectData.description}
                                onChange={(e) => setProjectData({ ...projectData, description: e.target.value })}
                                placeholder="Enter project description"
                                rows={4}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="status">Project Status</Label>
                            <Select
                                value={projectData.status}
                                onValueChange={(value) => setProjectData({ ...projectData, status: value })}
                            >
                                <SelectTrigger id="status">
                                    <SelectValue placeholder="Select status" />
                                </SelectTrigger>
                                <SelectContent>
                                    {PROJECT_STATUSES.map((status) => (
                                        <SelectItem key={status} value={status} className="capitalize">
                                            {status.replace('-', ' ')}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="location">Location</Label>
                            <Input
                                id="location"
                                value={projectData.location}
                                onChange={(e) => setProjectData({ ...projectData, location: e.target.value })}
                                placeholder="Enter filming location"
                            />
                        </div>
                    </div>
                </div>

                <Separator />

                {/* Budget & Timeline */}
                <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-foreground">Budget & Timeline</h3>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="budget_min">Minimum Budget</Label>
                            <Input
                                id="budget_min"
                                type="number"
                                value={projectData.budget_min}
                                onChange={(e) => setProjectData({ ...projectData, budget_min: e.target.value })}
                                placeholder="0"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="budget_max">Maximum Budget</Label>
                            <Input
                                id="budget_max"
                                type="number"
                                value={projectData.budget_max}
                                onChange={(e) => setProjectData({ ...projectData, budget_max: e.target.value })}
                                placeholder="0"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="start_date">Start Date</Label>
                            <Input
                                id="start_date"
                                type="date"
                                value={projectData.start_date}
                                onChange={(e) => setProjectData({ ...projectData, start_date: e.target.value })}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="end_date">End Date</Label>
                            <Input
                                id="end_date"
                                type="date"
                                value={projectData.end_date}
                                onChange={(e) => setProjectData({ ...projectData, end_date: e.target.value })}
                            />
                        </div>
                    </div>
                </div>

                <Separator />

                {/* Genres */}
                <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-foreground">Project Genres</h3>
                    <div className="flex flex-wrap gap-2">
                        {AVAILABLE_GENRES.map((genre) => (
                            <Badge
                                key={genre}
                                variant={projectData.genre.includes(genre) ? "default" : "outline"}
                                className="cursor-pointer transition-colors hover:bg-primary/80"
                                onClick={() => handleGenreToggle(genre)}
                            >
                                {genre}
                                {projectData.genre.includes(genre) && <X className="ml-1 h-3 w-3" />}
                            </Badge>
                        ))}
                    </div>
                </div>

                <Separator />

                {/* Required Roles */}
                <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-foreground">Required Roles</h3>
                    <div className="flex flex-wrap gap-2">
                        {AVAILABLE_ROLES.map((role) => (
                            <Badge
                                key={role}
                                variant={projectData.required_roles.includes(role) ? "secondary" : "outline"}
                                className="cursor-pointer transition-colors hover:bg-secondary/80"
                                onClick={() => handleRoleToggle(role)}
                            >
                                {role}
                                {projectData.required_roles.includes(role) && <X className="ml-1 h-3 w-3" />}
                            </Badge>
                        ))}
                    </div>
                </div>

                <Separator />

                {/* Project Visibility */}
                <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-foreground">Project Visibility</h3>
                    <div className="flex items-center justify-between p-4 border border-border rounded-lg bg-muted/20">
                        <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                                {projectData.project_space_type === 'public' ? (
                                    <Globe className="h-4 w-4 text-primary" />
                                ) : (
                                    <Lock className="h-4 w-4 text-muted-foreground" />
                                )}
                                <p className="font-medium">
                                    {projectData.project_space_type === 'public' ? 'Public Project' : 'Private Project'}
                                </p>
                            </div>
                            <p className="text-sm text-muted-foreground">
                                {projectData.project_space_type === 'public'
                                    ? 'Visible to everyone. Anyone can view and apply to join.'
                                    : 'Only visible to invited members. Others cannot see this project.'}
                            </p>
                        </div>
                        <Switch
                            checked={projectData.project_space_type === 'public'}
                            onCheckedChange={(checked) =>
                                setProjectData({ ...projectData, project_space_type: checked ? 'public' : 'private' })
                            }
                        />
                    </div>
                </div>

                {/* Save Button */}
                <div className="flex justify-end pt-4">
                    <Button onClick={handleSave} disabled={saving} size="lg">
                        {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        {saving ? 'Saving Changes...' : 'Save Changes'}
                    </Button>
                </div>
            </div>
        </div>
    );
}
