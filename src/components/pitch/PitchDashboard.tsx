import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useCallCreatorSubmissions, useMyPitchSubmissions, PITCH_STATUS_LABELS } from '@/hooks/usePitch';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PitchSubmission } from '@/hooks/usePitch';
import { getSafeImageUrl } from '@/services/tmdb';
import {
    Search, FileText, Clock, MessageSquare, ChevronRight,
    Inbox, Sparkles, Star, ArrowUpRight, Megaphone, Upload, CheckCircle2, Loader2
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';
import { CardSkeleton } from '@/components/ui/enhanced-skeleton';
import { useAppNavigation } from '@/contexts/NavigationContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { UnifiedSearchBar } from '@/components/ui/unified-search-bar';

const STATUS_FILTERS = [
    { value: 'all', label: 'All' },
    { value: 'submitted', label: 'New' },
    { value: 'seen', label: 'Seen' },
    { value: 'under_review', label: 'Under Review' },
    { value: 'shortlisted', label: 'Shortlisted' },
    { value: 'interested', label: 'Interested' },
    { value: 'request_full_deck', label: 'Full Deck' },
    { value: 'invite_to_discuss', label: 'Invited' },
    { value: 'passed', label: 'Passed' },
    { value: 'collaborating', label: 'Collaborating' },
];

// ─── CALL CREATOR REVIEW DASHBOARD ───────────────────────────────────────────
export const CallCreatorPitchInbox = () => {
    const { submissions, loading } = useCallCreatorSubmissions();
    const { push } = useAppNavigation();
    const [statusFilter, setStatusFilter] = useState('all');
    const [searchQuery, setSearchQuery] = useState('');

    const filtered = submissions.filter(s => {
        const matchesStatus = statusFilter === 'all' || s.status === statusFilter;
        const matchesSearch = !searchQuery ||
            s.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
            s.profiles?.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            s.logline.toLowerCase().includes(searchQuery.toLowerCase());
        return matchesStatus && matchesSearch;
    });

    const newCount = submissions.filter(s => s.status === 'submitted').length;
    const shortlistedCount = submissions.filter(s => s.status === 'shortlisted').length;
    const reviewCount = submissions.filter(s => s.status === 'under_review').length;

    if (loading) return (
        <div className="grid gap-3">
            {[1, 2, 3].map(i => <CardSkeleton key={i} />)}
        </div>
    );

    return (
        <div className="space-y-6">
            {/* Stats Row */}
            <div className="grid grid-cols-3 gap-3">
                {[
                    { label: 'Total Pitches', value: submissions.length, color: 'text-primary', bg: 'bg-primary/10 border-primary/20' },
                    { label: 'New / Unread', value: newCount, color: 'text-blue-400', bg: 'bg-blue-400/10 border-blue-400/20' },
                    { label: 'Shortlisted', value: shortlistedCount, color: 'text-green-500', bg: 'bg-green-500/10 border-green-500/20' },
                ].map((stat, i) => (
                    <div key={i} className={`rounded-2xl border p-4 text-center ${stat.bg}`}>
                        <p className={`text-3xl font-black ${stat.color}`}>{stat.value}</p>
                        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/70 mt-1">{stat.label}</p>
                    </div>
                ))}
            </div>

            {/* Search + Filter Bar */}
            <UnifiedSearchBar
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
                searchPlaceholder="Search by title, writer or logline…"
                hasActiveFilters={statusFilter !== 'all'}
                filterTitle="Filter Status"
                filterContent={
                    <div className="flex flex-col gap-2">
                        {STATUS_FILTERS.map(f => (
                            <button
                                key={f.value}
                                onClick={() => setStatusFilter(f.value)}
                                className={cn(
                                    'flex items-center justify-between px-4 py-2.5 rounded-xl text-sm font-bold transition-all w-full text-left',
                                    statusFilter === f.value
                                        ? 'bg-primary text-primary-foreground shadow-md shadow-primary/20'
                                        : 'bg-muted/40 text-muted-foreground hover:bg-muted/70 border border-border/40'
                                )}
                            >
                                <span>{f.label}</span>
                                {f.value === 'submitted' && newCount > 0 && (
                                    <span className="bg-blue-500 text-white rounded-full px-2 py-0.5 text-[10px] font-black">
                                        {newCount}
                                    </span>
                                )}
                            </button>
                        ))}
                    </div>
                }
            />

            {/* Submission List */}
            {filtered.length === 0 ? (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="text-center py-20"
                >
                    <div className="h-16 w-16 rounded-2xl bg-muted/30 border border-border/40 flex items-center justify-center mx-auto mb-4">
                        <Inbox className="h-8 w-8 text-muted-foreground/40" />
                    </div>
                    <p className="font-bold text-foreground/80">No submissions yet</p>
                    <p className="text-sm text-muted-foreground mt-1">
                        {searchQuery ? 'Try a different search term' : 'Pitches will appear here as writers submit to your calls'}
                    </p>
                </motion.div>
            ) : (
                <div className="space-y-3">
                    <AnimatePresence>
                        {filtered.map((submission, i) => {
                            const statusInfo = PITCH_STATUS_LABELS[submission.status || 'submitted'];
                            const avatarUrl = getSafeImageUrl(submission.profiles?.avatar_url || null);
                            const initials = (submission.profiles?.full_name || 'W').split(' ').map(n => n[0]).join('').toUpperCase();
                            const isNew = submission.status === 'submitted';
                            return (
                                <motion.div
                                    key={submission.id}
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: i * 0.04 }}
                                    onClick={() => push(`/pitch/submission/${submission.id}/review`)}
                                    className={cn(
                                        'relative bg-card border rounded-2xl p-5 cursor-pointer transition-all group hover:shadow-lg',
                                        isNew
                                            ? 'border-primary/30 hover:border-primary/50 hover:shadow-primary/10'
                                            : 'border-border/50 hover:border-border'
                                    )}
                                >
                                    {/* New indicator stripe */}
                                    {isNew && (
                                        <div className="absolute left-0 top-4 bottom-4 w-1 bg-primary rounded-r-full" />
                                    )}

                                    <div className="flex items-start gap-4 pl-1">
                                        <Avatar className="h-11 w-11 shrink-0 rounded-xl ring-2 ring-border/30">
                                            <AvatarImage src={avatarUrl || undefined} />
                                            <AvatarFallback className="bg-primary/10 text-primary font-black text-sm rounded-xl">{initials}</AvatarFallback>
                                        </Avatar>

                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-start justify-between gap-3">
                                                <div className="min-w-0">
                                                    <p className="font-black text-sm text-foreground leading-tight">{submission.title}</p>
                                                    <p className="text-xs text-muted-foreground mt-0.5">by <span className="font-semibold text-foreground/80">{submission.profiles?.full_name}</span></p>
                                                </div>
                                                <Badge className={cn('text-[10px] font-bold shrink-0', statusInfo?.color || '')}>
                                                    {statusInfo?.label || submission.status}
                                                </Badge>
                                            </div>

                                            {/* Which pitch call this is for */}
                                            {(submission as any).pitch_calls?.title && (
                                                <div className="flex items-center gap-1.5 mt-2 px-2.5 py-1.5 bg-primary/5 border border-primary/15 rounded-lg">
                                                    <Megaphone className="h-3 w-3 text-primary/70 shrink-0" />
                                                    <p className="text-[11px] font-bold text-primary/80 truncate">
                                                        For: {(submission as any).pitch_calls.title}
                                                    </p>
                                                </div>
                                            )}

                                            <p className="text-xs text-muted-foreground/80 mt-2 line-clamp-1 italic">"{submission.logline}"</p>

                                            <div className="flex items-center gap-3 mt-3 text-[11px] text-muted-foreground/70">
                                                <span className="flex items-center gap-1">
                                                    <Clock className="h-3 w-3" />
                                                    {formatDistanceToNow(new Date(submission.submitted_at), { addSuffix: true })}
                                                </span>
                                                {submission.genre && (
                                                    <span className="bg-muted/40 px-2 py-0.5 rounded-full font-medium">{submission.genre}</span>
                                                )}
                                                {submission.language && (
                                                    <span className="bg-muted/40 px-2 py-0.5 rounded-full font-medium">{submission.language}</span>
                                                )}
                                            </div>
                                        </div>

                                        <ChevronRight className="h-4 w-4 text-muted-foreground/40 shrink-0 mt-1 group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
                                    </div>
                                </motion.div>
                            );
                        })}
                    </AnimatePresence>
                </div>
            )}
        </div>
    );
};

