
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Loader2, Save, Trash2 } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { useNavigate } from 'react-router-dom';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

interface ProjectSettingsProps {
    projectId: string;
}

const ProjectSettings = ({ projectId }: ProjectSettingsProps) => {
    const { toast } = useToast();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [status, setStatus] = useState<string>('active');
    const [location, setLocation] = useState('');
    const [genre, setGenre] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [budgetMin, setBudgetMin] = useState('');
    const [budgetMax, setBudgetMax] = useState('');
    const [isPublic, setIsPublic] = useState(false);

    useEffect(() => {
        fetchProjectDetails();
    }, [projectId]);

    const fetchProjectDetails = async () => {
        try {
            const { data, error } = await supabase
                .from('projects')
                .select('*')
                .eq('id', projectId)
                .single();

            if (error) throw error;

            if (data) {
                setTitle(data.title);
                setDescription(data.description || '');
                setStatus(data.status || 'active');
                setLocation(data.location || '');
                setGenre(data.genre ? data.genre.join(', ') : '');
                setStartDate(data.start_date || '');
                setEndDate(data.end_date || '');
                setBudgetMin(data.budget_min?.toString() || '');
                setBudgetMax(data.budget_max?.toString() || '');
                setIsPublic(data.is_public || false);
            }
        } catch (error: any) {
            console.error('Error fetching project settings:', error);
            toast({
                title: "Error",
                description: "Failed to load project settings",
                variant: "destructive"
            });
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const { error } = await supabase
                .from('projects')
                .update({
                    title,
                    description,
                    status,
                    location,
                    genre: genre.split(',').map(g => g.trim()).filter(g => g),
                    start_date: startDate || null,
                    end_date: endDate || null,
                    budget_min: budgetMin ? parseFloat(budgetMin) : null,
                    budget_max: budgetMax ? parseFloat(budgetMax) : null,
                    is_public: isPublic,
                    updated_at: new Date().toISOString()
                })
                .eq('id', projectId);

            if (error) throw error;

            toast({
                title: "Success",
                description: "Project settings updated successfully",
            });
        } catch (error: any) {
            console.error('Error updating project:', error);
            toast({
                title: "Error",
                description: "Failed to update project settings",
                variant: "destructive"
            });
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async () => {
        setDeleting(true);
        try {
            const { error } = await supabase
                .from('projects')
                .delete()
                .eq('id', projectId);

            if (error) throw error;

            toast({
                title: "Project Deleted",
                description: "The project has been permanently deleted.",
            });
            navigate('/projects');
        } catch (error: any) {
            console.error('Error deleting project:', error);
            toast({
                title: "Error",
                description: "Failed to delete project",
                variant: "destructive"
            });
            setDeleting(false);
        }
    };

    if (loading) {
        return <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
    }

    return (
        <div className="max-w-4xl mx-auto p-6 space-y-8 h-full overflow-y-auto custom-scrollbar">
            <div className="space-y-2">
                <h2 className="text-2xl font-bold tracking-tight">Project Settings</h2>
                <p className="text-muted-foreground">Manage your project details and preferences.</p>
            </div>

            <div className="grid gap-6">
                {/* General Information */}
                <Card>
                    <CardHeader>
                        <CardTitle>General Information</CardTitle>
                        <CardDescription>Update the basic details of your project.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="title">Project Title</Label>
                                <Input
                                    id="title"
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                    placeholder="Enter project title"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="location">Location</Label>
                                <Input
                                    id="location"
                                    value={location}
                                    onChange={(e) => setLocation(e.target.value)}
                                    placeholder="e.g. Los Angeles, CA"
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="description">Description</Label>
                            <Textarea
                                id="description"
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                placeholder="Enter project description"
                                rows={4}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="genre">Genre (comma separated)</Label>
                            <Input
                                id="genre"
                                value={genre}
                                onChange={(e) => setGenre(e.target.value)}
                                placeholder="e.g. Drama, Thriller, Sci-Fi"
                            />
                        </div>
                    </CardContent>
                </Card>

                {/* Schedule & Budget */}
                <Card>
                    <CardHeader>
                        <CardTitle>Schedule & Budget</CardTitle>
                        <CardDescription>Manage timeline and financial details.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="startDate">Start Date</Label>
                                <Input
                                    id="startDate"
                                    type="date"
                                    value={startDate}
                                    onChange={(e) => setStartDate(e.target.value)}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="endDate">End Date</Label>
                                <Input
                                    id="endDate"
                                    type="date"
                                    value={endDate}
                                    onChange={(e) => setEndDate(e.target.value)}
                                />
                            </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="budgetMin">Min Budget</Label>
                                <Input
                                    id="budgetMin"
                                    type="number"
                                    value={budgetMin}
                                    onChange={(e) => setBudgetMin(e.target.value)}
                                    placeholder="0"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="budgetMax">Max Budget</Label>
                                <Input
                                    id="budgetMax"
                                    type="number"
                                    value={budgetMax}
                                    onChange={(e) => setBudgetMax(e.target.value)}
                                    placeholder="0"
                                />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Status & Visibility */}
                <Card>
                    <CardHeader>
                        <CardTitle>Status & Visibility</CardTitle>
                        <CardDescription>Control project state and public access.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="status">Project Status</Label>
                                <Select value={status} onValueChange={setStatus}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select status" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="active">Active</SelectItem>
                                        <SelectItem value="completed">Completed</SelectItem>
                                        <SelectItem value="archived">Archived</SelectItem>
                                        <SelectItem value="on_hold">On Hold</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="flex items-center justify-between p-4 border rounded-lg">
                                <div className="space-y-0.5">
                                    <Label className="text-base">Public Project</Label>
                                    <p className="text-sm text-muted-foreground">
                                        Make this project visible to everyone.
                                    </p>
                                </div>
                                <Switch
                                    checked={isPublic}
                                    onCheckedChange={setIsPublic}
                                />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <div className="flex justify-end">
                    <Button onClick={handleSave} disabled={saving} className="gap-2 w-full md:w-auto">
                        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                        Save Changes
                    </Button>
                </div>

                {/* Danger Zone */}
                <Card className="border-destructive/50">
                    <CardHeader>
                        <CardTitle className="text-destructive">Danger Zone</CardTitle>
                        <CardDescription>Irreversible actions for this project.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-center justify-between p-4 border border-destructive/20 rounded-lg bg-destructive/5">
                            <div>
                                <h4 className="font-medium text-destructive">Delete Project</h4>
                                <p className="text-sm text-muted-foreground">
                                    Permanently delete this project and all its data.
                                </p>
                            </div>

                            <AlertDialog>
                                <AlertDialogTrigger asChild>
                                    <Button variant="destructive" className="gap-2" disabled={deleting}>
                                        {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                                        Delete Project
                                    </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                    <AlertDialogHeader>
                                        <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                                        <AlertDialogDescription>
                                            This action cannot be undone. This will permanently delete the project
                                            "{title}" and remove all associated data, including tasks, files, and discussions.
                                        </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                        <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                            Delete Project
                                        </AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
};

export default ProjectSettings;
