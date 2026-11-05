import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Card } from '@/components/ui/card';
import { Loader2, Save, Trash2, MessageCircle, Wallet, CircleUser, Lock, Film, Camera, Search, Check, Users, Globe, MapPin, X, Plus, Play, Pause, CheckCircle2, Archive, AlertTriangle, CalendarRange, Tag } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
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
import { friendlyError } from '@cinecraft/core';

interface ProjectSettingsProps {
    projectId: string;
    /** true only for the space / project creator */
    canManage?: boolean;
}

/** One settings card. Defined outside the screen so typing in its fields never remounts it. */
const Section = ({ id, title: t, desc, icon: Icon, children, tone }: { id: string; title: string; desc: string; icon: React.ComponentType<{ className?: string }>; children: React.ReactNode; tone?: 'danger' }) => (
    <section id={'ps-' + id} aria-labelledby={'ps-h-' + id} className={cn('scroll-mt-4 rounded-2xl border bg-card', tone === 'danger' ? 'border-destructive/30' : 'border-border')}>
        <div className="flex items-start gap-3.5 px-5 sm:px-6 pt-5 sm:pt-6">
            <span className={cn('h-10 w-10 rounded-xl grid place-items-center shrink-0', tone === 'danger' ? 'bg-destructive/10 text-destructive' : 'bg-primary/10 text-primary')}><Icon className="h-5 w-5" /></span>
            <div className="min-w-0">
                <h2 id={'ps-h-' + id} className={cn('text-lg font-semibold leading-tight', tone === 'danger' && 'text-destructive')}>{t}</h2>
                <p className="text-sm text-muted-foreground mt-0.5">{desc}</p>
            </div>
        </div>
        <div className="p-5 sm:p-6 pt-5">{children}</div>
    </section>
);