// ─── WRITER'S PITCH TRACKER ──────────────────────────────────────────────────
export const WriterPitchTracker = () => {
    const { submissions, loading, refetch } = useMyPitchSubmissions();
    const { push } = useAppNavigation();
    const { toast } = useToast();
    const [uploadingDeck, setUploadingDeck] = useState<string | null>(null);

    const handleUploadDeck = async (submissionId: string, event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;
        try {
            setUploadingDeck(submissionId);
            const fileExt = file.name.split('.').pop();
            const fileName = `${submissionId}-full-deck-${Date.now()}.${fileExt}`;
            const { error: uploadError } = await supabase.storage.from('pitch_assets').upload(fileName, file);
            if (uploadError) throw uploadError;

            const { data: { publicUrl } } = supabase.storage.from('pitch_assets').getPublicUrl(fileName);
            
            const { error: dbError } = await supabase.from('pitch_submissions').update({ full_deck_url: publicUrl } as any).eq('id', submissionId);
            if (dbError) throw dbError;
            
            toast({ title: 'Full deck submitted successfully!' });
            
            if (refetch) refetch();
        } catch (err) {
            console.error('Upload error:', err);
            toast({ title: 'Upload failed', description: 'Could not upload your full deck.', variant: 'destructive' });
        } finally {
            setUploadingDeck(null);
        }
    };

    if (loading) return (
        <div className="grid gap-3">
            {[1, 2, 3].map(i => <CardSkeleton key={i} />)}
        </div>
    );

    if (submissions.length === 0) return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center py-20"
        >
            <div className="h-16 w-16 rounded-2xl bg-muted/30 border border-border/40 flex items-center justify-center mx-auto mb-4">
                <Sparkles className="h-8 w-8 text-muted-foreground/40" />
            </div>
            <p className="font-bold text-foreground/80">No pitches submitted yet</p>
            <p className="text-sm text-muted-foreground mt-1 mb-5">Browse pitch calls and share your story with the industry</p>
            <Button onClick={() => push('/pitch')} className="rounded-full font-bold px-6">
                Browse Pitch Calls
                <ArrowUpRight className="ml-2 h-4 w-4" />
            </Button>
        </motion.div>
    );

    return (
        <div className="space-y-3">
            {submissions.map((sub, i) => {
                const statusInfo = PITCH_STATUS_LABELS[sub.status || 'submitted'];
                const isPositive = ['shortlisted', 'interested', 'invite_to_discuss', 'collaborating', 'request_full_deck'].includes(sub.status || '');
                return (
                    <motion.div
                        key={sub.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.04 }}
                        className={cn(
                            'bg-card border rounded-2xl p-5 transition-all',
                            isPositive ? 'border-green-500/20 bg-green-500/3' : 'border-border/50'
                        )}
                    >
                        <div className="flex items-start justify-between gap-4">
                            <div className="flex-1 min-w-0">
                                <p className="font-black text-sm text-foreground">{sub.title}</p>
                                <p className="text-xs text-muted-foreground mt-1">
                                    Pitched to:{' '}
                                    <span
                                        className="font-semibold text-primary cursor-pointer hover:underline"
                                        onClick={() => push(`/pitch/${sub.pitch_call_id}`)}
                                    >
                                        {sub.pitch_calls?.title}
                                    </span>
                                </p>
                                <p className="text-xs text-muted-foreground/70 mt-1.5 italic line-clamp-1">"{sub.logline}"</p>
                                <div className="flex items-center gap-2 mt-3 text-[11px] text-muted-foreground/60">
                                    <Clock className="h-3 w-3" />
                                    {formatDistanceToNow(new Date(sub.submitted_at), { addSuffix: true })}
                                </div>
                            </div>

                            <div className="flex flex-col items-end gap-2 shrink-0">
                                <Badge className={cn('text-[10px] font-bold', statusInfo?.color || '')}>
                                    {statusInfo?.label || sub.status}
                                </Badge>
                                {sub.status === 'collaborating' && (
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        className="text-xs rounded-lg border-green-500/30 text-green-500 hover:bg-green-500/10"
                                        onClick={() => push(`/dm/${sub.pitch_call_id}`)}
                                    >
                                        <MessageSquare className="h-3 w-3 mr-1" /> Collaborate
                                    </Button>
                                )}
                                {isPositive && sub.status !== 'collaborating' && (
                                    <div className="flex items-center gap-1 text-[10px] text-green-500 font-bold">
                                        <Star className="h-3 w-3 fill-green-500" /> Good news!
                                    </div>
                                )}
                                {sub.status === 'request_full_deck' && (
                                    <div className="mt-2 w-full flex justify-end">
                                        {(sub as any).full_deck_url ? (
                                            <div className="flex items-center gap-1.5 text-xs text-green-500 font-bold bg-green-500/10 px-3 py-1.5 rounded-lg border border-green-500/20">
                                                <CheckCircle2 className="h-4 w-4" /> Deck Submitted
                                            </div>
                                        ) : (
                                            <label className="cursor-pointer">
                                                <Input 
                                                    type="file" 
                                                    accept=".pdf" 
                                                    className="hidden" 
                                                    onChange={(e) => handleUploadDeck(sub.id, e)} 
                                                    disabled={uploadingDeck === sub.id} 
                                                />
                                                <Button
                                                    size="sm"
                                                    variant="default"
                                                    className="text-xs rounded-lg bg-primary hover:bg-primary/90"
                                                    disabled={uploadingDeck === sub.id}
                                                    asChild
                                                >
                                                    <div>
                                                        {uploadingDeck === sub.id ? (
                                                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                                        ) : (
                                                            <Upload className="h-4 w-4 mr-2" />
                                                        )}
                                                        Upload Full Deck (PDF)
                                                    </div>
                                                </Button>
                                                <p className="text-[9px] text-muted-foreground mt-1 text-right italic">
                                                    Protected by NDA & account timestamp.
                                                </p>
                                            </label>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    </motion.div>
                );
            })}
        </div>
    );
};
