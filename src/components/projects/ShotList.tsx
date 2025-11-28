import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Pencil, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Shot {
    id: string;
    scene: number;
    shot: number;
    description: string;
    status: string;
    notes: string | null;
    project_id: string;
}

interface ShotListProps {
    project_id: string;
}

const ShotList = ({ project_id }: ShotListProps) => {
    const { toast } = useToast();
    const [shots, setShots] = useState<Shot[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);

    // New shot state
    const [newScene, setNewScene] = useState(1);
    const [newShot, setNewShot] = useState(1);
    const [newDescription, setNewDescription] = useState('');

    // Editing state
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editScene, setEditScene] = useState(1);
    const [editShot, setEditShot] = useState(1);
    const [editDescription, setEditDescription] = useState('');
    const [editStatus, setEditStatus] = useState('pending');

    useEffect(() => {
        fetchShots();

        const channel = supabase
            .channel('shot-list-changes')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'shot_list',
                    filter: `project_id=eq.${project_id}`
                },
                () => {
                    fetchShots();
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [project_id]);

    const fetchShots = async () => {
        try {
            const { data, error } = await supabase
                .from('shot_list')
                .select('*')
                .eq('project_id', project_id)
                .order('scene', { ascending: true })
                .order('shot', { ascending: true });

            if (error) throw error;
            setShots(data as Shot[]);
        } catch (err) {
            setError(err as Error);
            console.error('Error fetching shots:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleAddShot = async () => {
        if (newDescription.trim() === '') {
            toast({ title: "Error", description: "Description is required", variant: "destructive" });
            return;
        }

        const { error: insertError } = await supabase
            .from('shot_list')
            .insert([{
                scene: newScene,
                shot: newShot,
                description: newDescription,
                project_id: project_id,
                status: 'pending'
            }]);

        if (insertError) {
            console.error('Error adding shot:', insertError);
            toast({ title: "Error", description: "Failed to add shot", variant: "destructive" });
        } else {
            toast({ title: "Success", description: "Shot added successfully" });
            setNewDescription('');
            setNewShot(prev => prev + 1);
        }
    };

    const handleEdit = (shot: Shot) => {
        setEditingId(shot.id);
        setEditScene(shot.scene);
        setEditShot(shot.shot);
        setEditDescription(shot.description);
        setEditStatus(shot.status);
    };

    const handleSaveEdit = async (id: string) => {
        const { error: updateError } = await supabase
            .from('shot_list')
            .update({
                scene: editScene,
                shot: editShot,
                description: editDescription,
                status: editStatus
            })
            .eq('id', id);

        if (updateError) {
            toast({ title: "Error", description: "Failed to update shot", variant: "destructive" });
        } else {
            toast({ title: "Success", description: "Shot updated successfully" });
            setEditingId(null);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this shot?')) return;

        const { error: deleteError } = await supabase
            .from('shot_list')
            .delete()
            .eq('id', id);

        if (deleteError) {
            toast({ title: "Error", description: "Failed to delete shot", variant: "destructive" });
        } else {
            toast({ title: "Success", description: "Shot deleted successfully" });
        }
    };

    const handleStatusChange = async (id: string, newStatus: string) => {
        const { error: updateError } = await supabase
            .from('shot_list')
            .update({ status: newStatus })
            .eq('id', id);

        if (updateError) {
            toast({ title: "Error", description: "Failed to update status", variant: "destructive" });
        }
    };

    if (loading) return <div>Loading shots...</div>;
    if (error) return <div className="p-8 text-destructive">Error loading shot list: {error.message}</div>;

    return (
        <div className="p-4 sm:p-8 flex flex-col h-full">
            <h1 className="text-xl sm:text-2xl font-bold mb-4 sm:mb-6">Shot List</h1>
            <div className="flex flex-col sm:flex-row gap-4 mb-6 items-start sm:items-center bg-card/50 p-4 rounded-lg">
                <div className="flex gap-2 w-full sm:w-auto">
                    <Input
                        type="number"
                        value={newScene}
                        onChange={(e) => setNewScene(parseInt(e.target.value) || 1)}
                        placeholder="Scene"
                        className="w-20 sm:w-24"
                    />
                    <Input
                        type="number"
                        value={newShot}
                        onChange={(e) => setNewShot(parseInt(e.target.value) || 1)}
                        placeholder="Shot"
                        className="w-20 sm:w-24"
                    />
                </div>
                <Input
                    type="text"
                    value={newDescription}
                    onChange={(e) => setNewDescription(e.target.value)}
                    placeholder="Description of the shot..."
                    className="flex-grow w-full"
                />
                <Button onClick={handleAddShot} className="w-full sm:w-auto">Add Shot</Button>
            </div>

            <div className="flex-grow overflow-y-auto">
                {/* Desktop Table View */}
                <table className="w-full border-collapse table-fixed hidden md:table">
                    <thead className="sticky top-0 bg-background z-10">
                        <tr className="border-b border-border">
                            <th className="p-3 text-left w-20 font-semibold">Scene</th>
                            <th className="p-3 text-left w-20 font-semibold">Shot</th>
                            <th className="p-3 text-left font-semibold">Description</th>
                            <th className="p-3 text-left w-32 font-semibold">Status</th>
                            <th className="p-3 text-left w-24 font-semibold">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {shots && shots.length > 0 ? (
                            shots.map(shot => (
                                <tr key={shot.id} className="border-b border-border/50 hover:bg-muted/50">
                                    {editingId === shot.id ? (
                                        <>
                                            <td className="p-3">
                                                <Input
                                                    type="number"
                                                    value={editScene}
                                                    onChange={(e) => setEditScene(parseInt(e.target.value) || 1)}
                                                    className="w-16"
                                                />
                                            </td>
                                            <td className="p-3">
                                                <Input
                                                    type="number"
                                                    value={editShot}
                                                    onChange={(e) => setEditShot(parseInt(e.target.value) || 1)}
                                                    className="w-16"
                                                />
                                            </td>
                                            <td className="p-3">
                                                <Input
                                                    value={editDescription}
                                                    onChange={(e) => setEditDescription(e.target.value)}
                                                />
                                            </td>
                                            <td className="p-3">
                                                <Select value={editStatus} onValueChange={setEditStatus}>
                                                    <SelectTrigger className="w-full">
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="pending">Pending</SelectItem>
                                                        <SelectItem value="in-progress">In Progress</SelectItem>
                                                        <SelectItem value="completed">Completed</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </td>
                                            <td className="p-3">
                                                <div className="flex gap-2">
                                                    <Button size="sm" onClick={() => handleSaveEdit(shot.id)}>Save</Button>
                                                    <Button size="sm" variant="outline" onClick={() => setEditingId(null)}>Cancel</Button>
                                                </div>
                                            </td>
                                        </>
                                    ) : (
                                        <>
                                            <td className="p-3">{shot.scene}</td>
                                            <td className="p-3">{shot.shot}</td>
                                            <td className="p-3 break-words">{shot.description}</td>
                                            <td className="p-3">
                                                <Select value={shot.status} onValueChange={(value) => handleStatusChange(shot.id, value)}>
                                                    <SelectTrigger className="w-full">
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="pending">Pending</SelectItem>
                                                        <SelectItem value="in-progress">In Progress</SelectItem>
                                                        <SelectItem value="completed">Completed</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </td>
                                            <td className="p-3">
                                                <div className="flex gap-2">
                                                    <Button size="sm" variant="ghost" onClick={() => handleEdit(shot)}>
                                                        <Pencil className="h-4 w-4" />
                                                    </Button>
                                                    <Button size="sm" variant="ghost" onClick={() => handleDelete(shot.id)}>
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            </td>
                                        </>
                                    )}
                                </tr>
                            ))
                        ) : (
                            <tr>
                                <td colSpan={5} className="p-8 text-center text-muted-foreground">
                                    No shots have been added yet.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>

                {/* Mobile Card View */}
                <div className="md:hidden space-y-4">
                    {shots && shots.length > 0 ? (
                        shots.map(shot => (
                            <div key={shot.id} className="bg-card border border-border/50 rounded-lg p-4 space-y-3">
                                {editingId === shot.id ? (
                                    <div className="space-y-3">
                                        <div className="flex gap-2">
                                            <div className="w-1/2">
                                                <label className="text-xs text-muted-foreground">Scene</label>
                                                <Input
                                                    type="number"
                                                    value={editScene}
                                                    onChange={(e) => setEditScene(parseInt(e.target.value) || 1)}
                                                />
                                            </div>
                                            <div className="w-1/2">
                                                <label className="text-xs text-muted-foreground">Shot</label>
                                                <Input
                                                    type="number"
                                                    value={editShot}
                                                    onChange={(e) => setEditShot(parseInt(e.target.value) || 1)}
                                                />
                                            </div>
                                        </div>
                                        <div>
                                            <label className="text-xs text-muted-foreground">Description</label>
                                            <Input
                                                value={editDescription}
                                                onChange={(e) => setEditDescription(e.target.value)}
                                            />
                                        </div>
                                        <div>
                                            <label className="text-xs text-muted-foreground">Status</label>
                                            <Select value={editStatus} onValueChange={setEditStatus}>
                                                <SelectTrigger className="w-full">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="pending">Pending</SelectItem>
                                                    <SelectItem value="in-progress">In Progress</SelectItem>
                                                    <SelectItem value="completed">Completed</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="flex gap-2 pt-2">
                                            <Button size="sm" onClick={() => handleSaveEdit(shot.id)} className="flex-1">Save</Button>
                                            <Button size="sm" variant="outline" onClick={() => setEditingId(null)} className="flex-1">Cancel</Button>
                                        </div>
                                    </div>
                                ) : (
                                    <>
                                        <div className="flex justify-between items-start">
                                            <div className="flex gap-3">
                                                <div className="bg-primary/10 text-primary px-2 py-1 rounded text-sm font-medium">
                                                    Sc {shot.scene}
                                                </div>
                                                <div className="bg-secondary text-secondary-foreground px-2 py-1 rounded text-sm font-medium">
                                                    Sh {shot.shot}
                                                </div>
                                            </div>
                                            <div className="flex gap-1">
                                                <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => handleEdit(shot)}>
                                                    <Pencil className="h-4 w-4" />
                                                </Button>
                                                <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => handleDelete(shot.id)}>
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </div>
                                        <p className="text-sm">{shot.description}</p>
                                        <div className="pt-2 border-t border-border/50">
                                            <Select value={shot.status} onValueChange={(value) => handleStatusChange(shot.id, value)}>
                                                <SelectTrigger className="w-full h-8 text-xs">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="pending">Pending</SelectItem>
                                                    <SelectItem value="in-progress">In Progress</SelectItem>
                                                    <SelectItem value="completed">Completed</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </>
                                )}
                            </div>
                        ))
                    ) : (
                        <div className="p-8 text-center text-muted-foreground bg-card/30 rounded-lg border border-dashed border-border">
                            No shots have been added yet.
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ShotList;