const ProjectSettings = ({ projectId, canManage = false }: ProjectSettingsProps) => {
    const { isInternal } = useAppRole();
    // Only the space / project creator edits, purges chat, terminates or deletes. Staff observers and everyone else: read-only.
    const readOnly = isInternal || !canManage;
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
    const [requiredRoles, setRequiredRoles] = useState<string[]>([]);
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
    const [baseline, setBaseline] = useState<string | null>(null);
    const [rebase, setRebase] = useState(0);
    const [genreDraft, setGenreDraft] = useState('');
    const [deleteConfirm, setDeleteConfirm] = useState('');
    const [activeSection, setActiveSection] = useState('basics');

    const [originalStatus, setOriginalStatus] = useState('active');
    const [showWrapDialog, setShowWrapDialog] = useState(false);
    const [crewList, setCrewList] = useState<{ user_id: string; full_name: string; role: string; avatar_url: string; selected: boolean }[]>([]);
    const [loadingCrew, setLoadingCrew] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<{ id: string; full_name: string; username: string; avatar_url: string }[]>([]);
    const [searchingUsers, setSearchingUsers] = useState(false);

    const availableRoles = [
        'Director', 'Producer', 'Cinematographer', 'Editor', 'Sound Designer',
        'Production Designer', 'Costume Designer', 'Makeup Artist', 'Actor',
        'Screenwriter', 'Composer', 'VFX Artist', 'Gaffer', 'Script Supervisor'
    ];

    const handleRoleToggle = (role: string) => {
        setRequiredRoles(prev => prev.includes(role)
            ? prev.filter(r => r !== role)
            : [...prev, role]
        );
    };

    const openStep = (target: 'basis' | 'financials' | 'privacy' | 'danger') => {
        setStep(target);
        setIsMenu(false);
    };

    const getGradient = (id: string) => {
        const gradients = [
            'bg-gradient-to-br from-pink-500 to-rose-500',
            'bg-gradient-to-br from-purple-500 to-indigo-500',
            'bg-gradient-to-br from-blue-500 to-cyan-500',
            'bg-gradient-to-br from-primary to-[hsl(var(--accent-strong))]',
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
                    required_roles: requiredRoles,
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
            setRebase((n) => n + 1);
        } catch (error: any) {
            toast({
                title: "Error",
                description: friendlyError(error, "Failed to wrap project settings"),
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
                setRequiredRoles(data.required_roles || []);
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
            setRebase((n) => n + 1);
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
            toast({ title: "Upload Failed", description: friendlyError(error), variant: "destructive" });
        } finally {
            setImageUploading(false);
        }
    };

    const handleSave = async () => {
        if (readOnly) return;
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
                    required_roles: requiredRoles,
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
            setRebase((n) => n + 1);
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
        if (readOnly) return;
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
        if (readOnly) return;
        setSaving(true);
        try {
            // 1. Attempt RPC call passing both _space_id and _project_id
            const { error: rpcError } = await (supabase.rpc as any)('clear_project_space_messages', {
                _space_id: projectId,
                _project_id: projectId
            });

            if (rpcError) {
                console.warn("clear_project_space_messages RPC failed or not deployed, using client fallback:", rpcError);
                
                // Collect target space IDs
                const { data: spaces } = await supabase
                    .from('project_spaces')
                    .select('id')
                    .or(`id.eq.${projectId},project_id.eq.${projectId}`);
                
                const spaceIds = spaces ? spaces.map(s => s.id) : [projectId];
                if (!spaceIds.includes(projectId)) spaceIds.push(projectId);

                // Clear pinned message references
                await supabase
                    .from('project_spaces')
                    .update({ pinned_message_id: null } as any)
                    .in('id', spaceIds);

                // Break reply_to_id FK
                await supabase
                    .from('project_space_messages')
                    .update({ reply_to_id: null } as any)
                    .in('project_space_id', spaceIds);

                // Fetch message IDs to delete reactions
                const { data: msgs } = await supabase
                    .from('project_space_messages')
                    .select('id')
                    .in('project_space_id', spaceIds);

                if (msgs && msgs.length > 0) {
                    const msgIds = msgs.map(m => m.id);
                    await supabase
                        .from('project_space_message_reactions' as any)
                        .delete()
                        .in('message_id', msgIds);
                }

                // Delete messages from project_space_messages
                const { error: deleteErr } = await supabase
                    .from('project_space_messages')
                    .delete()
                    .in('project_space_id', spaceIds);
                
                if (deleteErr && msgs && msgs.length > 0) {
                    for (const m of msgs) {
                        await supabase
                            .from('project_space_messages')
                            .delete()
                            .eq('id', m.id);
                    }
                }
            }

            // Dispatch broadcast event for open chat interfaces
            try {
                const channel = supabase.channel(`project_messages-v2:${projectId}`);
                await channel.send({
                    type: 'broadcast',
                    event: 'history_cleared',
                    payload: { projectId }
                });
                supabase.removeChannel(channel);
            } catch (e) {
                // Ignore broadcast error
            }

            // Dispatch local window event
            window.dispatchEvent(new CustomEvent('project_history_cleared', { detail: { projectId } }));

            toast({
                title: "Success",
                description: "All project chat history has been cleared",
            });
        } catch (error: any) {
            toast({
                title: "Error",
                description: friendlyError(error, "Failed to clear chat history"),
                variant: "destructive"
            });
        } finally {
            setSaving(false);
        }
    };

    const current = JSON.stringify([title, description, status, location, genre, requiredRoles, startDate, endDate, budgetMin, budgetMax, isPublic]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(() => { if (!loading) setBaseline(current); }, [loading, rebase]);
    const dirty = baseline !== null && current !== baseline;

    const SECTION_IDS = ['basics', 'roles', 'budget', 'visibility', 'danger'];
    useEffect(() => {
        if (loading) return;
        const seen = new Map<string, number>();
        const io = new IntersectionObserver((entries) => {
            entries.forEach((e) => seen.set(e.target.id, e.isIntersecting ? e.intersectionRatio : 0));
            const best = [...seen.entries()].sort((x, y) => y[1] - x[1])[0];
            if (best && best[1] > 0) setActiveSection(best[0]);
        }, { threshold: [0, 0.25, 0.5, 0.75, 1] });
        SECTION_IDS.forEach((id) => { const el = document.getElementById('ps-' + id); if (el) io.observe(el); });
        return () => io.disconnect();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [loading]);

    if (loading) {
        return <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
    }

    const genreList = genre.split(',').map((g) => g.trim()).filter(Boolean);
    const setGenres = (list: string[]) => setGenre(list.join(', '));
    const addGenre = (g: string) => {
        const v = g.trim();
        if (!v || genreList.some((x) => x.toLowerCase() === v.toLowerCase())) return;
        setGenres([...genreList, v]);
    };
    const GENRE_SUGGESTIONS = ['Drama', 'Thriller', 'Comedy', 'Documentary', 'Sci-Fi', 'Horror', 'Romance', 'Action', 'Short film'];

    const days = startDate && endDate ? Math.round((new Date(endDate).getTime() - new Date(startDate).getTime()) / 86400000) + 1 : null;
    const dateProblem = days !== null && days < 1;
    const budgetProblem = !!budgetMin && !!budgetMax && parseFloat(budgetMin) > parseFloat(budgetMax);
    const money = (v: string) => (v ? '$' + Number(v).toLocaleString() : null);

    const PHASES = [
        { id: 'active', label: 'Active', hint: 'In production', icon: Play, tone: 'text-emerald-600 bg-emerald-500/10 border-emerald-500/40' },
        { id: 'on_hold', label: 'On hold', hint: 'Paused for now', icon: Pause, tone: 'text-amber-600 bg-amber-500/10 border-amber-500/40' },
        { id: 'completed', label: 'Completed', hint: 'Wrapped and released', icon: CheckCircle2, tone: 'text-sky-600 bg-sky-500/10 border-sky-500/40' },
        { id: 'archived', label: 'Archived', hint: 'Kept for reference', icon: Archive, tone: 'text-muted-foreground bg-muted border-foreground/20' },
    ];
    const phase = PHASES.find((p) => p.id === status) || PHASES[0];

    const NAV = [
        { id: 'basics', label: 'Basics', icon: CircleUser },
        { id: 'roles', label: 'Open roles', icon: Users },
        { id: 'budget', label: 'Budget and dates', icon: Wallet },
        { id: 'visibility', label: 'Visibility and phase', icon: Globe },
        ...(!readOnly ? [{ id: 'danger', label: 'Danger zone', icon: Trash2 }] : []),
    ];
    const go = (id: string) => {
        setActiveSection(id);
        document.getElementById('ps-' + id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    const fieldLabel = 'text-sm font-medium text-foreground';
    const inputCls = 'h-11 rounded-xl bg-background border-border text-base';

    return (
        <div className="flex flex-col h-full w-full relative">
            <div className="flex-1 overflow-y-auto no-scrollbar pb-28">
                {/* ── cover ── */}
                <div className="relative">
                    <div className="h-36 sm:h-44 w-full relative overflow-hidden">
                        {imageUrl ? (
                            <>
                                <img src={imageUrl} alt="" aria-hidden className="absolute inset-0 h-full w-full object-cover scale-110 blur-xl opacity-70" />
                                <div className="absolute inset-0 bg-gradient-to-t from-background via-background/30 to-transparent" />
                            </>
                        ) : (
                            <div className={cn('absolute inset-0 opacity-90', getGradient(projectId))}>
                                <div className="absolute inset-0 bg-gradient-to-t from-background via-background/20 to-transparent" />
                            </div>
                        )}
                    </div>
                    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 -mt-14 sm:-mt-16 relative">
                        <div className="flex flex-wrap items-end gap-4 sm:gap-5">
                            <button
                                type="button"
                                disabled={readOnly}
                                onClick={() => fileInputRef.current?.click()}
                                aria-label="Change project picture"
                                className="group relative h-24 w-24 sm:h-28 sm:w-28 rounded-3xl overflow-hidden ring-4 ring-background shadow-lg shrink-0 disabled:cursor-default"
                            >
                                {imageUrl ? <img src={imageUrl} alt={title} className="h-full w-full object-cover" /> : <span className={cn('h-full w-full grid place-items-center', getGradient(projectId))}><Film className="h-10 w-10 text-white/90" /></span>}
                                {!readOnly && (
                                    <span className="absolute inset-0 bg-black/50 grid place-items-center opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 transition-opacity">
                                        {imageUploading ? <Loader2 className="h-6 w-6 text-white animate-spin" /> : <span className="text-white text-xs font-medium flex flex-col items-center gap-1"><Camera className="h-5 w-5" />Change</span>}
                                    </span>
                                )}
                            </button>
                            <input type="file" ref={fileInputRef} onChange={handleImageChange} accept="image/*" className="hidden" />
                            <div className="min-w-0 flex-1 pb-1">
                                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight truncate">{title || 'Untitled project'}</h1>
                                <div className="mt-2 flex flex-wrap items-center gap-2">
                                    <span className={cn('inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold', phase.tone)}><phase.icon className="h-3.5 w-3.5" />{phase.label}</span>
                                    <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-1 text-xs font-medium">{isPublic ? <Globe className="h-3.5 w-3.5 text-emerald-600" /> : <Lock className="h-3.5 w-3.5" />}{isPublic ? 'Public' : 'Private'}</span>
                                    {location && <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-1 text-xs font-medium"><MapPin className="h-3.5 w-3.5" />{location}</span>}
                                    {requiredRoles.length > 0 && <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-1 text-xs font-medium"><Users className="h-3.5 w-3.5" />Hiring {requiredRoles.length}</span>}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 mt-6 grid gap-6 lg:grid-cols-[210px_minmax(0,1fr)] items-start">
                    {/* ── anchors ── */}
                    <nav aria-label="Settings sections" className="flex lg:flex-col gap-1 overflow-x-auto no-scrollbar lg:sticky lg:top-4 -mx-1 px-1 pb-1">
                        {NAV.map((n) => {
                            const Icon = n.icon;
                            const active = activeSection === n.id;
                            return (
                                <button key={n.id} type="button" aria-current={active ? 'true' : undefined} onClick={() => go(n.id)}
                                    className={cn('flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm whitespace-nowrap transition-colors shrink-0', active ? (n.id === 'danger' ? 'bg-destructive/10 text-destructive font-semibold' : 'bg-primary/10 text-primary font-semibold') : n.id === 'danger' ? 'text-destructive/80 hover:bg-destructive/5' : 'text-muted-foreground hover:bg-muted hover:text-foreground')}>
                                    <Icon className="h-4 w-4 shrink-0" />{n.label}
                                </button>
                            );
                        })}
                    </nav>

                    <fieldset disabled={readOnly} className="contents">
                    <div className="space-y-6 min-w-0">
                        {/* ── basics ── */}
                        <Section id="basics" title="Basics" desc="How your project looks to everyone who finds it." icon={CircleUser}>
                            <div className="space-y-5">
                                <div className="space-y-2">
                                    <Label htmlFor="ps-title" className={fieldLabel}>Project title</Label>
                                    <Input id="ps-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="The Masterpiece" className={cn(inputCls, 'text-lg font-semibold h-12')} />
                                </div>
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between"><Label htmlFor="ps-syn" className={fieldLabel}>Story synopsis</Label><span className="text-xs text-muted-foreground tabular-nums">{description.length} characters</span></div>
                                    <Textarea id="ps-syn" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="A few lines about the story, the tone and what you are looking for." className="rounded-xl bg-background border-border min-h-[130px] resize-y text-base" />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="ps-loc" className={fieldLabel}>Shooting location</Label>
                                    <div className="relative">
                                        <MapPin className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                        <Input id="ps-loc" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Hyderabad, India" className={cn(inputCls, 'pl-10')} />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="ps-genre" className={fieldLabel}>Genres</Label>
                                    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-background p-2 focus-within:ring-2 focus-within:ring-ring">
                                        {genreList.map((g) => (
                                            <span key={g} className="inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary pl-3 pr-1.5 py-1 text-sm font-medium">
                                                {g}
                                                <button type="button" aria-label={`Remove ${g}`} onClick={() => setGenres(genreList.filter((x) => x !== g))} className="h-5 w-5 rounded-full grid place-items-center hover:bg-primary/20"><X className="h-3 w-3" /></button>
                                            </span>
                                        ))}
                                        <input
                                            id="ps-genre"
                                            value={genreDraft}
                                            onChange={(e) => setGenreDraft(e.target.value.replace(',', ''))}
                                            onKeyDown={(e) => {
                                                if ((e.key === 'Enter' || e.key === ',') && genreDraft.trim()) { e.preventDefault(); addGenre(genreDraft); setGenreDraft(''); }
                                                if (e.key === 'Backspace' && !genreDraft && genreList.length) setGenres(genreList.slice(0, -1));
                                            }}
                                            onBlur={() => { if (genreDraft.trim()) { addGenre(genreDraft); setGenreDraft(''); } }}
                                            placeholder={genreList.length ? 'Add another' : 'Type a genre and press Enter'}
                                            className="flex-1 min-w-[140px] bg-transparent outline-none text-base px-2 py-1"
                                        />
                                    </div>
                                    <div className="flex flex-wrap gap-1.5">
                                        {GENRE_SUGGESTIONS.filter((g) => !genreList.some((x) => x.toLowerCase() === g.toLowerCase())).map((g) => (
                                            <button key={g} type="button" onClick={() => addGenre(g)} className="inline-flex items-center gap-1 rounded-full border border-dashed border-border px-2.5 py-1 text-xs text-muted-foreground hover:text-foreground hover:border-primary/50 transition-colors"><Plus className="h-3 w-3" />{g}</button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </Section>

                        {/* ── roles ── */}
                        <Section id="roles" title="Open roles" desc="Pick the roles you are hiring for. People can apply to them from the marketplace." icon={Users}>
                            <div className="flex items-center justify-between mb-3">
                                <p className="text-sm text-muted-foreground"><span className="font-semibold text-foreground">{requiredRoles.length}</span> of {availableRoles.length} open</p>
                                {requiredRoles.length > 0 && !readOnly && <button type="button" onClick={() => setRequiredRoles([])} className="text-sm text-primary font-medium hover:underline">Clear all</button>}
                            </div>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                                {availableRoles.map((role) => {
                                    const on = requiredRoles.includes(role);
                                    return (
                                        <button key={role} type="button" role="checkbox" aria-checked={on} onClick={() => handleRoleToggle(role)}
                                            className={cn('flex items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left text-sm transition', on ? 'border-primary bg-primary/10 text-foreground font-semibold shadow-sm' : 'border-border bg-background text-muted-foreground hover:text-foreground hover:border-foreground/30')}>
                                            <span className={cn('h-5 w-5 rounded-md border grid place-items-center shrink-0 transition-colors', on ? 'bg-primary border-primary text-primary-foreground' : 'border-border')}>{on && <Check className="h-3.5 w-3.5" />}</span>
                                            <span className="truncate">{role}</span>
                                        </button>
                                    );
                                })}
                            </div>
                        </Section>

                        {/* ── budget and dates ── */}
                        <Section id="budget" title="Budget and dates" desc="Helps the right people decide if the project fits them." icon={Wallet}>
                            <div className="space-y-6">
                                <div>
                                    <div className="grid grid-cols-2 gap-4">
                                        {([['Minimum budget', budgetMin, setBudgetMin, 'ps-bmin'], ['Maximum budget', budgetMax, setBudgetMax, 'ps-bmax']] as const).map(([lbl, val, set, id]) => (
                                            <div key={id} className="space-y-2">
                                                <Label htmlFor={id} className={fieldLabel}>{lbl}</Label>
                                                <div className="relative">
                                                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                                                    <Input id={id} type="number" inputMode="numeric" min={0} value={val} onChange={(e) => set(e.target.value)} placeholder="0" aria-invalid={budgetProblem} className={cn(inputCls, 'pl-8 tabular-nums', budgetProblem && 'border-destructive')} />
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                    <p className={cn('text-sm mt-2.5', budgetProblem ? 'text-destructive' : 'text-muted-foreground')} role={budgetProblem ? 'alert' : undefined}>
                                        {budgetProblem ? 'The minimum is higher than the maximum.' : money(budgetMin) || money(budgetMax) ? `Shown as ${money(budgetMin) || '$0'} to ${money(budgetMax) || 'open'}` : 'Leave empty if you prefer not to share a budget.'}
                                    </p>
                                </div>
                                <div className="border-t border-border pt-6">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2"><Label htmlFor="ps-start" className={fieldLabel}>Production start</Label><Input id="ps-start" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={inputCls} /></div>
                                        <div className="space-y-2"><Label htmlFor="ps-end" className={fieldLabel}>Estimated wrap</Label><Input id="ps-end" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} aria-invalid={dateProblem} className={cn(inputCls, dateProblem && 'border-destructive')} /></div>
                                    </div>
                                    <p className={cn('text-sm mt-2.5 flex items-center gap-1.5', dateProblem ? 'text-destructive' : 'text-muted-foreground')} role={dateProblem ? 'alert' : undefined}>
                                        <CalendarRange className="h-4 w-4" />
                                        {dateProblem ? 'The wrap date is before the start date.' : days ? `${days} ${days === 1 ? 'day' : 'days'} of production` : 'Add both dates to see how long the shoot is.'}
                                    </p>
                                </div>
                            </div>
                        </Section>

                        {/* ── visibility and phase ── */}
                        <Section id="visibility" title="Visibility and phase" desc="Who can find the project, and where it is in its life." icon={Globe}>
                            <div className="space-y-6">
                                <div>
                                    <p className={cn(fieldLabel, 'mb-2.5')}>Who can see this project</p>
                                    <div role="radiogroup" aria-label="Visibility" className="grid sm:grid-cols-2 gap-3">
                                        {[{ v: true, t: 'Public', d: 'Listed in the marketplace so people can find it and apply.', icon: Globe }, { v: false, t: 'Private', d: 'Only your team can see it. Not listed anywhere.', icon: Lock }].map((o) => (
                                            <button key={o.t} type="button" role="radio" aria-checked={isPublic === o.v} onClick={() => setIsPublic(o.v)}
                                                className={cn('relative flex items-start gap-3 rounded-2xl border p-4 text-left transition', isPublic === o.v ? 'border-primary bg-primary/5 ring-1 ring-primary/30' : 'border-border hover:border-foreground/30')}>
                                                <span className={cn('h-10 w-10 rounded-xl grid place-items-center shrink-0', isPublic === o.v ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground')}><o.icon className="h-5 w-5" /></span>
                                                <span className="min-w-0"><span className="block font-semibold">{o.t}</span><span className="block text-sm text-muted-foreground mt-0.5">{o.d}</span></span>
                                                {isPublic === o.v && <span className="absolute top-3 right-3 h-5 w-5 rounded-full bg-primary text-primary-foreground grid place-items-center"><Check className="h-3 w-3" /></span>}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                <div>
                                    <p className={cn(fieldLabel, 'mb-2.5')}>Project phase</p>
                                    <div role="radiogroup" aria-label="Project phase" className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                                        {PHASES.map((p) => (
                                            <button key={p.id} type="button" role="radio" aria-checked={status === p.id} onClick={() => setStatus(p.id)}
                                                className={cn('rounded-2xl border p-3.5 text-left transition', status === p.id ? p.tone + ' ring-1 ring-current/20' : 'border-border hover:border-foreground/30')}>
                                                <p.icon className={cn('h-5 w-5 mb-2', status === p.id ? '' : 'text-muted-foreground')} />
                                                <span className={cn('block text-sm font-semibold', status !== p.id && 'text-foreground')}>{p.label}</span>
                                                <span className={cn('block text-xs mt-0.5', status === p.id ? 'opacity-80' : 'text-muted-foreground')}>{p.hint}</span>
                                            </button>
                                        ))}
                                    </div>
                                    {status === 'completed' && originalStatus !== 'completed' && (
                                        <p className="mt-3 rounded-xl bg-sky-500/10 border border-sky-500/30 text-sm px-3.5 py-2.5 text-foreground">When you save, you will be asked to credit your crew so the credits appear on their profiles.</p>
                                    )}
                                </div>
                            </div>
                        </Section>

                        {/* ── danger zone ── */}
                        {!readOnly && (
                            <Section id="danger" title="Danger zone" desc="These actions cannot be undone." icon={AlertTriangle} tone="danger">
                                <div className="divide-y divide-border rounded-xl border border-border overflow-hidden">
                                    <div className="flex flex-wrap items-center justify-between gap-4 p-4">
                                        <div className="min-w-0"><p className="font-semibold flex items-center gap-2"><MessageCircle className="h-4 w-4 text-muted-foreground" />Clear chat history</p><p className="text-sm text-muted-foreground mt-0.5">Deletes every message. Tasks, files, call sheets and the budget stay.</p></div>
                                        <AlertDialog>
                                            <AlertDialogTrigger asChild><Button type="button" variant="outline" className="h-10 rounded-xl font-semibold">Clear chat</Button></AlertDialogTrigger>
                                            <AlertDialogContent className="rounded-2xl p-6">
                                                <AlertDialogHeader>
                                                    <AlertDialogTitle className="text-xl font-bold">Clear all messages?</AlertDialogTitle>
                                                    <AlertDialogDescription className="text-base text-muted-foreground">Every message in this project will be deleted for everyone. Roles, shot lists and finances stay untouched.</AlertDialogDescription>
                                                </AlertDialogHeader>
                                                <AlertDialogFooter className="mt-4 gap-2">
                                                    <AlertDialogCancel className="h-11 rounded-xl font-semibold">Keep messages</AlertDialogCancel>
                                                    <AlertDialogAction onClick={handleClearChatHistory} className="h-11 rounded-xl font-semibold">Clear messages</AlertDialogAction>
                                                </AlertDialogFooter>
                                            </AlertDialogContent>
                                        </AlertDialog>
                                    </div>
                                    <div className="flex flex-wrap items-center justify-between gap-4 p-4 bg-destructive/5">
                                        <div className="min-w-0"><p className="font-semibold text-destructive flex items-center gap-2"><Trash2 className="h-4 w-4" />Delete this project</p><p className="text-sm text-muted-foreground mt-0.5">Erases the budget, shot lists, call sheets and chat. Everyone loses access.</p></div>
                                        <AlertDialog onOpenChange={(o) => { if (!o) setDeleteConfirm(''); }}>
                                            <AlertDialogTrigger asChild><Button type="button" variant="destructive" className="h-10 rounded-xl font-semibold">Delete project</Button></AlertDialogTrigger>
                                            <AlertDialogContent className="rounded-2xl p-6 border-destructive/30">
                                                <AlertDialogHeader>
                                                    <AlertDialogTitle className="text-xl font-bold">Delete "{title}"?</AlertDialogTitle>
                                                    <AlertDialogDescription className="text-base text-muted-foreground">This is permanent. To confirm, type the project name below.</AlertDialogDescription>
                                                </AlertDialogHeader>
                                                <Input value={deleteConfirm} onChange={(e) => setDeleteConfirm(e.target.value)} placeholder={title} aria-label="Type the project name to confirm" className="h-11 rounded-xl" />
                                                <AlertDialogFooter className="mt-4 gap-2">
                                                    <AlertDialogCancel className="h-11 rounded-xl font-semibold">Keep project</AlertDialogCancel>
                                                    <AlertDialogAction onClick={handleDelete} disabled={deleting || deleteConfirm.trim() !== title.trim()} className="h-11 rounded-xl font-semibold bg-destructive hover:bg-destructive/90 text-white gap-2">
                                                        {deleting && <Loader2 className="h-4 w-4 animate-spin" />}Delete forever
                                                    </AlertDialogAction>
                                                </AlertDialogFooter>
                                            </AlertDialogContent>
                                        </AlertDialog>
                                    </div>
                                </div>
                            </Section>
                        )}
                    </div>
                    </fieldset>
                </div>
            </div>

            {/* ── save bar: only when there is something to save ── */}
            {!readOnly && dirty && (
                <div className="absolute bottom-0 inset-x-0 z-40 px-4 pb-4 pt-8 pointer-events-none bg-gradient-to-t from-background via-background/80 to-transparent animate-in slide-in-from-bottom-4 duration-300">
                    <div role="status" className="pointer-events-auto max-w-2xl mx-auto flex items-center justify-between gap-3 rounded-2xl border border-border bg-card shadow-lg px-4 py-3">
                        <p className="text-sm font-medium flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-amber-500" />You have unsaved changes</p>
                        <div className="flex items-center gap-2">
                            <Button variant="ghost" onClick={fetchProjectDetails} disabled={saving} className="h-10 rounded-xl font-medium text-muted-foreground">Discard</Button>
                            <Button onClick={handleSave} disabled={saving || budgetProblem || dateProblem} className="h-10 rounded-xl px-5 font-semibold gap-2">
                                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}Save changes
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            <Dialog open={showWrapDialog} onOpenChange={setShowWrapDialog}>
                <DialogContent className="sm:max-w-2xl bg-card border-border rounded-2xl p-8 max-h-[85vh] overflow-y-auto no-scrollbar">
                    <DialogHeader>
                        <DialogTitle className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
                            <Film className="h-6 w-6 text-primary" /> Wrap project and tag crew
                        </DialogTitle>
                        <DialogDescription className="text-muted-foreground text-sm font-medium">
                            Officially wrap the production of "{title}". Tag the crew members below to publish locked verified credits directly to their profiles.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-6 py-4">
                        <div className="space-y-2">
                            <Label className="text-sm font-medium text-foreground ml-1">Tag Additional Crew Members</Label>
                            <div className="flex gap-2">
                                <Input
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    placeholder="Search by name to credit other users..."
                                    className="bg-background/50 border-border h-12 rounded-xl"
                                    onKeyDown={(e) => e.key === 'Enter' && searchExternalUsers()}
                                />
                                <Button aria-label="Search" onClick={searchExternalUsers} disabled={searchingUsers} className="bg-primary text-primary-foreground h-12 rounded-xl px-4">
                                    <Search className="h-4 w-4" />
                                </Button>
                            </div>

                            {searchResults.length > 0 && (
                                <div className="space-y-2 max-h-40 overflow-y-auto mt-2 bg-background/30 p-2 rounded-xl border border-border/40">
                                    {searchResults.map(user => (
                                        <div key={user.id} className="flex items-center justify-between p-2 hover:bg-accent/40 rounded-lg transition-colors">
                                            <div className="flex items-center gap-3">
                                                {user.avatar_url ? (
                                                    <img loading="lazy" decoding="async" src={user.avatar_url} alt={user.full_name} className="h-8 w-8 rounded-full object-cover" />
                                                ) : (
                                                    <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-xs">
                                                        {user.full_name[0].toUpperCase()}
                                                    </div>
                                                )}
                                                <div>
                                                    <p className="text-sm font-bold text-foreground">{user.full_name}</p>
                                                    <p className="text-[12px] text-muted-foreground">@{user.username}</p>
                                                </div>
                                            </div>
                                            <Button size="sm" onClick={() => addExternalCrew(user)} className="bg-primary/20 text-primary hover:bg-primary/30 border border-primary/20 rounded-lg text-xs font-bold py-1 h-10 md:h-8">
                                                Add Credit
                                            </Button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="space-y-3">
                            <Label className="text-sm font-medium text-foreground ml-1">Credits Roll</Label>
                            {loadingCrew ? (
                                <div className="text-center py-6 text-muted-foreground">Loading crew list...</div>
                            ) : crewList.length === 0 ? (
                                <div className="text-center py-6 text-muted-foreground text-xs italic bg-background/20 rounded-2xl border border-dashed border-border/50">
                                    No crew members to tag. Wrap anyway or search above.
                                </div>
                            ) : (
                                <div className="space-y-3 max-h-[40vh] overflow-y-auto pr-1">
                                    {crewList.map((crew, idx) => (
                                        <div key={crew.user_id + '-' + idx} className="flex items-center justify-between gap-4 p-4 bg-background/30 border border-border/50 rounded-2xl hover:border-primary/20 transition">
                                            <div className="flex items-center gap-3 min-w-0">
                                                <Checkbox
                                                    checked={crew.selected}
                                                    onCheckedChange={(checked) => {
                                                        setCrewList(prev => prev.map((c, i) => i === idx ? { ...c, selected: !!checked } : c));
                                                    }}
                                                    className="data-[state=checked]:bg-primary rounded"
                                                />
                                                {crew.avatar_url ? (
                                                    <img loading="lazy" decoding="async" src={crew.avatar_url} alt={crew.full_name} className="h-9 w-9 rounded-full object-cover shrink-0" />
                                                ) : (
                                                    <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold shrink-0">
                                                        {crew.full_name[0].toUpperCase()}
                                                    </div>
                                                )}
                                                <span className="font-bold text-sm text-foreground truncate">{crew.full_name}</span>
                                            </div>

                                            <div className="flex items-center gap-2">
                                                <Label className="text-[12px] font-bold text-muted-foreground shrink-0">Credit Role:</Label>
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
                            className="bg-primary hover:bg-primary/95 text-white font-bold text-xs px-8 h-12 rounded-xl shadow-sm"
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

