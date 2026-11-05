import { useState, useEffect } from 'react';
import { useRealtimeData } from '@/lib/realtime';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Pencil, Trash2, Film, Loader2, Plus } from 'lucide-react';
import { ProgressBar, WorkspaceEmpty, WorkspaceHero } from './WorkspaceUI';
import { useToast } from '@/hooks/use-toast';
import { useAppRole } from '@/hooks/useAppRole';
import { confirmDialog } from '@/lib/confirmDialog';

interface Shot {
    id: string;
    scene: string;
    shot: string;
    description: string;
    status: string;
    project_id: string;
}

interface ShotListProps {
    project_id: string;
}

const ShotList = ({ project_id }: ShotListProps) => {
    const { isInternal } = useAppRole();
    const { toast } = useToast();
    const { data: rawShots, error: fetchError } = useRealtimeData<Shot>('shot_list', 'project_id', project_id);
    const [shots, setShots] = useState<Shot[]>([]);
    const [loading, setLoading] = useState(true);

    // New shot state
    const [newScene, setNewScene] = useState("1");
    const [newShot, setNewShot] = useState("1");
    const [newDescription, setNewDescription] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Editing state
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editScene, setEditScene] = useState("1");
    const [editShot, setEditShot] = useState("1");
    const [editDescription, setEditDescription] = useState('');
    const [editStatus, setEditStatus] = useState('pending');

    useEffect(() => {
        if (rawShots) {
            const sorted = [...rawShots].sort((a, b) => {
                const scA = parseFloat(a.scene) || 0;
                const scB = parseFloat(b.scene) || 0;
                if (scA !== scB) return scA - scB;
                const shA = parseFloat(a.shot) || 0;
                const shB = parseFloat(b.shot) || 0;
                return shA - shB;
            });
            setShots(sorted);
            setLoading(false);
        }
    }, [rawShots]);

    const handleAddShot = async () => {
        if (newDescription.trim() === '') {
            toast({ title: "Error", description: "Shot description is required", variant: "destructive" });
            return;
        }

        setIsSubmitting(true);
        try {
            const { error: insertError } = await supabase
                .from('shot_list' as any)
                .insert([{
                    scene: newScene,
                    shot: newShot,
                    description: newDescription,
                    project_id: project_id,
                    status: 'pending'
                }]);

            if (insertError) throw insertError;

            toast({ title: "Success", description: "Shot added to the sequence" });
            setNewDescription('');
            // Optional: Increment shot number
            const nextShot = parseInt(newShot);
            if (!isNaN(nextShot)) setNewShot((nextShot + 1).toString());
        } catch (err) {
            toast({ title: "Error", description: "Failed to allocate shot", variant: "destructive" });
        } finally {
            setIsSubmitting(false);
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
        try {
            const { error: updateError } = await supabase
                .from('shot_list' as any)
                .update({
                    scene: editScene,
                    shot: editShot,
                    description: editDescription,
                    status: editStatus
                })
                .eq('id', id);

            if (updateError) throw updateError;
            toast({ title: "Success", description: "Shot details updated" });
            setEditingId(null);
        } catch (err) {
            toast({ title: "Error", description: "Failed to sync updates", variant: "destructive" });
        }
    };

    const handleDelete = async (id: string) => {
        if (!await confirmDialog('Permanently remove this shot from the production?')) return;

        try {
            const { error: deleteError } = await supabase
                .from('shot_list' as any)
                .delete()
                .eq('id', id);

            if (deleteError) throw deleteError;
            toast({ title: "Removed", description: "Shot deleted successfully" });
        } catch (err) {
            toast({ title: "Error", description: "Failed to delete shot", variant: "destructive" });
        }
    };

    const handleStatusChange = async (id: string, newStatus: string) => {
        try {
            const { error: updateError } = await supabase
                .from('shot_list' as any)
                .update({ status: newStatus })
                .eq('id', id);

            if (updateError) throw updateError;
        } catch (err) {
            toast({ title: "Error", description: "Status sync failed", variant: "destructive" });
        }
    };

    if (fetchError) return <div className="p-8 text-destructive bg-red-500/10 rounded-2xl border border-red-500/20 m-4">Error loading shot sequence.</div>;

    return (
        <div className="flex-1 overflow-y-auto overflow-x-hidden w-full bg-transparent px-4 sm:px-6 lg:px-8 py-6 custom-scrollbar pb-24">
            {/* Header section */}
            <div className="max-w-6xl mx-auto mb-6">
                <WorkspaceHero
                    icon={Film}
                    title="Shot list"
                    description="Every shot, scene by scene."
                    stats={[
                        { label: 'Scenes', value: new Set((shots || []).map((x) => x.scene)).size },
                        { label: 'Shots', value: (shots || []).length },
                        { label: 'In progress', value: (shots || []).filter((x) => x.status === 'in-progress').length, tone: 'primary' },
                        { label: 'Completed', value: (shots || []).filter((x) => x.status === 'completed').length, tone: 'success' },
                    ]}
                />
            </div>

            {/* Premium Input Bar */}
            {!isInternal ? (
                <div className="bg-card border border-border p-4 sm:p-5 rounded-2xl mb-8 max-w-6xl mx-auto">
                    <div className="grid grid-cols-2 md:flex md:flex-row gap-4 relative z-10">
                        <div className="space-y-1.5 flex-1 md:w-20 lg:w-28 md:flex-none">
                            <p className="text-xs font-medium text-muted-foreground ml-1">Scene</p>
                            <Input
                                type="text"
                                value={newScene}
                                onChange={(e) => setNewScene(e.target.value)}
                                placeholder="1"
                                className="bg-background/50 border-border rounded-xl h-10 text-center font-bold"
                            />
                        </div>
                        <div className="space-y-1.5 flex-1 md:w-20 lg:w-28 md:flex-none">
                            <p className="text-xs font-medium text-muted-foreground ml-1">Shot</p>
                            <Input
                                type="text"
                                value={newShot}
                                onChange={(e) => setNewShot(e.target.value)}
                                placeholder="1"
                                className="bg-background/50 border-border rounded-xl h-10 text-center font-bold"
                            />
                        </div>
                        
                        <div className="col-span-2 md:flex-grow space-y-1.5">
                            <p className="text-xs font-medium text-muted-foreground ml-1">Description</p>
                            <div className="flex flex-col sm:flex-row gap-3">
                                <Input
                                    type="text"
                                    value={newDescription}
                                    onChange={(e) => setNewDescription(e.target.value)}
                                    placeholder="e.g., Close-up shot with shallow focus..."
                                    className="bg-background/50 border-border rounded-xl h-10 flex-grow focus:border-primary/50"
                                    onKeyPress={(e) => e.key === 'Enter' && handleAddShot()}
                                />
                                <Button 
                                    onClick={handleAddShot} 
                                    disabled={isSubmitting} 
                                    className="w-full sm:w-auto h-10 rounded-xl font-semibold px-6 whitespace-nowrap"
                                >
                                    {isSubmitting ? <Loader2 className="animate-spin" /> : <><Plus className="w-4 h-4 mr-2" />Add Shot</>}
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="mb-8 max-w-6xl mx-auto px-4 py-3 bg-muted/40 border border-border rounded-xl">
                    <p className="text-sm text-muted-foreground">You are viewing in observation mode, so the shot list cannot be changed.</p>
                </div>
            )}

            {/* Shots List Container - Unified scroll */}
            {loading ? (
                <div className="flex flex-col items-center justify-center py-20 opacity-30">
                    <Loader2 className="w-10 h-10 animate-spin mb-4" />
                    <p className="text-sm font-medium">Loading shots</p>
                </div>
            ) : shots && shots.length > 0 ? (
                <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px] items-start max-w-6xl mx-auto">
                    <div className="flex flex-col gap-8 min-w-0">
                    {Array.from(new Set(shots.map(s => s.scene))).map((sceneNumber) => (
                        <section key={`scene-${sceneNumber}`} aria-label={`Scene ${sceneNumber}`}>
                            <div className="mb-3 space-y-2">
                              <div className="flex items-baseline gap-3">
                                <h2 className="text-lg font-semibold text-foreground">Scene {sceneNumber}</h2>
                                <span className="text-sm text-muted-foreground">{shots.filter(x => x.scene === sceneNumber).length === 1 ? '1 shot' : `${shots.filter(x => x.scene === sceneNumber).length} shots`}</span>
                                <span className="ml-auto text-xs text-muted-foreground tabular-nums">{shots.filter(x => x.scene === sceneNumber && x.status === 'completed').length} done</span>
                              </div>
                              <ProgressBar label={`Scene ${sceneNumber} progress`} done={shots.filter(x => x.scene === sceneNumber && x.status === 'completed').length} total={shots.filter(x => x.scene === sceneNumber).length} />
                            </div>

                            <div className="space-y-3">
                                {shots.filter(s => s.scene === sceneNumber).map(shot => (
                                    <div key={shot.id} className="group relative bg-card border border-border rounded-2xl p-4 sm:p-5 transition-colors hover:border-primary/30">
                                        {editingId === shot.id ? (
                                            <div className="space-y-5 relative z-10">
                                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                                    <div className="space-y-1">
                                                        <Label className="text-xs font-medium text-muted-foreground ml-1">Scene</Label>
                                                        <Input value={editScene} onChange={(e) => setEditScene(e.target.value)} className="bg-background border-border h-11 text-center font-bold rounded-xl" />
                                                    </div>
                                                    <div className="space-y-1">
                                                        <Label className="text-xs font-medium text-muted-foreground ml-1">Shot</Label>
                                                        <Input value={editShot} onChange={(e) => setEditShot(e.target.value)} className="bg-background border-border h-11 text-center font-bold rounded-xl" />
                                                    </div>
                                                    <div className="col-span-2 space-y-1">
                                                        <Label className="text-xs font-medium text-muted-foreground ml-1">Status</Label>
                                                        <Select value={editStatus} onValueChange={setEditStatus}>
                                                            <SelectTrigger className="bg-background border-border h-11 rounded-xl">
                                                                <SelectValue />
                                                            </SelectTrigger>
                                                            <SelectContent className="bg-popover border-border">
                                                                <SelectItem value="pending">Pending</SelectItem>
                                                                <SelectItem value="in-progress">In Progress</SelectItem>
                                                                <SelectItem value="completed">Completed</SelectItem>
                                                            </SelectContent>
                                                        </Select>
                                                    </div>
                                                </div>
                                                <div className="space-y-1">
                                                    <Label className="text-xs font-medium text-muted-foreground ml-1">Composition Description</Label>
                                                    <Input value={editDescription} onChange={(e) => setEditDescription(e.target.value)} className="bg-background border-border h-11 rounded-xl" />
                                                </div>
                                                <div className="flex gap-3 pt-1">
                                                    <Button onClick={() => handleSaveEdit(shot.id)} className="flex-1 bg-primary font-bold h-11 rounded-xl">Apply Changes</Button>
                                                    <Button variant="ghost" onClick={() => setEditingId(null)} className="h-11 px-5 rounded-xl text-muted-foreground">Cancel</Button>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="flex flex-col gap-3 relative z-10">
                                                {/* Top row: shot badge + status + actions */}
                                                <div className="flex items-center justify-between gap-2 flex-wrap">
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        {/* Shot number badge */}
                                                        <div className="flex items-center gap-1.5 bg-muted rounded-lg px-2.5 py-1 shrink-0">
                                                            <p className="text-xs font-medium text-muted-foreground">Shot</p>
                                                            <p className="text-base font-semibold text-foreground leading-none">{shot.shot}</p>
                                                        </div>

                                                        {/* Status badge */}
                                                        <span className={`text-xs font-medium px-2.5 py-1 rounded-full shrink-0 capitalize ${
                                                            shot.status === 'completed' ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' :
                                                            shot.status === 'in-progress' ? 'bg-primary/10 text-primary' :
                                                            'bg-muted text-muted-foreground'
                                                        }`}>
                                                            {shot.status.replace('-', ' ')}
                                                        </span>

                                                    </div>

                                                    {/* Action buttons */}
                                                    {!isInternal && (
                                                        <div className="flex shrink-0">
                                                            <Button aria-label="Edit shot" size="icon" variant="ghost" className="h-9 w-9 text-muted-foreground hover:text-primary rounded-full" onClick={() => handleEdit(shot)}>
                                                                <Pencil className="h-3.5 w-3.5" />
                                                            </Button>
                                                            <Button aria-label="Delete shot" size="icon" variant="ghost" className="h-9 w-9 text-muted-foreground hover:text-destructive rounded-full" onClick={() => handleDelete(shot.id)}>
                                                                <Trash2 className="h-3.5 w-3.5" />
                                                            </Button>
                                                        </div>
                                                    )}
                                                </div>
                                                
                                                {/* Description */}
                                                <p className="text-base text-foreground leading-relaxed break-words">{shot.description}</p>

                                                {/* Status changer */}
                                                <div>
                                                    <Select value={shot.status} onValueChange={(value) => handleStatusChange(shot.id, value)} disabled={isInternal}>
                                                        <SelectTrigger className={`w-full sm:w-44 h-9 text-sm bg-background border-border rounded-xl ${isInternal ? 'cursor-default' : ''}`}>
                                                            <SelectValue />
                                                        </SelectTrigger>
                                                        <SelectContent className="bg-popover border-border rounded-2xl">
                                                            <SelectItem value="pending">Pending</SelectItem>
                                                            <SelectItem value="in-progress">In Progress</SelectItem>
                                                            <SelectItem value="completed">Completed</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </section>
                    ))}
                    </div>
                    <aside className="space-y-4 lg:sticky lg:top-0">
                        <div className="rounded-2xl border border-border bg-card p-5">
                            <h2 className="text-sm font-semibold mb-4">Status</h2>
                            {(['completed', 'in-progress', 'pending'] as const).map((st) => {
                                const n = shots.filter((x) => (st === 'pending' ? x.status !== 'completed' && x.status !== 'in-progress' : x.status === st)).length;
                                const label = st === 'completed' ? 'Completed' : st === 'in-progress' ? 'In progress' : 'To shoot';
                                const bar = st === 'completed' ? 'bg-emerald-500' : st === 'in-progress' ? 'bg-primary' : 'bg-muted-foreground/40';
                                return (
                                    <div key={st} className="mb-3 last:mb-0">
                                        <div className="flex justify-between text-sm mb-1.5"><span className="text-muted-foreground">{label}</span><span className="font-medium tabular-nums">{n}</span></div>
                                        <div className="h-2 rounded-full bg-muted overflow-hidden"><div className={`h-full rounded-full ${bar} transition-[width] duration-500`} style={{ width: `${shots.length ? (n / shots.length) * 100 : 0}%` }} /></div>
                                    </div>
                                );
                            })}
                        </div>
                        <div className="rounded-2xl border border-border bg-card p-5">
                            <h2 className="text-sm font-semibold mb-3">Scenes</h2>
                            <ul className="space-y-1.5">
                                {Array.from(new Set(shots.map((x) => x.scene))).map((sc) => (
                                    <li key={`nav-${sc}`} className="flex items-center justify-between text-sm rounded-lg px-3 py-2 bg-muted/40">
                                        <span className="font-medium">Scene {sc}</span>
                                        <span className="text-muted-foreground tabular-nums">{shots.filter((x) => x.scene === sc && x.status === 'completed').length}/{shots.filter((x) => x.scene === sc).length}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </aside>
                </div>
            ) : (
                <WorkspaceEmpty icon={Film} title="No shots yet" description="Add the first shot above to start your shot list." />
            )}
        </div>
    );
};

export default ShotList;

