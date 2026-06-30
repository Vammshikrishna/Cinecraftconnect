import { useState, useEffect } from 'react';
import { useRealtimeData } from '@/lib/realtime';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Pencil, Trash2, Film, Loader2, Plus } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAppRole } from '@/hooks/useAppRole';

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
        if (!confirm('Permanently remove this shot from the production?')) return;

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
        <div className="flex-1 overflow-y-auto overflow-x-hidden w-full bg-transparent p-4 sm:p-8 custom-scrollbar pb-64 snap-y snap-proximity">
            {/* Header section */}
            <div className="flex flex-col gap-1 mb-8 snap-start">
                <h1 className="text-xs font-bold tracking-[0.2em] text-primary uppercase">Directing</h1>
                <p className="text-2xl font-bold text-foreground text-gradient">Shot List</p>
            </div>

            {/* Premium Input Bar */}
            {!isInternal ? (
                <div className="bg-card border border-border shadow-2xl p-4 sm:p-6 rounded-[28px] sm:rounded-[32px] mb-8 relative group snap-start">
                    <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none rounded-[32px]" />
                    
                    <div className="grid grid-cols-2 md:flex md:flex-row gap-4 relative z-10">
                        <div className="space-y-1.5 flex-1 md:w-20 lg:w-28 md:flex-none">
                            <p className="text-[9px] font-black text-primary uppercase tracking-[0.2em] ml-1">Scene</p>
                            <Input
                                type="text"
                                value={newScene}
                                onChange={(e) => setNewScene(e.target.value)}
                                placeholder="1"
                                className="bg-background/50 border-border rounded-xl h-11 sm:h-12 text-center font-bold"
                            />
                        </div>
                        <div className="space-y-1.5 flex-1 md:w-20 lg:w-28 md:flex-none">
                            <p className="text-[9px] font-black text-primary uppercase tracking-[0.2em] ml-1">Shot</p>
                            <Input
                                type="text"
                                value={newShot}
                                onChange={(e) => setNewShot(e.target.value)}
                                placeholder="1"
                                className="bg-background/50 border-border rounded-xl h-11 sm:h-12 text-center font-bold"
                            />
                        </div>
                        
                        <div className="col-span-2 md:flex-grow space-y-1.5">
                            <p className="text-[9px] font-black text-primary uppercase tracking-[0.2em] ml-1">Composition Description</p>
                            <div className="flex flex-col sm:flex-row gap-3">
                                <Input
                                    type="text"
                                    value={newDescription}
                                    onChange={(e) => setNewDescription(e.target.value)}
                                    placeholder="e.g., Close-up shot with shallow focus..."
                                    className="bg-background/50 border-border rounded-xl h-11 sm:h-12 flex-grow focus:border-primary/50"
                                    onKeyPress={(e) => e.key === 'Enter' && handleAddShot()}
                                />
                                <Button 
                                    onClick={handleAddShot} 
                                    disabled={isSubmitting} 
                                    className="w-full sm:w-auto bg-primary hover:bg-primary/80 h-11 sm:h-12 rounded-xl font-bold px-8 shadow-lg shadow-primary/20 whitespace-nowrap active:scale-95 transition-all"
                                >
                                    {isSubmitting ? <Loader2 className="animate-spin" /> : <><Plus className="w-4 h-4 mr-2" />Add Shot</>}
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="mb-8 p-4 bg-muted/30 border border-border/50 rounded-3xl text-center">
                    <p className="text-sm text-muted-foreground italic font-medium">Internal staff are in observation mode and cannot modify the shot sequence.</p>
                </div>
            )}

            {/* Shots List Container - Unified scroll */}
            {loading ? (
                <div className="flex flex-col items-center justify-center py-20 opacity-30">
                    <Loader2 className="w-10 h-10 animate-spin mb-4" />
                    <p className="text-sm font-bold tracking-widest uppercase">Initializing Sequence...</p>
                </div>
            ) : shots && shots.length > 0 ? (
                <div className="flex flex-col gap-12 max-w-4xl mx-auto">
                    {Array.from(new Set(shots.map(s => s.scene))).map((sceneNumber) => (
                        <div key={`scene-${sceneNumber}`} className="relative pl-5 sm:pl-16 border-l-[3px] border-primary/20 last:border-l-0 pb-8 snap-start">
                            <div className="absolute top-0 left-[-12px] w-[21px] h-[21px] bg-primary rounded-full border-4 border-background shadow-lg shadow-primary/40 z-20" />
                            
                            {/* Scene Header */}
                            <div className="relative mb-6 flex items-end gap-3 z-10 p-3 rounded-2xl -ml-3">
                                <div className="space-y-0.5 min-w-0">
                                    <p className="text-[10px] font-black tracking-[0.4em] text-primary uppercase ml-1 opacity-60">Production Block</p>
                                    <h2 className="text-2xl sm:text-5xl font-black text-foreground tracking-tighter">SCENE {sceneNumber}</h2>
                                </div>
                                <div className="h-px flex-grow bg-primary/10 mb-3 ml-2 shrink" />
                            </div>

                            <div className="space-y-4 sm:space-y-6">
                                {shots.filter(s => s.scene === sceneNumber).map(shot => (
                                    <div key={shot.id} className="group relative bg-card/60 border border-border rounded-[20px] sm:rounded-[32px] p-4 sm:p-8 hover:bg-accent/40 active:scale-[0.99] transition-all duration-500 shadow-xl backdrop-blur-xl overflow-hidden">
                                        <div className="absolute -top-12 -right-12 w-48 h-48 bg-primary/5 blur-3xl rounded-full group-hover:bg-primary/10 transition-all pointer-events-none" />

                                        {editingId === shot.id ? (
                                            <div className="space-y-5 relative z-10">
                                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                                    <div className="space-y-1">
                                                        <Label className="text-[9px] font-black text-primary uppercase tracking-widest ml-1">Scene</Label>
                                                        <Input value={editScene} onChange={(e) => setEditScene(e.target.value)} className="bg-background border-border h-11 text-center font-bold rounded-xl" />
                                                    </div>
                                                    <div className="space-y-1">
                                                        <Label className="text-[9px] font-black text-primary uppercase tracking-widest ml-1">Shot</Label>
                                                        <Input value={editShot} onChange={(e) => setEditShot(e.target.value)} className="bg-background border-border h-11 text-center font-bold rounded-xl" />
                                                    </div>
                                                    <div className="col-span-2 space-y-1">
                                                        <Label className="text-[9px] font-black text-primary uppercase tracking-widest ml-1">Status</Label>
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
                                                    <Label className="text-[9px] font-black text-primary uppercase tracking-widest ml-1">Composition Description</Label>
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
                                                        <div className="flex items-center gap-1.5 bg-primary/10 rounded-xl px-3 py-1.5 border border-primary/10 group-hover:bg-primary/20 transition-all shrink-0">
                                                            <p className="text-[8px] font-black text-primary/60 uppercase tracking-tighter">Shot</p>
                                                            <p className="text-lg font-black text-foreground leading-none">{shot.shot}</p>
                                                        </div>

                                                        {/* Status badge */}
                                                        <span className={`text-[9px] font-black px-3 py-1.5 rounded-full uppercase tracking-widest border transition-colors shrink-0 ${
                                                            shot.status === 'completed' ? 'bg-primary/10 text-primary/80 border-primary/20' :
                                                            shot.status === 'in-progress' ? 'bg-primary/10 text-primary border-primary/20' :
                                                            'bg-muted/30 text-muted-foreground border-border'
                                                        }`}>
                                                            {shot.status.replace('-', ' ')}
                                                        </span>

                                                        <p className="hidden sm:block text-[9px] font-black text-muted-foreground uppercase tracking-widest opacity-40">Composition {parseInt(shot.shot)}</p>
                                                    </div>

                                                    {/* Action buttons */}
                                                    {!isInternal && (
                                                        <div className="flex shrink-0 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-all lg:translate-x-4 lg:group-hover:translate-x-0">
                                                            <Button size="icon" variant="ghost" className="h-9 w-9 hover:text-primary rounded-xl" onClick={() => handleEdit(shot)}>
                                                                <Pencil className="h-3.5 w-3.5" />
                                                            </Button>
                                                            <Button size="icon" variant="ghost" className="h-9 w-9 hover:text-destructive rounded-xl" onClick={() => handleDelete(shot.id)}>
                                                                <Trash2 className="h-3.5 w-3.5" />
                                                            </Button>
                                                        </div>
                                                    )}
                                                </div>
                                                
                                                {/* Description */}
                                                <div className="relative">
                                                    <Film className="absolute -left-1 -top-2 w-10 h-10 text-primary/5 -rotate-12 pointer-events-none" />
                                                    <p className="text-sm sm:text-base font-bold text-foreground/90 leading-relaxed italic border-l-4 border-primary/30 pl-4 py-1 break-words">
                                                        "{shot.description}"
                                                    </p>
                                                </div>

                                                {/* Status changer */}
                                                <div>
                                                    <Select value={shot.status} onValueChange={(value) => handleStatusChange(shot.id, value)} disabled={isInternal}>
                                                        <SelectTrigger className={`w-full sm:w-44 h-9 text-[10px] font-black uppercase bg-background/50 border-border/50 rounded-xl ${!isInternal ? 'opacity-60 hover:opacity-100 transition-all hover:border-primary/30' : 'opacity-40 cursor-default'}`}>
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
                        </div>
                    ))}
                </div>
            ) : (
                <div className="flex flex-col items-center justify-center py-24 text-center opacity-40">
                    <Film className="w-16 h-16 mb-4" />
                    <h3 className="text-lg font-bold">No Sequences Planned</h3>
                    <p className="max-w-xs text-sm">Every masterpiece starts with a single shot. Begin defining your production roadmap above.</p>
                </div>
            )}
        </div>
    );
};

export default ShotList;

