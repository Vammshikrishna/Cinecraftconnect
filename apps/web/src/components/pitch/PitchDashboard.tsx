import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useCallCreatorSubmissions, useMyPitchSubmissions, PITCH_STATUS_LABELS } from '@/hooks/usePitch';
import { SubmissionReviewDialog } from './SubmissionReviewDialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PitchSubmission } from '@/hooks/usePitch';
import { getSafeImageUrl } from '@/services/tmdb';
import {
    Search, FileText, Clock, MessageSquare, ChevronRight,
    Inbox, Sparkles, Star, ArrowUpRight, Megaphone, Upload, CheckCircle2, Loader2, Download, Pencil, Undo2, FileText as FileTextIcon
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';
import { CardSkeleton } from '@/components/ui/enhanced-skeleton';
import { useAppNavigation } from '@/contexts/NavigationContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { UnifiedSearchBar } from '@/components/ui/unified-search-bar';
import { submissionsToCsv, canEditPitch, canWithdrawPitch, withdrawPitchSubmission, friendlyError } from '@cinecraft/core';
import { ComparePitchesDialog } from './ComparePitchesDialog';
import { openNdaRecord } from '@/lib/ndaRecord';
import { BULK_STATUSES, bulkUpdateStatus } from '@cinecraft/core';

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
    { value: 'withdrawn', label: 'Withdrawn' },
];

