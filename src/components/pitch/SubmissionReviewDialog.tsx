import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

import { PitchSubmission, PITCH_STATUS_LABELS } from '@/hooks/usePitch';
import { getSafeImageUrl } from '@/services/tmdb';
import { 
    Eye, Lock, FileText, Star, MessageSquare, 
    ThumbsDown, Check, ChevronRight, Clock, Shield
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';

interface SubmissionReviewDialogProps {
    submission: PitchSubmission;
    isOpen: boolean;
    onClose: () => void;
    onUpdateStatus: (submissionId: string, status: string) => void;
}

const STATUS_ACTIONS = [
    { value: 'seen', label: 'Mark as Seen', icon: Eye, color: 'text-purple-500' },
    { value: 'under_review', label: 'Under Review', icon: Clock, color: 'text-amber-500' },
    { value: 'shortlisted', label: 'Shortlist', icon: Star, color: 'text-green-500' },
    { value: 'interested', label: 'Mark Interested', icon: Check, color: 'text-emerald-500' },
    { value: 'request_full_deck', label: 'Request Full Deck', icon: FileText, color: 'text-primary' },
    { value: 'invite_to_discuss', label: 'Invite to Discuss', icon: MessageSquare, color: 'text-primary' },
    { value: 'passed', label: 'Pass Respectfully', icon: ThumbsDown, color: 'text-muted-foreground' },
];

export const SubmissionReviewDialog = ({ submission, isOpen, onClose, onUpdateStatus }: SubmissionReviewDialogProps) => {
    const navigate = useNavigate();
    const avatarUrl = getSafeImageUrl(submission.profiles?.avatar_url || null);
    const initials = (submission.profiles?.full_name || 'W').split(' ').map(n => n[0]).join('').toUpperCase();
    const statusInfo = PITCH_STATUS_LABELS[submission.status] || { label: submission.status, color: '' };

    const handleStartCollaboration = () => {
        // Navigate to DM with the writer
        navigate(`/dm/${submission.submitter_id}`);
        onClose();
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <div className="flex items-center justify-between">
                        <DialogTitle className="text-xl font-black">Pitch Review</DialogTitle>
                        <Badge className={cn('text-xs font-bold', statusInfo.color)}>{statusInfo.label}</Badge>
                    </div>
                </DialogHeader>

                <div className="space-y-6">
                    {/* Writer Identity */}
                    <div className="flex items-center gap-4 p-4 bg-secondary/20 rounded-xl">
                        <Avatar className="h-14 w-14">
                            <AvatarImage src={avatarUrl || undefined} />
                            <AvatarFallback className="bg-primary/10 text-primary font-black text-lg">{initials}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1">
                            <p className="font-black text-lg">{submission.profiles?.full_name || 'Writer'}</p>
                            <p className="text-sm text-muted-foreground">{submission.profiles?.craft || 'Creator'}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                                Submitted {formatDistanceToNow(new Date(submission.submitted_at), { addSuffix: true })}
                            </p>
                        </div>
                        <Button variant="outline" size="sm" onClick={handleStartCollaboration}>
                            <MessageSquare className="h-4 w-4 mr-2" /> Message
                        </Button>
                    </div>

                    {/* Pitch Header */}
                    <div>
                        <h2 className="text-2xl font-black">{submission.title}</h2>
                        <p className="text-sm text-primary font-bold italic mt-1">"{submission.logline}"</p>
                    </div>

                    {/* Metadata */}
                    <div className="flex flex-wrap gap-2">
                        {submission.genre && <Badge variant="secondary">{submission.genre}</Badge>}
                        {submission.language && <Badge variant="outline">{submission.language}</Badge>}
                        {submission.format && <Badge variant="outline">{submission.format}</Badge>}
                        {submission.tone && <Badge variant="outline">{submission.tone}</Badge>}
                    </div>

                    {/* Short Synopsis */}
                    <div className="space-y-2">
                        <h4 className="text-sm font-black uppercase tracking-widest text-muted-foreground">Short Synopsis</h4>
                        <p className="text-sm leading-relaxed">{submission.short_synopsis}</p>
                    </div>

                    {/* Full Synopsis — Protected */}
                    {submission.full_synopsis && (
                        <div className="space-y-2 p-4 bg-primary/5 border border-primary/20 rounded-xl">
                            <div className="flex items-center gap-2">
                                <Lock className="h-4 w-4 text-primary" />
                                <h4 className="text-sm font-black uppercase tracking-widest text-primary">Full Synopsis (Protected)</h4>
                            </div>
                            <p className="text-sm leading-relaxed">{submission.full_synopsis}</p>
                        </div>
                    )}

                    {/* Why Fits */}
                    {submission.why_fits && (
                        <div className="space-y-2">
                            <h4 className="text-sm font-black uppercase tracking-widest text-muted-foreground">Why This Fits You</h4>
                            <p className="text-sm leading-relaxed text-muted-foreground">{submission.why_fits}</p>
                        </div>
                    )}

                    {/* Character Notes */}
                    {submission.character_notes && (
                        <div className="space-y-2">
                            <h4 className="text-sm font-black uppercase tracking-widest text-muted-foreground">Character Notes</h4>
                            <p className="text-sm leading-relaxed">{submission.character_notes}</p>
                        </div>
                    )}

                    {/* Attachments */}
                    {(submission.treatment_url || submission.lookbook_url) && (
                        <div className="space-y-2">
                            <h4 className="text-sm font-black uppercase tracking-widest text-muted-foreground">Attachments</h4>
                            <div className="flex gap-2">
                                {submission.treatment_url && (
                                    <a href={submission.treatment_url} target="_blank" rel="noopener noreferrer">
                                        <Button variant="outline" size="sm" className="gap-2">
                                            <FileText className="h-3 w-3" /> Treatment / Pitch Deck
                                        </Button>
                                    </a>
                                )}
                                {submission.lookbook_url && (
                                    <a href={submission.lookbook_url} target="_blank" rel="noopener noreferrer">
                                        <Button variant="outline" size="sm" className="gap-2">
                                            <FileText className="h-3 w-3" /> Lookbook
                                        </Button>
                                    </a>
                                )}
                            </div>
                        </div>
                    )}

                    {/* IP Declarations */}
                    <div className="flex items-center gap-3 p-3 bg-green-500/5 border border-green-500/20 rounded-lg text-sm">
                        <Shield className="h-5 w-5 text-green-500 shrink-0" />
                        <div>
                            <span className={`font-bold ${submission.rights_owned ? 'text-green-500' : 'text-red-500'}`}>
                                Rights Owned
                            </span>
                            <span className="mx-2 text-muted-foreground">·</span>
                            <span className={`font-bold ${submission.is_original_work ? 'text-green-500' : 'text-red-500'}`}>
                                Original Work
                            </span>
                            {submission.nda_preferred && (
                                <>
                                    <span className="mx-2 text-muted-foreground">·</span>
                                    <span className="font-bold text-amber-500">NDA Preferred</span>
                                </>
                            )}
                        </div>
                    </div>

                    {/* Status Actions */}
                    <div className="pt-4 border-t border-border space-y-3">
                        <h4 className="text-sm font-black uppercase tracking-widest text-muted-foreground">Actions</h4>
                        <div className="grid grid-cols-2 gap-2">
                            {STATUS_ACTIONS.map(action => (
                                <Button
                                    key={action.value}
                                    variant={submission.status === action.value ? 'default' : 'outline'}
                                    size="sm"
                                    className={`justify-start gap-2 ${submission.status === action.value ? '' : action.color}`}
                                    onClick={() => onUpdateStatus(submission.id, action.value)}
                                >
                                    <action.icon className="h-3.5 w-3.5" />
                                    {action.label}
                                </Button>
                            ))}
                            {(submission.status === 'interested' || submission.status === 'invite_to_discuss') && (
                                <Button
                                    className="col-span-2 bg-green-600 hover:bg-green-700 text-white font-bold"
                                    onClick={handleStartCollaboration}
                                >
                                    <ChevronRight className="h-4 w-4 mr-2" />
                                    Start Private Collaboration
                                </Button>
                            )}
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
};
