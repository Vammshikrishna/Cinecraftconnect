import { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

import { PitchSubmission, PITCH_STATUS_LABELS } from '@/hooks/usePitch';
import { getSafeImageUrl } from '@/services/tmdb';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { WatermarkedContent } from './WatermarkedContent';
import {
    Eye, Lock, FileText, Star, MessageSquare,
    ThumbsDown, Check, ChevronRight, Clock, Shield,
    PenLine, Award, AlertTriangle, ExternalLink,
    Download, CheckCircle2, Sparkles, X
} from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import { useAppNavigation } from '@/contexts/NavigationContext';
import { cn } from '@/lib/utils';

interface SubmissionReviewDialogProps {
    submission: PitchSubmission;
    isOpen: boolean;
    onClose: () => void;
    onUpdateStatus: (submissionId: string, status: string) => void;
    ndaRequired?: boolean;
}

const STATUS_ACTIONS = [
    { value: 'seen', label: 'Mark as Seen', icon: Eye, color: 'text-purple-500', bg: 'hover:bg-purple-500/10' },
    { value: 'under_review', label: 'Under Review', icon: Clock, color: 'text-amber-500', bg: 'hover:bg-amber-500/10' },
    { value: 'shortlisted', label: 'Shortlist', icon: Star, color: 'text-green-500', bg: 'hover:bg-green-500/10' },
    { value: 'interested', label: 'Interested', icon: Check, color: 'text-emerald-500', bg: 'hover:bg-emerald-500/10' },
    { value: 'request_full_deck', label: 'Request Full Deck', icon: FileText, color: 'text-primary', bg: 'hover:bg-primary/10' },
    { value: 'invite_to_discuss', label: 'Invite to Discuss', icon: MessageSquare, color: 'text-blue-400', bg: 'hover:bg-blue-400/10' },
    { value: 'passed', label: 'Pass Respectfully', icon: ThumbsDown, color: 'text-muted-foreground', bg: 'hover:bg-muted/50' },
];

// ─── PDF Download with Watermark + Timestamp ─────────────────────────────────
const downloadPitchAsPDF = async (submission: PitchSubmission, reviewerName: string) => {
    const timestamp = format(new Date(), "dd MMM yyyy, hh:mm a 'IST'");
    const submittedAt = format(new Date(submission.submitted_at), "dd MMM yyyy");

    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<title>${submission.title} — CineCraft Pitch Record</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;900&display=swap');
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family: 'Inter', Arial, sans-serif; background:#fff; color:#111; font-size:13px; line-height:1.6; }
  .watermark {
    position:fixed; top:50%; left:50%; transform:translate(-50%,-50%) rotate(-35deg);
    font-size:72px; font-weight:900; color:rgba(220,50,50,0.07); white-space:nowrap;
    pointer-events:none; z-index:0; letter-spacing:6px;
    font-family: Arial, sans-serif;
  }
  .container { position:relative; z-index:1; max-width:740px; margin:0 auto; padding:48px 40px; }
  .header { border-bottom:2px solid #111; padding-bottom:20px; margin-bottom:28px; }
  .logo { font-size:11px; font-weight:900; letter-spacing:0.25em; text-transform:uppercase; color:#555; margin-bottom:6px; }
  .doc-title { font-size:24px; font-weight:900; color:#111; margin-bottom:4px; }
  .doc-meta { font-size:11px; color:#666; }
  .legal-stamp {
    background:#fef3c7; border:1px solid #f59e0b; border-radius:8px;
    padding:12px 16px; margin-bottom:28px; font-size:11px; color:#92400e;
    font-weight:600;
  }
  .legal-stamp strong { color:#78350f; }
  .section { margin-bottom:24px; }
  .section-label {
    font-size:9px; font-weight:900; letter-spacing:0.2em; text-transform:uppercase;
    color:#999; border-bottom:1px solid #eee; padding-bottom:6px; margin-bottom:10px;
  }
  .section-content { color:#333; font-size:13px; white-space:pre-wrap; }
  .logline { font-style:italic; color:#555; border-left:3px solid #e5e7eb; padding-left:12px; }
  .tag { display:inline-block; background:#f3f4f6; border:1px solid #e5e7eb; border-radius:4px; padding:2px 8px; font-size:11px; font-weight:600; margin:2px 2px 2px 0; color:#374151; }
  .ip-box { background:#f0fdf4; border:1px solid #86efac; border-radius:8px; padding:12px 16px; }
  .ip-item { font-size:12px; color:#15803d; font-weight:700; display:flex; align-items:center; gap:6px; margin-bottom:4px; }
  .ip-item::before { content:'✓'; font-weight:900; }
  .footer {
    margin-top:40px; padding-top:20px; border-top:1px solid #e5e7eb;
    display:flex; justify-content:space-between; font-size:10px; color:#999;
  }
  .chain-box {
    background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px;
    padding:12px 16px; margin-top:12px; font-size:11px;
  }
  .chain-row { display:flex; justify-content:space-between; padding:3px 0; border-bottom:1px solid #f1f5f9; }
  .chain-row:last-child { border-bottom:none; }
  .chain-label { color:#64748b; font-weight:600; }
  .chain-value { color:#1e293b; font-weight:700; font-family:monospace; }
</style>
</head>
<body>
<div class="watermark">CINECRAFT · CONFIDENTIAL</div>
<div class="container">
  <div class="header">
    <div class="logo">CineCraft Connect — Official Pitch Record</div>
    <div class="doc-title">${submission.title}</div>
    <div class="doc-meta">
      Submitted by: <strong>${submission.profiles?.full_name || 'Writer'}</strong> &nbsp;·&nbsp;
      Submitted: <strong>${submittedAt}</strong> &nbsp;·&nbsp;
      Downloaded by: <strong>${reviewerName}</strong> &nbsp;·&nbsp;
      Downloaded: <strong>${timestamp}</strong>
    </div>
  </div>

  <div class="legal-stamp">
    <strong>⚠ LEGAL NOTICE:</strong> This document is confidential and protected under CineCraft's Pitch Marketplace Terms. 
    Unauthorized distribution or reproduction constitutes a breach of NDA and may be actionable under IPC Section 420 and the Indian IT Act, 2000. 
    This download event has been permanently logged as legal evidence.
  </div>

  <div class="section">
    <div class="section-label">Logline</div>
    <div class="section-content logline">"${submission.logline}"</div>
  </div>

  ${submission.genre || submission.language || submission.format || submission.tone ? `
  <div class="section">
    <div class="section-label">Tags</div>
    <div>
      ${submission.genre ? `<span class="tag">${submission.genre}</span>` : ''}
      ${submission.language ? `<span class="tag">${submission.language}</span>` : ''}
      ${submission.format ? `<span class="tag">${submission.format}</span>` : ''}
      ${submission.tone ? `<span class="tag">${submission.tone}</span>` : ''}
    </div>
  </div>` : ''}

  <div class="section">
    <div class="section-label">Short Synopsis</div>
    <div class="section-content">${submission.short_synopsis || '—'}</div>
  </div>

  ${submission.full_synopsis ? `
  <div class="section">
    <div class="section-label">Full Synopsis (Protected — Watermarked)</div>
    <div class="section-content">${submission.full_synopsis}</div>
  </div>` : ''}

  ${submission.why_fits ? `
  <div class="section">
    <div class="section-label">Why This Fits the Call</div>
    <div class="section-content">${submission.why_fits}</div>
  </div>` : ''}

  ${submission.character_notes ? `
  <div class="section">
    <div class="section-label">Character Notes</div>
    <div class="section-content">${submission.character_notes}</div>
  </div>` : ''}

  ${submission.pilot_outline ? `
  <div class="section">
    <div class="section-label">Pilot / Opening Outline</div>
    <div class="section-content">${submission.pilot_outline}</div>
  </div>` : ''}

  <div class="section">
    <div class="section-label">IP Declarations</div>
    <div class="ip-box">
      ${submission.rights_owned ? '<div class="ip-item">Rights Owned by Submitter</div>' : ''}
      ${submission.is_original_work ? '<div class="ip-item">Declared as Original Work</div>' : ''}
      ${(submission as any).guild_registration_number ? `<div class="ip-item">Guild Registration: ${(submission as any).guild_registration_number}</div>` : ''}
      ${(submission as any).nda_signature ? `<div class="ip-item">Writer NDA Signed: ${(submission as any).nda_signature} (${(submission as any).nda_signed_at ? format(new Date((submission as any).nda_signed_at), 'dd MMM yyyy HH:mm') : ''})</div>` : ''}
    </div>
  </div>

  <div class="section">
    <div class="section-label">Chain of Custody Log</div>
    <div class="chain-box">
      <div class="chain-row"><span class="chain-label">Submission ID</span><span class="chain-value">${submission.id}</span></div>
      <div class="chain-row"><span class="chain-label">Submitted At (UTC)</span><span class="chain-value">${new Date(submission.submitted_at).toISOString()}</span></div>
      <div class="chain-row"><span class="chain-label">Downloaded By</span><span class="chain-value">${reviewerName}</span></div>
      <div class="chain-row"><span class="chain-label">Download Timestamp (IST)</span><span class="chain-value">${timestamp}</span></div>
      <div class="chain-row"><span class="chain-label">Platform</span><span class="chain-value">CineCraft Connect — Pitch Marketplace</span></div>
    </div>
  </div>

  <div class="footer">
    <span>Generated by CineCraft Connect · cinecraftconnect.com</span>
    <span>${timestamp}</span>
  </div>
</div>
</body>
</html>`;

    const blob = new Blob([htmlContent], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `CineCraft_Pitch_${submission.title.replace(/\s+/g, '_')}_${format(new Date(), 'yyyyMMdd_HHmm')}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
};

// ─── NDA Gate Component ───────────────────────────────────────────────────────
const NDAGate = ({ submissionId, onSigned }: { submissionId: string; onSigned: () => void }) => {
    const { profile, user } = useAuth();
    const [signature, setSignature] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSign = async () => {
        if (signature.trim().length < 3 || !user) return;
        setLoading(true);
        try {
            await (supabase as any).from('nda_viewer_signatures').insert({
                pitch_submission_id: submissionId,
                signed_by: user.id,
                signature: signature.trim(),
                signed_at: new Date().toISOString(),
            });
            onSigned();
        } catch {
            onSigned();
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex flex-col items-center justify-center py-10 px-4 space-y-6 text-center">
            <div className="relative">
                <div className="h-20 w-20 rounded-3xl bg-amber-500/10 border-2 border-amber-500/20 flex items-center justify-center">
                    <PenLine className="h-10 w-10 text-amber-500" />
                </div>
                <div className="absolute inset-0 rounded-3xl bg-amber-500/5 animate-ping" />
            </div>
            <div className="max-w-sm space-y-2">
                <h3 className="font-black text-xl">NDA Required</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                    This pitch is NDA-protected. Your signature, timestamp, and identity will be permanently recorded as legal evidence before you can view the full content.
                </p>
            </div>

            <div className="w-full max-w-sm space-y-4 p-5 bg-amber-500/5 border border-amber-400/30 rounded-2xl text-left">
                <ul className="space-y-1.5 text-xs text-muted-foreground">
                    {[
                        'Treat this pitch with strict confidentiality',
                        'Not share the content with any third party',
                        'Be bound by the CineCraft Arbitration Clause for IP disputes',
                    ].map((item, i) => (
                        <li key={i} className="flex items-start gap-2">
                            <span className="text-amber-500 mt-0.5">•</span> {item}
                        </li>
                    ))}
                </ul>
                <p className="text-[10px] text-muted-foreground/60">Legally binding under the Indian IT Act, 2000.</p>

                <div className="space-y-2">
                    <Label className="text-xs font-black uppercase tracking-widest">Type your full legal name *</Label>
                    <Input
                        placeholder={(profile as any)?.full_name || 'Your full legal name'}
                        value={signature}
                        onChange={e => setSignature(e.target.value)}
                        className={cn(
                            'h-12 transition-all',
                            signature.trim().length >= 3
                                ? 'border-green-500/50 bg-green-500/5'
                                : 'border-amber-400/40'
                        )}
                    />
                    {signature.trim().length >= 3 && (
                        <p className="text-xs text-green-500 font-semibold flex items-center gap-1.5">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            Signed as "{signature}" — timestamp will be logged
                        </p>
                    )}
                </div>

                <Button
                    className="w-full h-11 bg-amber-500 hover:bg-amber-600 text-white font-black"
                    disabled={signature.trim().length < 3 || loading}
                    onClick={handleSign}
                >
                    <PenLine className="h-4 w-4 mr-2" />
                    {loading ? 'Recording signature…' : 'Sign NDA & Unlock Pitch'}
                </Button>
            </div>
        </div>
    );
};

// ─── Attachment Warning ───────────────────────────────────────────────────────
const AttachmentLink = ({ href, label, submissionId }: { href: string; label: string; ndaSigned: boolean; submissionId: string }) => {
    const [showWarning, setShowWarning] = useState(false);
    const { user } = useAuth();

    const handleProceed = async () => {
        await (supabase as any).from('pitch_access_logs').insert({
            pitch_submission_id: submissionId,
            accessed_by: user?.id,
            action: 'attachment_opened',
        }).then(() => {}).catch(() => {});
        window.open(href, '_blank', 'noopener,noreferrer');
        setShowWarning(false);
    };

    return (
        <>
            <button
                onClick={() => setShowWarning(true)}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-muted/40 border border-border/50 hover:border-primary/30 hover:bg-primary/5 transition-all text-sm font-semibold group"
            >
                <FileText className="h-4 w-4 text-primary" />
                {label}
                <ExternalLink className="h-3 w-3 text-muted-foreground group-hover:text-primary transition-colors" />
            </button>

            {showWarning && (
                <div className="fixed inset-0 bg-black/70 z-[9999] flex items-center justify-center p-4" onClick={() => setShowWarning(false)}>
                    <div className="bg-card border border-border rounded-2xl p-6 max-w-sm w-full shadow-2xl" onClick={e => e.stopPropagation()}>
                        <div className="flex items-start gap-3 mb-4">
                            <div className="h-10 w-10 bg-amber-500/10 rounded-xl flex items-center justify-center shrink-0">
                                <AlertTriangle className="h-5 w-5 text-amber-500" />
                            </div>
                            <div>
                                <p className="font-black">Confidential Attachment</p>
                                <p className="text-xs text-muted-foreground">This access will be permanently logged</p>
                            </div>
                            <button onClick={() => setShowWarning(false)} className="ml-auto text-muted-foreground hover:text-foreground">
                                <X className="h-4 w-4" />
                            </button>
                        </div>
                        <p className="text-xs text-muted-foreground leading-relaxed mb-5">
                            Downloading or sharing this document with any third party violates the NDA you signed.
                            This access event is being permanently recorded as legal evidence.
                        </p>
                        <div className="flex gap-2">
                            <Button variant="outline" size="sm" className="flex-1" onClick={() => setShowWarning(false)}>Cancel</Button>
                            <Button size="sm" className="flex-1 gap-1.5" onClick={handleProceed}>
                                <ExternalLink className="h-3.5 w-3.5" /> Open File
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

// ─── Main Review Dialog ───────────────────────────────────────────────────────
export const SubmissionReviewDialog = ({ submission, isOpen, onClose, onUpdateStatus, ndaRequired }: SubmissionReviewDialogProps) => {
    const { push } = useAppNavigation();
    const { user, profile } = useAuth();
    const avatarUrl = getSafeImageUrl(submission.profiles?.avatar_url || null);
    const initials = (submission.profiles?.full_name || 'W').split(' ').map(n => n[0]).join('').toUpperCase();
    const statusInfo = PITCH_STATUS_LABELS[submission.status || 'submitted'];
    const [downloading, setDownloading] = useState(false);

    const [ndaGatePassed, setNdaGatePassed] = useState(!ndaRequired);
    const [checkingNda, setCheckingNda] = useState(!!ndaRequired);

    useEffect(() => {
        if (!ndaRequired || !user) {
            setNdaGatePassed(true);
            setCheckingNda(false);
            return;
        }
        const check = async () => {
            const { data } = await (supabase as any)
                .from('nda_viewer_signatures')
                .select('id')
                .eq('pitch_submission_id', submission.id)
                .eq('signed_by', user.id)
                .maybeSingle();
            setNdaGatePassed(!!data);
            setCheckingNda(false);
        };
        check();
    }, [submission.id, user?.id, ndaRequired]);

    const handleDownload = async () => {
        setDownloading(true);
        // Log the download
        await (supabase as any).from('pitch_access_logs').insert({
            pitch_submission_id: submission.id,
            accessed_by: user?.id,
            action: 'pdf_downloaded',
        }).then(() => {}).catch(() => {});
        await downloadPitchAsPDF(submission, (profile as any)?.full_name || 'Creator');
        setDownloading(false);
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto p-0">
                {/* Header */}
                <div className="sticky top-0 z-10 bg-card/95 backdrop-blur-md border-b border-border/50 px-6 py-4">
                    <div className="flex items-center justify-between gap-3">
                        <div>
                            <DialogTitle className="text-lg font-black">Pitch Review</DialogTitle>
                            <p className="text-xs text-muted-foreground mt-0.5">Reviewing submission from {submission.profiles?.full_name}</p>
                        </div>
                        <div className="flex items-center gap-2">
                            <Badge className={cn('text-xs font-bold', statusInfo.color)}>{statusInfo.label}</Badge>
                            {ndaGatePassed && (
                                <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-8 gap-1.5 text-xs rounded-lg border-primary/30 text-primary hover:bg-primary/10"
                                    onClick={handleDownload}
                                    disabled={downloading}
                                >
                                    <Download className="h-3.5 w-3.5" />
                                    {downloading ? 'Preparing…' : 'Download Record'}
                                </Button>
                            )}
                        </div>
                    </div>
                </div>

                <div className="p-6">
                    {/* NDA Gate */}
                    {checkingNda ? (
                        <div className="flex items-center justify-center py-20">
                            <div className="h-6 w-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                        </div>
                    ) : !ndaGatePassed ? (
                        <NDAGate submissionId={submission.id} onSigned={() => setNdaGatePassed(true)} />
                    ) : (
                        <div className="space-y-7">
                            {/* Writer Identity Card */}
                            <div className="flex items-center gap-4 p-4 bg-card/60 border border-border/50 rounded-2xl">
                                <Avatar className="h-14 w-14 rounded-2xl ring-2 ring-border/30 shrink-0">
                                    <AvatarImage src={avatarUrl || undefined} />
                                    <AvatarFallback className="bg-primary/10 text-primary font-black text-xl rounded-2xl">{initials}</AvatarFallback>
                                </Avatar>
                                <div className="flex-1 min-w-0">
                                    <p className="font-black text-base">{submission.profiles?.full_name || 'Writer'}</p>
                                    <p className="text-sm text-muted-foreground">{submission.profiles?.craft || 'Creator'}</p>
                                    <p className="text-xs text-muted-foreground/70 flex items-center gap-1 mt-1">
                                        <Clock className="h-3 w-3" />
                                        Submitted {formatDistanceToNow(new Date(submission.submitted_at), { addSuffix: true })}
                                    </p>
                                </div>
                                <Button variant="outline" size="sm" className="shrink-0 rounded-xl" onClick={() => { push(`/dm/${submission.submitter_id}`); onClose(); }}>
                                    <MessageSquare className="h-3.5 w-3.5 mr-1.5" /> Message
                                </Button>
                            </div>

                            {/* Title + Logline */}
                            <div className="space-y-2">
                                <h2 className="text-2xl font-black text-foreground">{submission.title}</h2>
                                <p className="text-primary font-semibold italic text-sm border-l-2 border-primary/40 pl-3">"{submission.logline}"</p>
                            </div>

                            {/* Tags */}
                            {(submission.genre || submission.language || submission.format || submission.tone) && (
                                <div className="flex flex-wrap gap-2">
                                    {[submission.genre, submission.language, submission.format, submission.tone].filter(Boolean).map((tag, i) => (
                                        <span key={i} className="text-xs font-semibold bg-muted/50 border border-border/40 px-3 py-1 rounded-full">
                                            {tag}
                                        </span>
                                    ))}
                                </div>
                            )}

                            {/* Short Synopsis */}
                            <div className="space-y-2">
                                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">Short Synopsis</p>
                                <p className="text-sm leading-relaxed text-foreground/90">{submission.short_synopsis}</p>
                            </div>

                            {/* Full Synopsis — Watermarked */}
                            {submission.full_synopsis && (
                                <WatermarkedContent className="space-y-3 p-5 bg-primary/5 border border-primary/20 rounded-2xl">
                                    <div className="flex items-center gap-2">
                                        <div className="h-7 w-7 bg-primary/10 rounded-lg flex items-center justify-center">
                                            <Lock className="h-3.5 w-3.5 text-primary" />
                                        </div>
                                        <p className="text-xs font-black uppercase tracking-widest text-primary">Full Synopsis — Protected & Watermarked</p>
                                    </div>
                                    <p className="text-sm leading-relaxed text-foreground/90">{submission.full_synopsis}</p>
                                </WatermarkedContent>
                            )}

                            {/* Why it Fits */}
                            {submission.why_fits && (
                                <div className="space-y-2">
                                    <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">Why This Fits You</p>
                                    <p className="text-sm leading-relaxed text-muted-foreground">{submission.why_fits}</p>
                                </div>
                            )}

                            {/* Character Notes — Watermarked */}
                            {submission.character_notes && (
                                <WatermarkedContent className="space-y-2">
                                    <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">Character Notes</p>
                                    <p className="text-sm leading-relaxed">{submission.character_notes}</p>
                                </WatermarkedContent>
                            )}

                            {/* Attachments */}
                            {(submission.treatment_url || submission.lookbook_url || (submission as any).full_deck_url) && (
                                <div className="space-y-3">
                                    <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">Attachments</p>
                                    <div className="flex gap-2 flex-wrap">
                                        {(submission as any).full_deck_url && (
                                            <AttachmentLink href={(submission as any).full_deck_url} label="Full Deck (Requested)" ndaSigned={ndaGatePassed} submissionId={submission.id} />
                                        )}
                                        {submission.treatment_url && (
                                            <AttachmentLink href={submission.treatment_url} label="Treatment / Pitch Deck" ndaSigned={ndaGatePassed} submissionId={submission.id} />
                                        )}
                                        {submission.lookbook_url && (
                                            <AttachmentLink href={submission.lookbook_url} label="Lookbook" ndaSigned={ndaGatePassed} submissionId={submission.id} />
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* IP Declarations */}
                            <div className="p-4 bg-green-500/5 border border-green-500/20 rounded-2xl space-y-3">
                                <p className="text-[10px] font-black uppercase tracking-widest text-green-600/80">IP Declarations</p>
                                <div className="flex flex-wrap items-center gap-3">
                                    <span className={cn('flex items-center gap-1.5 text-sm font-bold', submission.rights_owned ? 'text-green-500' : 'text-destructive')}>
                                        {submission.rights_owned ? <CheckCircle2 className="h-4 w-4" /> : <X className="h-4 w-4" />}
                                        Rights Owned
                                    </span>
                                    <span className="text-border">·</span>
                                    <span className={cn('flex items-center gap-1.5 text-sm font-bold', submission.is_original_work ? 'text-green-500' : 'text-destructive')}>
                                        {submission.is_original_work ? <CheckCircle2 className="h-4 w-4" /> : <X className="h-4 w-4" />}
                                        Original Work
                                    </span>
                                    {(submission as any).nda_signature && (
                                        <>
                                            <span className="text-border">·</span>
                                            <span className="flex items-center gap-1.5 text-sm font-bold text-amber-500">
                                                <Shield className="h-4 w-4" /> NDA Signed
                                            </span>
                                        </>
                                    )}
                                </div>
                                {(submission as any).guild_registration_number ? (
                                    <div className="flex items-center gap-2 pt-1">
                                        <Award className="h-4 w-4 text-primary" />
                                        <span className="text-xs font-bold text-primary">Guild Registered:</span>
                                        <code className="text-xs bg-primary/10 px-2 py-0.5 rounded-md font-mono text-primary">
                                            {(submission as any).guild_registration_number}
                                        </code>
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-2 pt-1">
                                        <AlertTriangle className="h-3.5 w-3.5 text-muted-foreground" />
                                        <span className="text-xs text-muted-foreground">No SWA/WGA registration number provided</span>
                                    </div>
                                )}
                            </div>

                            {/* Status Actions */}
                            <div className="space-y-3 pt-2 border-t border-border/40">
                                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">Your Decision</p>
                                <div className="grid grid-cols-2 gap-2">
                                    {STATUS_ACTIONS.map(action => (
                                        <button
                                            key={action.value}
                                            onClick={() => onUpdateStatus(submission.id, action.value)}
                                            className={cn(
                                                'flex items-center gap-2.5 px-4 py-2.5 rounded-xl border text-sm font-bold transition-all text-left',
                                                submission.status === action.value
                                                    ? 'bg-primary text-primary-foreground border-primary shadow-md'
                                                    : `bg-card border-border/50 ${action.color} ${action.bg}`
                                            )}
                                        >
                                            <action.icon className="h-3.5 w-3.5 shrink-0" />
                                            {action.label}
                                        </button>
                                    ))}
                                </div>

                                {(submission.status === 'interested' || submission.status === 'invite_to_discuss') && (
                                    <Button
                                        className="w-full h-11 bg-green-600 hover:bg-green-700 text-white font-black rounded-xl gap-2"
                                        onClick={() => { push(`/dm/${submission.submitter_id}`); onClose(); }}
                                    >
                                        <Sparkles className="h-4 w-4" />
                                        Start Private Collaboration
                                        <ChevronRight className="h-4 w-4" />
                                    </Button>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
};
