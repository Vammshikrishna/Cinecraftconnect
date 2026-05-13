import { useState } from 'react';
import { useCallCreatorSubmissions, useMyPitchSubmissions, PITCH_STATUS_LABELS } from '@/hooks/usePitch';
import { SubmissionReviewDialog } from './SubmissionReviewDialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PitchSubmission } from '@/hooks/usePitch';
import { getSafeImageUrl } from '@/services/tmdb';
import { Search, FileText, Clock, MessageSquare, ChevronRight } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';
import { CardSkeleton } from '@/components/ui/enhanced-skeleton';
import { useAppNavigation } from '@/contexts/NavigationContext';

const STATUS_FILTERS = [
    { value: 'all', label: 'All' },
    { value: 'submitted', label: 'New' },
    { value: 'seen', label: 'Seen' },
    { value: 'under_review', label: 'Under Review' },
    { value: 'shortlisted', label: 'Shortlisted' },
    { value: 'interested', label: 'Interested' },
    { value: 'request_full_deck', label: 'Full Deck Req.' },
    { value: 'invite_to_discuss', label: 'Invited' },
    { value: 'passed', label: 'Passed' },
    { value: 'collaborating', label: 'Collaborating' },
];

// ─── CALL CREATOR REVIEW DASHBOARD ───────────────────────────────────────────
export const CallCreatorPitchInbox = () => {
    const { submissions, loading, updateStatus } = useCallCreatorSubmissions();
    const [selectedSubmission, setSelectedSubmission] = useState<PitchSubmission | null>(null);
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

    if (loading) return (
        <div className="grid gap-3">
            {[1,2,3].map(i => <CardSkeleton key={i} />)}
        </div>
    );

    return (
        <div className="space-y-5">
            {/* Stats Row */}
            <div className="grid grid-cols-3 gap-4">
                <div className="bg-card border border-border rounded-xl p-4 text-center">
                    <p className="text-2xl font-black text-primary">{submissions.length}</p>
                    <p className="text-xs text-muted-foreground font-bold uppercase tracking-wide mt-1">Total Pitches</p>
                </div>
                <div className="bg-card border border-border rounded-xl p-4 text-center">
                    <p className="text-2xl font-black text-blue-500">{newCount}</p>
                    <p className="text-xs text-muted-foreground font-bold uppercase tracking-wide mt-1">New / Unread</p>
                </div>
                <div className="bg-card border border-border rounded-xl p-4 text-center">
                    <p className="text-2xl font-black text-green-500">{shortlistedCount}</p>
                    <p className="text-xs text-muted-foreground font-bold uppercase tracking-wide mt-1">Shortlisted</p>
                </div>
            </div>

            {/* Search + Filter */}
            <div className="flex gap-3">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search pitches..."
                        className="pl-10"
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                    />
                </div>
            </div>

            {/* Status Filters */}
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                {STATUS_FILTERS.map(f => (
                    <button
                        key={f.value}
                        onClick={() => setStatusFilter(f.value)}
                        className={cn(
                            'flex-none px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-colors',
                            statusFilter === f.value
                                ? 'bg-primary text-white'
                                : 'bg-secondary/50 text-muted-foreground hover:bg-secondary'
                        )}
                    >
                        {f.label}
                        {f.value === 'submitted' && newCount > 0 && (
                            <span className="ml-1.5 bg-blue-500 text-white rounded-full px-1.5 py-0.5 text-[9px]">{newCount}</span>
                        )}
                    </button>
                ))}
            </div>

            {/* Submission List */}
            {filtered.length === 0 ? (
                <div className="text-center py-16 text-muted-foreground">
                    <FileText className="h-12 w-12 mx-auto mb-4 opacity-30" />
                    <p className="font-bold">No submissions yet</p>
                    <p className="text-xs mt-1">Pitches will appear here as writers submit to your calls</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {filtered.map(submission => {
                        const statusInfo = PITCH_STATUS_LABELS[submission.status || 'submitted'];
                        const avatarUrl = getSafeImageUrl(submission.profiles?.avatar_url || null);
                        const initials = (submission.profiles?.full_name || 'W').split(' ').map(n => n[0]).join('').toUpperCase();
                        return (
                            <div
                                key={submission.id}
                                className={cn(
                                    'bg-card border rounded-xl p-4 cursor-pointer hover:border-primary/30 hover:shadow-md transition-all',
                                    submission.status === 'submitted' ? 'border-primary/40 bg-primary/2' : 'border-border'
                                )}
                                onClick={() => setSelectedSubmission(submission)}
                            >
                                <div className="flex items-start gap-4">
                                    <Avatar className="h-10 w-10 shrink-0">
                                        <AvatarImage src={avatarUrl || undefined} />
                                        <AvatarFallback className="bg-primary/10 text-primary font-bold text-sm">{initials}</AvatarFallback>
                                    </Avatar>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-start justify-between gap-2">
                                            <div>
                                                <p className="font-black text-sm">{submission.title}</p>
                                                <p className="text-xs text-muted-foreground">by {submission.profiles?.full_name}</p>
                                            </div>
                                            <Badge className={cn('text-[10px] shrink-0', statusInfo?.color || '')}>
                                                {statusInfo?.label || submission.status}
                                            </Badge>
                                        </div>
                                        <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2 italic">"{submission.logline}"</p>
                                        <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                                            <span className="flex items-center gap-1">
                                                <Clock className="h-3 w-3" />
                                                {formatDistanceToNow(new Date(submission.submitted_at), { addSuffix: true })}
                                            </span>
                                            {submission.genre && <span>{submission.genre}</span>}
                                            {submission.language && <span>{submission.language}</span>}
                                        </div>
                                    </div>
                                    <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 mt-1" />
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {selectedSubmission && (
                <SubmissionReviewDialog
                    submission={selectedSubmission}
                    isOpen={true}
                    onClose={() => setSelectedSubmission(null)}
                    onUpdateStatus={(id, status) => {
                        updateStatus(id, status);
                        setSelectedSubmission(prev => prev ? { ...prev, status } : null);
                    }}
                />
            )}
        </div>
    );
};

// ─── WRITER'S PITCH TRACKER ──────────────────────────────────────────────────
export const WriterPitchTracker = () => {
    const { submissions, loading } = useMyPitchSubmissions();
    const { push } = useAppNavigation();

    if (loading) return (
        <div className="grid gap-3">
            {[1,2,3].map(i => <CardSkeleton key={i} />)}
        </div>
    );

    if (submissions.length === 0) return (
        <div className="text-center py-16 text-muted-foreground">
            <FileText className="h-12 w-12 mx-auto mb-4 opacity-30" />
            <p className="font-bold">No pitches submitted yet</p>
            <p className="text-xs mt-1">Browse pitch calls and submit your first pitch to see it here</p>
            <Button className="mt-4" onClick={() => push('/pitch')}>Browse Pitch Calls</Button>
        </div>
    );

    return (
        <div className="space-y-3">
            {submissions.map(sub => {
                const statusInfo = PITCH_STATUS_LABELS[sub.status || 'submitted'];
                return (
                    <div key={sub.id} className="bg-card border border-border rounded-xl p-4">
                        <div className="flex items-start justify-between gap-3">
                            <div className="flex-1 min-w-0">
                                <p className="font-black text-sm">{sub.title}</p>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                    Pitched to: <span className="font-bold text-foreground">{sub.pitch_calls?.title}</span>
                                </p>
                                <p className="text-xs text-muted-foreground mt-1 italic line-clamp-1">"{sub.logline}"</p>
                                <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                                    <Clock className="h-3 w-3" />
                                    {formatDistanceToNow(new Date(sub.submitted_at), { addSuffix: true })}
                                </p>
                            </div>
                            <div className="text-right shrink-0">
                                <Badge className={cn('text-[10px]', statusInfo?.color || '')}>
                                    {statusInfo?.label || sub.status}
                                </Badge>
                                {sub.status === 'collaborating' && (
                                    <Button
                                        size="sm"
                                        className="mt-2 text-xs"
                                        onClick={() => push(`/dm/${sub.pitch_call_id}`)}
                                    >
                                        <MessageSquare className="h-3 w-3 mr-1" /> Collaborate
                                    </Button>
                                )}
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
    );
};
