import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Card } from '@/components/ui/card';
import { Loader2, Save, Trash2, ChevronRight, MessageCircle, Wallet, CircleUser, ArrowLeft, Lock, Film, Camera, Search, Check } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { useAppNavigation } from '@/contexts/NavigationContext';
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
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { useAppRole } from '@/hooks/useAppRole';

interface ProjectSettingsProps {
    projectId: string;
}

const ProjectSettings = ({ projectId }: ProjectSettingsProps) => {
    const { isInternal } = useAppRole();
    const { toast } = useToast();
    const { push } = useAppNavigation();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [deleting, setDeleting] = useState(false);

    // Form fields
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
    const [imageUrl, setImageUrl] = useState<string | null>(null);
    const [imageUploading, setImageUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [step, setStep] = useState<'basis' | 'financials' | 'privacy' | 'danger'>('basis');
    const [isMenu, setIsMenu] = useState(true);

    const [originalStatus, setOriginalStatus] = useState('active');
    const [showWrapDialog, setShowWrapDialog] = useState(false);
    const [crewList, setCrewList] = useState<{ user_id: string; full_name: string; role: string; avatar_url: string; selected: boolean }[]>([]);
    const [loadingCrew, setLoadingCrew] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<{ id: string; full_name: string; username: string; avatar_url: string }[]>([]);
    const [searchingUsers, setSearchingUsers] = useState(false);

    const openStep = (target: 'basis' | 'financials' | 'privacy' | 'danger') => {
        setStep(target);
        setIsMenu(false);
    };

    const getGradient = (id: string) => {
        const gradients = [
            'bg-gradient-to-br from-pink-500 to-rose-500',
            'bg-gradient-to-br from-purple-500 to-indigo-500',
            'bg-gradient-to-br from-blue-500 to-cyan-500',
            'bg-gradient-to-br from-primary to-accent',
            'bg-gradient-to-br from-orange-500 to-amber-500',
            'bg-gradient-to-br from-red-500 to-orange-600',
            'bg-gradient-to-br from-primary to-primary/80',
        ];
        const index = Array.from(id).reduce((acc, char) => acc + char.charCodeAt(0), 0) % gradients.length;
        return gradients[index];
    };

    const fetchSpaceMembers = async () => {
        try {
            setLoadingCrew(true);
            const { data: space } = await supabase
                .from('project_spaces')
                .select('id')
                .eq('project_id', projectId)
                .maybeSingle();

            if (!space) {
                setCrewList([]);
                return;
            }

            const { data: members, error } = await supabase
                .from('project_space_members' as any)
                .select(`
                    user_id,
                    role,
                    profiles:user_id (
                        full_name,
                        avatar_url
                    )
                `)
                .eq('project_space_id', space.id);

            if (error) throw error;

            const formatted = members?.map((m: any) => ({
                user_id: m.user_id,
                full_name: m.profiles?.full_name || 'Anonymous',
                role: m.role || 'Crew',
                avatar_url: m.profiles?.avatar_url || '',
                selected: true,
            })) || [];

            setCrewList(formatted);
        } catch (error) {
            console.error('Error fetching space members:', error);
        } finally {
            setLoadingCrew(false);
        }
    };

    const searchExternalUsers = async () => {
        if (!searchQuery.trim()) return;
        setSearchingUsers(true);
        try {
            const { data, error } = await supabase
                .from('profiles')
                .select('id, full_name, username, avatar_url')
                .ilike('full_name', `%${searchQuery}%`)
                .limit(5);

            if (error) throw error;

            const existingIds = crewList.map(c => c.user_id);
            const filtered = (data || [])
                .filter(u => !existingIds.includes(u.id))
                .map(u => ({
                    id: u.id,
                    full_name: u.full_name || u.username || 'Anonymous',
                    username: u.username || '',
                    avatar_url: u.avatar_url || ''
                }));

            setSearchResults(filtered);
        } catch (error) {
            console.error('Error searching users:', error);
        } finally {
            setSearchingUsers(false);
        }
    };

    const addExternalCrew = (user: any) => {
        setCrewList(prev => [...prev, {
            user_id: user.id,
            full_name: user.full_name,
            role: 'Crew',
            avatar_url: user.avatar_url,
            selected: true
        }]);
        setSearchResults(prev => prev.filter(u => u.id !== user.id));
        setSearchQuery('');
    };

    const handleConfirmWrap = async () => {
        setSaving(true);
        try {
            const { error: updateError } = await supabase
                .from('projects')
                .update({
                    title,
                    description,
                    status: 'completed',
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

            if (updateError) throw updateError;

            const selectedCrew = crewList.filter(c => c.selected);
            if (selectedCrew.length > 0) {
                const { data: { user: currentUser } } = await supabase.auth.getUser();
                const creditsToInsert = selectedCrew.map(c => ({
                    project_id: projectId,
                    project_title: title,
                    user_id: c.user_id,
                    role: c.role,
                    verifier_id: currentUser?.id || null
                }));

                const { error: creditsError } = await supabase
                    .from('project_credits')
                    .insert(creditsToInsert);

                if (creditsError) {
                    console.error('Error saving credits:', creditsError);
                }
            }

            toast({
                title: "Project Wrapped!",
                description: "Project completed and verified crew credits published.",
            });
            setOriginalStatus('completed');
            setStatus('completed');
            setShowWrapDialog(false);
        } catch (error: any) {
            toast({
                title: "Error",
                description: error.message || "Failed to wrap project settings",
                variant: "destructive"
            });
        } finally {
            setSaving(false);
        }
    };

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
                setOriginalStatus(data.status || 'active');
                setLocation(data.location || '');
                setGenre(data.genre ? data.genre.join(', ') : '');
                setStartDate(data.start_date || '');
                setEndDate(data.end_date || '');
                setBudgetMin(data.budget_min?.toString() || '');
                setBudgetMax(data.budget_max?.toString() || '');
                setIsPublic(data.is_public || false);
                setImageUrl(data.image_url || null);
            }
        } catch (error: any) {
            toast({
                title: "Error",
                description: "Failed to load project settings",
                variant: "destructive"
            });
        } finally {
            setLoading(false);
        }
    };

    const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        try {
            setImageUploading(true);
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error("Unauthenticated");

            const { compressImage } = await import('@/utils/imageCompression');
            const compressedFile = await compressImage(file);

            const fileExt = compressedFile.name.split('.').pop();
            const fileName = `${user.id}-${Date.now()}.${fileExt}`;
            const filePath = `projects/${fileName}`;

            const { error: uploadError } = await supabase.storage
                .from('portfolios')
                .upload(filePath, compressedFile, {
                    cacheControl: '31536000',
                    upsert: false
                });

            if (uploadError) throw uploadError;

            const { data: { publicUrl } } = supabase.storage
                .from('portfolios')
                .getPublicUrl(filePath);

            const { error: updateError } = await supabase
                .from('projects')
                .update({ image_url: publicUrl })
                .eq('id', projectId);

            if (updateError) throw updateError;

            setImageUrl(publicUrl);
            toast({ title: "Success", description: "Project thumbnail updated!" });
        } catch (error: any) {
            toast({ title: "Upload Failed", description: error.message, variant: "destructive" });
        } finally {
            setImageUploading(false);
        }
    };

    const handleSave = async () => {
        if (status === 'completed' && originalStatus !== 'completed') {
            await fetchSpaceMembers();
            setShowWrapDialog(true);
            return;
        }

        setSaving(true);
        try {
            const finalDescription = description;

            const { error } = await supabase
                .from('projects')
                .update({
                    title,
                    description: finalDescription,
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
            push('/projects');
        } catch (error: any) {
            toast({
                title: "Error",
                description: "Failed to delete project",
                variant: "destructive"
            });
        } finally {
            setDeleting(false);
        }
    };

    const handleClearChatHistory = async () => {
        setSaving(true);
        try {
            const { data: spaces } = await supabase
                .from('project_spaces')
                .select('id')
                .eq('project_id', projectId);
            
            if (spaces && spaces.length > 0) {
                const spaceIds = spaces.map(s => s.id);
                const { error } = await supabase
                    .from('project_space_messages')
                    .delete()
                    .in('project_space_id', spaceIds);
                
                if (error) throw error;
            }

            toast({
                title: "Success",
                description: "All project chat history has been cleared",
            });
        } catch (error: any) {
            toast({
                title: "Error",
                description: "Failed to clear chat history",
                variant: "destructive"
            });
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
    }

    if (isMenu) {
        return (
            <div className="max-w-xl mx-auto h-full overflow-y-auto no-scrollbar pb-24 relative p-4 sm:p-6 space-y-6 animate-in fade-in duration-500">
                {/* Profile-Header Style: Dynamic Image with Edit Capability */}
                <div className="flex items-center gap-6 mb-12 group/header">
                    <div 
                        onClick={() => !isInternal && fileInputRef.current?.click()}
                        className={`w-20 h-20 sm:w-24 sm:h-24 ${!imageUrl ? getGradient(projectId) : ''} rounded-3xl flex items-center justify-center border-4 border-background shadow-[0_20px_50px_-12px_rgba(0,0,0,0.5)] ${!isInternal ? 'cursor-pointer hover:scale-105 active:scale-95' : 'cursor-default'} transition-all duration-500 relative overflow-hidden shrink-0`}
                    >
                        {imageUrl ? (
                            <img src={imageUrl} alt={title} className="w-full h-full object-cover" />
                        ) : (
                            <>
                                <div className="absolute inset-0 bg-black/10 backdrop-blur-[2px]" />
                                <Film className="w-10 h-10 sm:w-12 sm:h-12 text-white/90 relative z-10 drop-shadow-2xl" />
                            </>
                        )}
                        
                        {/* Camera Overlay: Always show on hover or while uploading */}
                        {!isInternal && (
                            <div className={`absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover/header:opacity-100 transition-opacity duration-300 z-20`}>
                                {imageUploading ? (
                                    <Loader2 className="w-6 h-6 text-white animate-spin" />
                                ) : (
                                    <Camera className="w-6 h-6 text-white drop-shadow-lg" />
                                )}
                            </div>
                        )}
                    </div>

                    <input 
                        type="file" 
                        ref={fileInputRef} 
                        onChange={handleImageChange} 
                        accept="image/*" 
                        className="hidden" 
                    />

                    <div className="flex-1 overflow-hidden space-y-1">
                        <h1 className="text-3xl font-black text-foreground truncate tracking-tighter leading-none">{title}</h1>
                        <p className="text-[10px] font-black text-primary uppercase tracking-[0.3em] opacity-60">Production Space</p>
                    </div>
                </div>

                <div className="space-y-4">
                    <p className="text-[10px] font-black text-muted-foreground/60 uppercase tracking-[0.2em] px-2">Project Management</p>
                    
                    <div className="bg-card/40 backdrop-blur-xl border border-border/50 rounded-[32px] overflow-hidden">
                        <button 
                            onClick={() => openStep('basis')}
                            className="w-full flex items-center gap-4 p-5 hover:bg-white/5 transition-colors group text-left"
                        >
                            <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-white transition-all shadow-sm">
                                <CircleUser className="w-5 h-5" />
                            </div>
                            <div className="flex-1">
                                <p className="font-black text-foreground tracking-tight">General Basics</p>
                                <p className="text-xs text-muted-foreground">Title, Story, Location & Genres</p>
                            </div>
                            <ChevronRight className="w-5 h-5 text-muted-foreground/30" />
                        </button>
                        
                        <div className="h-[1px] bg-border/40 mx-16" />

                        <button 
                            onClick={() => openStep('financials')}
                            className="w-full flex items-center gap-4 p-5 hover:bg-white/5 transition-colors group text-left"
                        >
                            <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center text-primary/80 group-hover:bg-primary group-hover:text-white transition-all shadow-sm">
                                <Wallet className="w-5 h-5" />
                            </div>
                            <div className="flex-1">
                                <p className="font-black text-foreground tracking-tight">Budget & Timeline</p>
                                <p className="text-xs text-muted-foreground">Financial estimates & production dates</p>
                            </div>
                            <ChevronRight className="w-5 h-5 text-muted-foreground/30" />
                        </button>

                        <div className="h-[1px] bg-border/40 mx-16" />

                        <button 
                            onClick={() => openStep('privacy')}
                            className="w-full flex items-center gap-4 p-5 hover:bg-white/5 transition-colors group text-left"
                        >
                            <div className="w-10 h-10 bg-blue-500/10 rounded-full flex items-center justify-center text-blue-400 group-hover:bg-blue-500 group-hover:text-white transition-all shadow-sm">
                                <Lock className="w-5 h-5" />
                            </div>
                            <div className="flex-1">
                                <p className="font-black text-foreground tracking-tight">Privacy & Scope</p>
                                <p className="text-xs text-muted-foreground">Marketplace visibility & phase status</p>
                            </div>
                            <ChevronRight className="w-5 h-5 text-muted-foreground/30" />
                        </button>
                    </div>

                    {!isInternal && (
                        <>
                            <p className="text-[10px] font-black text-destructive/60 uppercase tracking-[0.2em] px-2 pt-4">Danger Zone</p>
                            
                            <div className="bg-card/40 backdrop-blur-xl border border-border/50 rounded-[32px] overflow-hidden">
                                <button 
                                    onClick={() => openStep('danger')}
                                    className="w-full flex items-center gap-4 p-5 hover:bg-destructive/5 transition-colors group text-left"
                                >
                                    <div className="w-10 h-10 bg-destructive/10 rounded-full flex items-center justify-center text-destructive group-hover:bg-destructive group-hover:text-white transition-all shadow-sm">
                                        <Trash2 className="w-5 h-5" />
                                    </div>
                                    <div className="flex-1">
                                        <p className="font-black text-destructive tracking-tight uppercase text-xs">Security Actions</p>
                                        <p className="text-xs text-muted-foreground">Terminate space or clear chat logs</p>
                                    </div>
                                    <ChevronRight className="w-5 h-5 text-muted-foreground/30" />
                                </button>
                            </div>
                        </>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full w-full relative">
            <div className="flex-1 max-w-4xl w-full mx-auto p-4 sm:p-8 space-y-8 overflow-y-auto no-scrollbar pb-32 animate-in fade-in slide-in-from-right-8 duration-500">
                <div className="flex flex-col gap-1 mb-8">
                <button 
                    onClick={() => setIsMenu(true)}
                    className="flex items-center gap-2 text-muted-foreground hover:text-primary transition-colors mb-4 group w-fit"
                >
                    <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
                    <span className="text-[10px] font-black uppercase tracking-widest">Back to Menu</span>
                </button>
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-xs font-black tracking-[0.2em] text-primary uppercase">{step === 'danger' ? 'Advanced' : 'Settings'}</h1>
                        <p className="text-3xl font-black text-foreground tracking-tighter uppercase">{step}</p>
                    </div>
                    <div className="w-10 h-10 bg-primary/5 rounded-full flex items-center justify-center text-primary/30">
                        {step === 'basis' && <CircleUser className="w-5 h-5" />}
                        {step === 'financials' && <Wallet className="w-5 h-5" />}
                        {step === 'privacy' && <Lock className="w-5 h-5" />}
                        {step === 'danger' && <Trash2 className="w-5 h-5" />}
                    </div>
                </div>
            </div>

            <div className="flex-grow min-h-0">
                {step === 'basis' && (
                    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <Card className="bg-card/60 backdrop-blur-xl border border-border shadow-2xl rounded-[40px] overflow-hidden p-6 sm:p-10">
                            <div className="space-y-8">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                    <div className="space-y-3">
                                        <Label className="text-[10px] font-black text-primary uppercase ml-1 tracking-widest">Project Title</Label>
                                        <Input
                                            value={title}
                                            onChange={(e) => setTitle(e.target.value)}
                                            placeholder="The Masterpiece"
                                            className="bg-background/50 border-border h-14 rounded-2xl text-lg font-bold"
                                        />
                                    </div>
                                    <div className="space-y-3">
                                        <Label className="text-[10px] font-black text-primary uppercase ml-1 tracking-widest">Production Location</Label>
                                        <Input
                                            value={location}
                                            onChange={(e) => setLocation(e.target.value)}
                                            placeholder="e.g. Hyderabad, India"
                                            className="bg-background/50 border-border h-14 rounded-2xl font-bold"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    <Label className="text-[10px] font-black text-primary uppercase ml-1 tracking-widest">Story Synopsis</Label>
                                    <Textarea
                                        value={description}
                                        onChange={(e) => setDescription(e.target.value)}
                                        placeholder="Brief production overview..."
                                        className="bg-background/50 border-border rounded-2xl font-bold min-h-[160px] resize-none focus:ring-primary/20"
                                    />
                                </div>

                                <div className="space-y-3">
                                    <Label className="text-[10px] font-black text-primary uppercase ml-1 tracking-widest">Project Genres</Label>
                                    <Input
                                        value={genre}
                                        onChange={(e) => setGenre(e.target.value)}
                                        placeholder="Action, Sci-Fi, Indie"
                                        className="bg-background/50 border-border h-14 rounded-2xl font-bold"
                                    />
                                </div>
                            </div>
                        </Card>
                        <Button onClick={() => setStep('financials')} variant="ghost" className="w-full h-16 rounded-[28px] border border-dashed border-border hover:bg-accent/50 group">
                            <span className="text-muted-foreground group-hover:text-foreground font-bold">Adjust Financials</span>
                            <ChevronRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
                        </Button>
                    </div>
                )}

                {step === 'financials' && (
                    <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
                        <Card className="bg-card/60 backdrop-blur-xl border border-border shadow-2xl rounded-[40px] overflow-hidden p-6 sm:p-10">
                            <div className="space-y-10">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                    <div className="space-y-3">
                                        <Label className="text-[10px] font-black uppercase ml-1 tracking-widest text-primary/80">Min Budget</Label>
                                        <Input
                                            type="number"
                                            value={budgetMin}
                                            onChange={(e) => setBudgetMin(e.target.value)}
                                            placeholder="0"
                                            className="bg-background/50 border-border h-14 rounded-2xl font-mono font-bold"
                                        />
                                    </div>
                                    <div className="space-y-3">
                                        <Label className="text-[10px] font-black uppercase ml-1 tracking-widest text-primary/80">Max Budget</Label>
                                        <Input
                                            type="number"
                                            value={budgetMax}
                                            onChange={(e) => setBudgetMax(e.target.value)}
                                            placeholder="0"
                                            className="bg-background/50 border-border h-14 rounded-2xl font-mono font-bold"
                                        />
                                    </div>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 border-t border-border/40 pt-10">
                                    <div className="space-y-3">
                                        <Label className="text-[10px] font-black text-primary uppercase ml-1 tracking-widest">Production Start</Label>
                                        <Input
                                            type="date"
                                            value={startDate}
                                            onChange={(e) => setStartDate(e.target.value)}
                                            className="bg-background/50 border-border h-14 rounded-2xl font-bold"
                                        />
                                    </div>
                                    <div className="space-y-3">
                                        <Label className="text-[10px] font-black text-primary uppercase ml-1 tracking-widest">Estimated Wrap</Label>
                                        <Input
                                            type="date"
                                            value={endDate}
                                            onChange={(e) => setEndDate(e.target.value)}
                                            className="bg-background/50 border-border h-14 rounded-2xl font-bold"
                                        />
                                    </div>
                                </div>
                            </div>
                        </Card>
                        <Button onClick={() => setStep('privacy')} variant="ghost" className="w-full h-16 rounded-[28px] border border-dashed border-border hover:bg-accent/50 group">
                            <span className="text-muted-foreground group-hover:text-foreground font-bold">Configure Privacy</span>
                            <ChevronRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
                        </Button>
                    </div>
                )}

                {step === 'privacy' && (
                    <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
                        <Card className="bg-card/60 backdrop-blur-xl border border-border shadow-2xl rounded-[40px] overflow-hidden p-6 sm:p-10">
                            <div className="space-y-10">
                                <div className="space-y-3">
                                    <Label className="text-[10px] font-black text-primary uppercase ml-1 tracking-widest">Project Phase</Label>
                                    <Select value={status} onValueChange={setStatus}>
                                        <SelectTrigger className="h-16 rounded-2xl bg-background/50 border-border text-lg font-bold">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent className="rounded-2xl shadow-2xl">
                                            <SelectItem value="active" className="font-bold py-3">Active Production</SelectItem>
                                            <SelectItem value="completed" className="font-bold py-3">Completed / Released</SelectItem>
                                            <SelectItem value="archived" className="font-bold py-3">Archived</SelectItem>
                                            <SelectItem value="on_hold" className="font-bold py-3">On Hold</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="flex items-center justify-between p-8 border border-border/40 rounded-3xl bg-background/20 backdrop-blur-sm group hover:border-primary/30 transition-all">
                                    <div className="space-y-2">
                                        <div className="flex items-center gap-2">
                                            <Label className="text-lg font-black tracking-tight">Public Visibility</Label>
                                            <span className="bg-primary/10 text-primary text-[8px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest">Global Discovery</span>
                                        </div>
                                        <p className="text-sm text-muted-foreground max-w-sm">
                                            Enable discovery in the marketplace. When off, this project is invisible to non-team members.
                                        </p>
                                    </div>
                                    <Switch
                                        checked={isPublic}
                                        onCheckedChange={setIsPublic}
                                        className="data-[state=checked]:bg-primary"
                                    />
                                </div>
                            </div>
                        </Card>
                    </div>
                )}

                {step === 'danger' && (
                    <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <Card className="bg-destructive/5 border border-destructive/20 backdrop-blur-xl shadow-2xl rounded-[40px] overflow-hidden p-8 group hover:bg-destructive/10 transition-all">
                                <div className="space-y-6">
                                    <div className="w-12 h-12 bg-destructive/10 rounded-2xl flex items-center justify-center text-destructive group-hover:scale-110 transition-transform">
                                        <Trash2 className="w-6 h-6" />
                                    </div>
                                    <div className="space-y-2">
                                        <h3 className="text-xl font-black text-destructive tracking-tight">Delete Project</h3>
                                        <p className="text-sm text-destructive/60 leading-relaxed">
                                            This will permanently erase all budget logs, shot lists, call sheets and discussions.
                                        </p>
                                    </div>
                                    <AlertDialog>
                                        <AlertDialogTrigger asChild>
                                            <Button variant="destructive" className="w-full h-14 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-destructive/20">
                                                Terminate Entire Space
                                            </Button>
                                        </AlertDialogTrigger>
                                        <AlertDialogContent className="rounded-[40px] p-10 border-destructive/20">
                                            <AlertDialogHeader>
                                                <AlertDialogTitle className="text-3xl font-black tracking-tighter">Ultimate Confirmation</AlertDialogTitle>
                                                <AlertDialogDescription className="text-base text-muted-foreground">
                                                    You are about to delete "{title}". This action is irreversible. All team access will be revoked immediately.
                                                </AlertDialogDescription>
                                            </AlertDialogHeader>
                                            <AlertDialogFooter className="mt-8 gap-4">
                                                <AlertDialogCancel className="h-14 rounded-2xl font-bold">Keep Project</AlertDialogCancel>
                                                <AlertDialogAction onClick={handleDelete} disabled={deleting} className="h-14 rounded-2xl font-black bg-destructive hover:bg-red-600 text-white shadow-xl shadow-destructive/20 flex items-center gap-2">
                                                    {deleting && <Loader2 className="h-4 w-4 animate-spin" />}
                                                    Confirm Destruction
                                                </AlertDialogAction>
                                            </AlertDialogFooter>
                                        </AlertDialogContent>
                                    </AlertDialog>
                                </div>
                            </Card>

                            <Card className="bg-card/40 border border-border backdrop-blur-xl shadow-2xl rounded-[40px] overflow-hidden p-8 group hover:bg-accent/40 transition-all">
                                <div className="space-y-6">
                                    <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
                                        <MessageCircle className="w-6 h-6" />
                                    </div>
                                    <div className="space-y-2">
                                        <h3 className="text-xl font-black text-foreground tracking-tight">Clear Conversations</h3>
                                        <p className="text-sm text-muted-foreground leading-relaxed">
                                            Purge all message history from project spaces while keeping lists and files intact.
                                        </p>
                                    </div>
                                    <AlertDialog>
                                        <AlertDialogTrigger asChild>
                                            <Button variant="outline" className="w-full h-14 rounded-2xl font-black text-xs uppercase tracking-widest border-primary/20 text-primary hover:bg-primary hover:text-white transition-all shadow-lg hover:shadow-primary/20">
                                                Purge Chat History
                                            </Button>
                                        </AlertDialogTrigger>
                                        <AlertDialogContent className="rounded-[40px] p-10 border-primary/20">
                                            <AlertDialogHeader>
                                                <AlertDialogTitle className="text-3xl font-black tracking-tighter">Reset Conversations?</AlertDialogTitle>
                                                <AlertDialogDescription className="text-base text-muted-foreground">
                                                    This will wipe all messages. Team roles, Shot lists and Finances will remain untouched.
                                                </AlertDialogDescription>
                                            </AlertDialogHeader>
                                            <AlertDialogFooter className="mt-8 gap-4">
                                                <AlertDialogCancel className="h-14 rounded-2xl font-bold">Keep Messages</AlertDialogCancel>
                                                <AlertDialogAction onClick={handleClearChatHistory} className="h-14 rounded-2xl font-black bg-primary hover:bg-primary/90 text-white shadow-xl shadow-primary/20">Start Fresh</AlertDialogAction>
                                            </AlertDialogFooter>
                                        </AlertDialogContent>
                                    </AlertDialog>
                                </div>
                            </Card>
                        </div>
                    </div>
                )}
            </div>
            </div>

            {/* Persistent Action Bar */}
            {!isInternal && (
                <div className="absolute bottom-0 left-0 right-0 z-50 animate-in slide-in-from-bottom-8 duration-700">
                    <Card className="bg-background/80 backdrop-blur-2xl border-t border-x-0 border-b-0 border-white/10 shadow-[0_-20px_50px_-15px_rgba(0,0,0,0.5)] rounded-none p-4 sm:p-6 w-full">
                        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-6 w-full">
                            <div className="hidden sm:block space-y-0.5">
                                <p className="text-[10px] font-black text-primary uppercase tracking-[0.2em]">Editing Mode</p>
                                <p className="text-sm font-bold text-foreground/70">Unsaved changes in <span className="text-primary font-black uppercase text-xs">{step}</span></p>
                            </div>
                            <div className="flex items-center justify-end gap-4 w-full sm:w-auto">
                                <Button 
                                    variant="ghost" 
                                    onClick={fetchProjectDetails} 
                                    disabled={saving}
                                    className="w-auto h-14 rounded-2xl font-bold text-muted-foreground hover:bg-white/5 px-6"
                                >
                                    Reset
                                </Button>
                                <Button 
                                    onClick={handleSave} 
                                    disabled={saving} 
                                    className="flex-1 sm:flex-none sm:w-auto h-14 rounded-[24px] px-8 sm:px-12 bg-primary hover:bg-primary/90 text-white font-black text-xs uppercase tracking-widest shadow-2xl shadow-primary/40 transition-all active:scale-95 flex items-center justify-center gap-3"
                                >
                                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                                    Sync Settings
                                </Button>
                            </div>
                        </div>
                    </Card>
                </div>
            )}

            <Dialog open={showWrapDialog} onOpenChange={setShowWrapDialog}>
                <DialogContent className="sm:max-w-2xl bg-card border-border rounded-[32px] p-8 max-h-[85vh] overflow-y-auto no-scrollbar">
                    <DialogHeader>
                        <DialogTitle className="text-2xl font-black tracking-tight text-foreground uppercase flex items-center gap-2">
                            <Film className="h-6 w-6 text-primary" /> Wrap Project & Tag Crew
                        </DialogTitle>
                        <DialogDescription className="text-muted-foreground text-sm font-medium">
                            Officially wrap the production of "{title}". Tag the crew members below to publish locked verified credits directly to their profiles.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-6 py-4">
                        <div className="space-y-2">
                            <Label className="text-[10px] font-black text-primary uppercase tracking-widest ml-1">Tag Additional Crew Members</Label>
                            <div className="flex gap-2">
                                <Input
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    placeholder="Search by name to credit other users..."
                                    className="bg-background/50 border-border h-12 rounded-xl"
                                    onKeyDown={(e) => e.key === 'Enter' && searchExternalUsers()}
                                />
                                <Button onClick={searchExternalUsers} disabled={searchingUsers} className="bg-primary text-primary-foreground h-12 rounded-xl px-4">
                                    <Search className="h-4 w-4" />
                                </Button>
                            </div>

                            {searchResults.length > 0 && (
                                <div className="space-y-2 max-h-40 overflow-y-auto mt-2 bg-background/30 p-2 rounded-xl border border-border/40">
                                    {searchResults.map(user => (
                                        <div key={user.id} className="flex items-center justify-between p-2 hover:bg-accent/40 rounded-lg transition-colors">
                                            <div className="flex items-center gap-3">
                                                {user.avatar_url ? (
                                                    <img src={user.avatar_url} alt={user.full_name} className="h-8 w-8 rounded-full object-cover" />
                                                ) : (
                                                    <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-xs">
                                                        {user.full_name[0].toUpperCase()}
                                                    </div>
                                                )}
                                                <div>
                                                    <p className="text-sm font-bold text-foreground">{user.full_name}</p>
                                                    <p className="text-[10px] text-muted-foreground">@{user.username}</p>
                                                </div>
                                            </div>
                                            <Button size="sm" onClick={() => addExternalCrew(user)} className="bg-primary/20 text-primary hover:bg-primary/30 border border-primary/20 rounded-lg text-xs font-bold py-1 h-8">
                                                Add Credit
                                            </Button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="space-y-3">
                            <Label className="text-[10px] font-black text-primary uppercase tracking-widest ml-1">Credits Roll</Label>
                            {loadingCrew ? (
                                <div className="text-center py-6 text-muted-foreground">Loading crew list...</div>
                            ) : crewList.length === 0 ? (
                                <div className="text-center py-6 text-muted-foreground text-xs italic bg-background/20 rounded-2xl border border-dashed border-border/50">
                                    No crew members to tag. Wrap anyway or search above.
                                </div>
                            ) : (
                                <div className="space-y-3 max-h-[40vh] overflow-y-auto pr-1">
                                    {crewList.map((crew, idx) => (
                                        <div key={crew.user_id + '-' + idx} className="flex items-center justify-between gap-4 p-4 bg-background/30 border border-border/50 rounded-2xl hover:border-primary/20 transition-all">
                                            <div className="flex items-center gap-3 min-w-0">
                                                <Checkbox
                                                    checked={crew.selected}
                                                    onCheckedChange={(checked) => {
                                                        setCrewList(prev => prev.map((c, i) => i === idx ? { ...c, selected: !!checked } : c));
                                                    }}
                                                    className="data-[state=checked]:bg-primary rounded"
                                                />
                                                {crew.avatar_url ? (
                                                    <img src={crew.avatar_url} alt={crew.full_name} className="h-9 w-9 rounded-full object-cover shrink-0" />
                                                ) : (
                                                    <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold shrink-0">
                                                        {crew.full_name[0].toUpperCase()}
                                                    </div>
                                                )}
                                                <span className="font-bold text-sm text-foreground truncate">{crew.full_name}</span>
                                            </div>

                                            <div className="flex items-center gap-2">
                                                <Label className="text-[9px] font-black text-muted-foreground uppercase tracking-widest shrink-0">Credit Role:</Label>
                                                <Input
                                                    value={crew.role}
                                                    onChange={(e) => {
                                                        const val = e.target.value;
                                                        setCrewList(prev => prev.map((c, i) => i === idx ? { ...c, role: val } : c));
                                                    }}
                                                    placeholder="Role (e.g. Producer)"
                                                    disabled={!crew.selected}
                                                    className="bg-background border-border h-10 w-44 rounded-xl text-xs font-semibold focus-visible:ring-primary/20"
                                                />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    <DialogFooter className="gap-2 mt-6">
                        <Button 
                            variant="ghost" 
                            onClick={() => setShowWrapDialog(false)}
                            className="h-12 rounded-xl font-bold"
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={handleConfirmWrap}
                            disabled={saving}
                            className="bg-primary hover:bg-primary/95 text-white font-black text-xs uppercase tracking-widest px-8 h-12 rounded-xl shadow-lg shadow-primary/20"
                        >
                            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Wrap & Publish Credits"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default ProjectSettings;