// ─── CALL CREATOR REVIEW DASHBOARD ───────────────────────────────────────────
export const CallCreatorPitchInbox = () => {
    const { submissions, loading, error, refetch } = useCallCreatorSubmissions();
    const { toast } = useToast();
    const [selectMode, setSelectMode] = useState(false);
    const [selected, setSelected] = useState<string[]>([]);
    const [compareOpen, setCompareOpen] = useState(false);
    const [bulkBusy, setBulkBusy] = useState(false);
    const toggleSelected = (id: string) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
    const leaveSelect = () => { setSelectMode(false); setSelected([]); };
    const applyBulk = async (status: string, label: string) => {
        if (!window.confirm(`${label} ${selected.length} pitch${selected.length > 1 ? 'es' : ''}? The writers will be told.`)) return;
        setBulkBusy(true);
        try {
            const n = await bulkUpdateStatus(supabase, selected, status);
            toast({ title: `${n} pitch${n === 1 ? '' : 'es'} updated` });
            leaveSelect();
            refetch?.();
        } catch (e: any) {
            toast({ title: 'Could not update', description: friendlyError(e), variant: 'destructive' });
        } finally { setBulkBusy(false); }
    };
    const { push } = useAppNavigation();
    const location = useLocation();
    const params = new URLSearchParams(location.search);
    const filterPitchCallId = params.get('pitchCallId');

    const [statusFilter, setStatusFilter] = useState('all');
    const [searchQuery, setSearchQuery] = useState('');

    // the calls that have pitches, for the "which call" picker
    const callOptions = Array.from(
        new Map(submissions.map(s => [s.pitch_call_id, (s as any).pitch_calls?.attachments?.is_direct_catcher ? 'Direct pitches' : ((s as any).pitch_calls?.title || 'Pitch call')])).entries()
    );
    const pickCall = (id: string) => push(id ? `/pitch?tab=inbox&pitchCallId=${id}` : '/pitch?tab=inbox');

    const filtered = submissions.filter(s => {
        const matchesPitchCall = !filterPitchCallId || s.pitch_call_id === filterPitchCallId;
        // withdrawn pitches are only shown when you ask for them
        const matchesStatus = statusFilter === 'all' ? s.status !== 'withdrawn' : s.status === statusFilter;
        const matchesSearch = !searchQuery ||
            s.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
            s.profiles?.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            s.logline.toLowerCase().includes(searchQuery.toLowerCase());
        return matchesPitchCall && matchesStatus && matchesSearch;
    });

    const newCount = submissions.filter(s => s.status === 'submitted').length;
    const shortlistedCount = submissions.filter(s => s.status === 'shortlisted').length;
    const reviewCount = submissions.filter(s => s.status === 'under_review').length;

    const exportCsv = () => {
        const blob = new Blob(['\ufeff' + submissionsToCsv(filtered)], { type: 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `pitches-${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    if (loading) return (
        <div className="grid gap-3">
            {[1, 2, 3].map(i => <CardSkeleton key={i} />)}
        </div>
    );

    if (error && submissions.length === 0) return (
        <div className="text-center py-16">
            <p className="font-bold text-foreground/80">Could not load your inbox</p>
            <p className="text-sm text-muted-foreground mt-1">Check your connection and try again.</p>
            <Button variant="outline" className="mt-4 rounded-full" onClick={() => refetch?.()}>Try again</Button>
        </div>
    );

    const countFor = (value: string) =>
        value === 'all' ? submissions.filter(s => s.status !== 'withdrawn').length : submissions.filter(s => s.status === value).length;

    return (
        <div className="space-y-6">
            {filterPitchCallId && (
                <div className="flex items-center justify-between bg-amber-500/10 border border-amber-500/20 px-4 py-2.5 rounded-xl text-xs font-bold text-amber-600 dark:text-amber-400">
                    <span>Showing pitches for selected pitch call</span>
                    <button
                        onClick={() => push('/pitch?tab=inbox')}
                        className="hover:underline text-[12px] font-bold text-primary"
                    >
                        Show All Submissions
                    </button>
                </div>
            )}

            {/* Stats Row */}
            <div className="grid grid-cols-3 gap-3">
                {[
                    { label: 'Total Pitches', value: submissions.filter(s => s.status !== 'withdrawn').length, color: 'text-primary', bg: 'bg-primary/10 border-primary/20' },
                    { label: 'New / Unread', value: newCount, color: 'text-blue-400', bg: 'bg-blue-400/10 border-blue-400/20' },
                    { label: 'Shortlisted', value: shortlistedCount, color: 'text-green-500', bg: 'bg-green-500/10 border-green-500/20' },
                ].map((stat, i) => (
                    <div key={i} className={`rounded-2xl border p-4 text-center ${stat.bg}`}>
                        <p className={`text-3xl font-black ${stat.color}`}>{stat.value}</p>
                        <p className="text-[12px] font-black uppercase tracking-widest text-muted-foreground/70 mt-1">{stat.label}</p>
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
                                    'flex items-center justify-between px-4 py-2.5 rounded-xl text-sm font-bold transition w-full text-left',
                                    statusFilter === f.value
                                        ? 'bg-primary text-primary-foreground shadow-md shadow-primary/20'
                                        : 'bg-muted/40 text-muted-foreground hover:bg-muted/70 border border-border/40'
                                )}
                            >
                                <span>{f.label}</span>
                                {f.value === 'submitted' && newCount > 0 && (
                                    <span className="bg-blue-500 text-white rounded-full px-2 py-0.5 text-[12px] font-black">
                                        {newCount}
                                    </span>
                                )}
                            </button>
                        ))}
                    </div>
                }
            />

            {/* Quick status chips with counts */}
            <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
                {STATUS_FILTERS.filter(f => f.value === 'all' || f.value === statusFilter || countFor(f.value) > 0).map(f => (
                    <button
                        key={f.value}
                        onClick={() => setStatusFilter(f.value)}
                        className={cn(
                            'shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-bold transition',
                            statusFilter === f.value ? 'bg-primary text-primary-foreground border-primary' : 'bg-card text-muted-foreground border-border/50 hover:bg-muted/50'
                        )}
                    >
                        {f.label} <span className="opacity-70">{countFor(f.value)}</span>
                    </button>
                ))}
            </div>

            {callOptions.length > 1 && (
                <select
                    aria-label="Show pitches for"
                    value={filterPitchCallId || ''}
                    onChange={(e) => pickCall(e.target.value)}
                    className="h-10 w-full sm:w-auto rounded-xl border border-border/50 bg-card px-3 text-sm font-semibold"
                >
                    <option value="">All my pitch calls</option>
                    {callOptions.map(([id, title]) => <option key={id} value={id}>{title}</option>)}
                </select>
            )}

            {filtered.length > 0 && (
                <div className="flex flex-wrap justify-end gap-2">
                    <Button variant={selectMode ? 'default' : 'outline'} size="sm" className="rounded-full" onClick={() => (selectMode ? leaveSelect() : setSelectMode(true))}>
                        {selectMode ? 'Done selecting' : 'Select'}
                    </Button>
                    <Button variant="outline" size="sm" className="gap-2 rounded-full" onClick={exportCsv}>
                        <Download className="h-4 w-4" /> Export {filtered.length} as spreadsheet
                    </Button>
                </div>
            )}

            {selectMode && (
                <div className="sticky top-2 z-20 flex flex-wrap items-center gap-2 rounded-2xl border border-primary/30 bg-card/95 backdrop-blur p-3 shadow-lg" role="toolbar" aria-label="Bulk actions">
                    <span className="text-sm font-bold mr-auto">{selected.length} selected</span>
                    <Button size="sm" variant="outline" disabled={selected.length < 2 || selected.length > 3} onClick={() => setCompareOpen(true)}>Compare (2-3)</Button>
                    {BULK_STATUSES.map((b) => (
                        <Button key={b.value} size="sm" variant="secondary" disabled={selected.length === 0 || bulkBusy} onClick={() => applyBulk(b.value, b.label)}>{b.label}</Button>
                    ))}
                </div>
            )}

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
                    <p className="font-bold text-foreground/80">{submissions.length === 0 ? 'No submissions yet' : 'No pitches match'}</p>
                    <p className="text-sm text-muted-foreground mt-1">
                        {submissions.length === 0
                            ? 'Pitches will appear here as writers submit to your calls'
                            : searchQuery ? 'Try a different search term' : 'Try another status or pitch call'}
                    </p>
                    {submissions.length > 0 && (statusFilter !== 'all' || searchQuery || filterPitchCallId) && (
                        <Button variant="outline" size="sm" className="mt-4 rounded-full" onClick={() => { setStatusFilter('all'); setSearchQuery(''); if (filterPitchCallId) pickCall(''); }}>
                            Clear filters
                        </Button>
                    )}
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
                                    onClick={() => (selectMode ? toggleSelected(submission.id) : push(`/pitch/submission/${submission.id}/review`))}
                                    className={cn(
                                        'relative bg-card border rounded-2xl p-5 cursor-pointer transition group hover:shadow-lg',
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
                                        {selectMode && (
                                            <input type="checkbox" className="mt-3 h-5 w-5 shrink-0 accent-primary" checked={selected.includes(submission.id)} onChange={() => toggleSelected(submission.id)} onClick={(e) => e.stopPropagation()} aria-label={`Select ${submission.title}`} />
                                        )}
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
                                                <Badge className={cn('text-[12px] font-bold shrink-0', statusInfo?.color || '')}>
                                                    {statusInfo?.label || submission.status}
                                                </Badge>
                                            </div>

                                            {/* Which pitch call this is for */}
                                            {(submission as any).pitch_calls?.attachments?.is_direct_catcher ? (
                                                <div className="flex items-center gap-1.5 mt-2 px-2.5 py-1.5 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                                                    <Sparkles className="h-3 w-3 text-amber-500 shrink-0" />
                                                    <p className="text-[12px] font-bold text-amber-600 dark:text-amber-500 truncate">
                                                        Direct Pitch (Private Submission)
                                                    </p>
                                                </div>
                                            ) : (submission as any).pitch_calls?.title && (
                                                <div className="flex items-center gap-1.5 mt-2 px-2.5 py-1.5 bg-primary/5 border border-primary/15 rounded-lg">
                                                    <Megaphone className="h-3 w-3 text-primary/70 shrink-0" />
                                                    <p className="text-[12px] font-bold text-primary/80 truncate">
                                                        For: {(submission as any).pitch_calls.title}
                                                    </p>
                                                </div>
                                            )}

                                            <p className="text-xs text-muted-foreground/80 mt-2 line-clamp-1 italic">"{submission.logline}"</p>

                                            <div className="flex items-center gap-3 mt-3 text-[12px] text-muted-foreground/70">
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

                                        <ChevronRight className="h-4 w-4 text-muted-foreground/40 shrink-0 mt-1 group-hover:text-primary group-hover:translate-x-0.5 transition" />
                                    </div>
                                </motion.div>
                            );
                        })}
                    </AnimatePresence>
                </div>
            )}

            <ComparePitchesDialog
                open={compareOpen}
                onClose={() => setCompareOpen(false)}
                submissions={submissions.filter((s) => selected.includes(s.id))}
                onOpen={(id) => { setCompareOpen(false); push(`/pitch/submission/${id}/review`); }}
            />
        </div>
    );
};

// ─── WRITER'S PITCH TRACKER ──────────────────────────────────────────────────
export const WriterPitchTracker = () => {
    const { submissions, loading, refetch } = useMyPitchSubmissions();
    const { push } = useAppNavigation();
    const { toast } = useToast();
    const [uploadingDeck, setUploadingDeck] = useState<string | null>(null);

    const handleWithdraw = async (id: string) => {
        if (!window.confirm('Withdraw this pitch? The producer will no longer be able to open it. You can pitch to the call again later if it is still open.')) return;
        try {
            await withdrawPitchSubmission(supabase, id);
            toast({ title: 'Pitch withdrawn' });
            refetch?.();
        } catch (e: any) {
            toast({ title: 'Could not withdraw', description: friendlyError(e), variant: 'destructive' });
        }
    };
    const [selectedSubmission, setSelectedSubmission] = useState<PitchSubmission | null>(null);

    const handleUploadDeck = async (submissionId: string, event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;
        try {
            setUploadingDeck(submissionId);
            let fileToUpload = file;
            if (file.type.startsWith('image/')) {
                const { compressImage } = await import('@/utils/imageCompression');
                fileToUpload = await compressImage(file);
            }
            const fileExt = fileToUpload.name.split('.').pop();
            const fileName = `${submissionId}-full-deck-${Date.now()}.${fileExt}`;
            const { error: uploadError } = await supabase.storage.from('pitch_assets').upload(fileName, fileToUpload, {
                cacheControl: '31536000',
                upsert: false
            });
            if (uploadError) throw uploadError;

            // Bucket is private: store the object path; viewers receive short-lived signed URLs.
            const { error: dbError } = await supabase.from('pitch_submissions').update({ full_deck_url: `pitch_assets:${fileName}` } as any).eq('id', submissionId);
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
                        onClick={() => setSelectedSubmission(sub)}
                        className={cn(
                            'bg-card border rounded-2xl p-5 transition cursor-pointer hover:shadow-md',
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
                                        onClick={(e) => { e.stopPropagation(); push(`/pitch/${sub.pitch_call_id}`); }}
                                    >
                                        {sub.pitch_calls?.title}
                                    </span>
                                </p>
                                <p className="text-xs text-muted-foreground/70 mt-1.5 italic line-clamp-1">"{sub.logline}"</p>
                                <div className="flex items-center gap-2 mt-3 text-[12px] text-muted-foreground/60">
                                    <Clock className="h-3 w-3" />
                                    {formatDistanceToNow(new Date(sub.submitted_at), { addSuffix: true })}
                                </div>
                                {(sub as any).feedback && (
                                    <div className="mt-3 rounded-xl border border-primary/20 bg-primary/5 p-3 text-xs">
                                        <p className="font-black uppercase tracking-widest text-[12px] text-primary mb-1">Message from the producer</p>
                                        <p className="text-foreground/90 whitespace-pre-wrap">{(sub as any).feedback}</p>
                                    </div>
                                )}
                                {(canEditPitch(sub.status) || canWithdrawPitch(sub.status) || (sub as any).nda_signature) && (
                                    <div className="flex gap-2 mt-3" onClick={(e) => e.stopPropagation()}>
                                        {(sub as any).nda_signature && (
                                            <Button size="sm" variant="ghost" className="h-10 md:h-8 text-xs rounded-lg gap-1 text-muted-foreground" onClick={async () => { if (!(await openNdaRecord(sub.id))) toast({ title: 'Could not open the NDA record', variant: 'destructive' }); }}>
                                                <FileTextIcon className="h-3 w-3" /> NDA record
                                            </Button>
                                        )}
                                        {canEditPitch(sub.status) && (
                                            <Button size="sm" variant="outline" className="h-10 md:h-8 text-xs rounded-lg gap-1" onClick={() => push(`/pitch/${sub.pitch_call_id}/submit?edit=${sub.id}`)}>
                                                <Pencil className="h-3 w-3" /> Edit
                                            </Button>
                                        )}
                                        {canWithdrawPitch(sub.status) && (
                                            <Button size="sm" variant="ghost" className="h-10 md:h-8 text-xs rounded-lg gap-1 text-muted-foreground" onClick={() => handleWithdraw(sub.id)}>
                                                <Undo2 className="h-3 w-3" /> Withdraw
                                            </Button>
                                        )}
                                    </div>
                                )}
                            </div>

                            <div className="flex flex-col items-end gap-2 shrink-0">
                                <Badge className={cn('text-[12px] font-bold', statusInfo?.color || '')}>
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
                                    <div className="flex items-center gap-1 text-[12px] text-green-500 font-bold">
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
                                                    <div onClick={(e) => e.stopPropagation()}>
                                                        {uploadingDeck === sub.id ? (
                                                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                                        ) : (
                                                            <Upload className="h-4 w-4 mr-2" />
                                                        )}
                                                        Upload Full Deck (PDF)
                                                    </div>
                                                </Button>
                                                <p className="text-[12px] text-muted-foreground mt-1 text-right italic">
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
            
            {selectedSubmission && (
                <SubmissionReviewDialog
                    submission={selectedSubmission}
                    isOpen={!!selectedSubmission}
                    onClose={() => setSelectedSubmission(null)}
                    onUpdateStatus={() => {}}
                    ndaRequired={!!selectedSubmission.pitch_calls?.nda_required}
                />
            )}
        </div>
    );
};
