import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

import { PitchSubmission, PITCH_STATUS_LABELS } from '@/hooks/usePitch';
import { getSafeImageUrl } from '@/services/tmdb';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { WatermarkedContent } from '@/components/pitch/WatermarkedContent';
import {
    Eye, Lock, FileText, Star, MessageSquare,
    ThumbsDown, Check, Clock, Shield,
    PenLine, Award, AlertTriangle, ExternalLink,
    Download, CheckCircle2, Sparkles, X, ArrowLeft,
    Megaphone, ChevronRight, User
} from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import { useAppNavigation } from '@/contexts/NavigationContext';
import { cn } from '@/lib/utils';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import SEO from '@/components/common/SEO';
import { useToast } from '@/hooks/use-toast';

const STATUS_ACTIONS = [
    { value: 'seen',              label: 'Mark as Seen',       icon: Eye,          color: 'text-purple-400',     ring: 'border-purple-400/30',    activeBg: 'bg-purple-500' },
    { value: 'under_review',      label: 'Under Review',       icon: Clock,        color: 'text-amber-400',      ring: 'border-amber-400/30',     activeBg: 'bg-amber-500'  },
    { value: 'shortlisted',       label: 'Shortlist',          icon: Star,         color: 'text-green-400',      ring: 'border-green-400/30',     activeBg: 'bg-green-500'  },
    { value: 'interested',        label: 'Interested',         icon: Check,        color: 'text-emerald-400',    ring: 'border-emerald-400/30',   activeBg: 'bg-emerald-500'},
    { value: 'request_full_deck', label: 'Request Full Deck',  icon: FileText,     color: 'text-primary',        ring: 'border-primary/30',       activeBg: 'bg-primary'    },
    { value: 'invite_to_discuss', label: 'Invite to Discuss',  icon: MessageSquare,color: 'text-blue-400',       ring: 'border-blue-400/30',      activeBg: 'bg-blue-500'   },
    { value: 'passed',            label: 'Pass Respectfully',  icon: ThumbsDown,   color: 'text-muted-foreground',ring: 'border-border/40',       activeBg: 'bg-muted'      },
];

// ── PDF via browser print ─────────────────────────────────────────────────────
const downloadAsPDF = (submission: PitchSubmission, reviewerName: string) => {
    const timestamp = format(new Date(), "dd MMM yyyy, hh:mm a 'IST'");
    const submittedAt = format(new Date(submission.submitted_at), 'dd MMM yyyy');
    const pitchCallTitle = (submission as any).pitch_calls?.title || 'Unknown Call';

    const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<title>${submission.title} — CineCraft Pitch Record</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;900&display=swap');
  *{margin:0;padding:0;box-sizing:border-box;}
  body{font-family:'Inter',Arial,sans-serif;background:#fff;color:#111;font-size:13px;line-height:1.7;padding:48px 52px;}
  .watermark{position:fixed;top:50%;left:50%;transform:translate(-50%,-50%) rotate(-35deg);font-size:80px;font-weight:900;color:rgba(180,0,0,0.055);white-space:nowrap;pointer-events:none;z-index:0;letter-spacing:8px;}
  .content{position:relative;z-index:1;max-width:700px;margin:0 auto;}
  .header{border-bottom:2.5px solid #111;padding-bottom:18px;margin-bottom:26px;}
  .logo{font-size:10px;font-weight:900;letter-spacing:0.3em;text-transform:uppercase;color:#666;margin-bottom:6px;}
  h1{font-size:26px;font-weight:900;margin-bottom:4px;}
  .pitch-call{font-size:13px;color:#6366f1;font-weight:700;margin-bottom:8px;}
  .meta{font-size:11px;color:#666;line-height:1.8;}
  .legal{background:#fef3c7;border:1px solid #f59e0b;border-radius:8px;padding:12px 16px;margin-bottom:26px;font-size:11px;color:#92400e;font-weight:600;}
  .section{margin-bottom:22px;}
  .label{font-size:9px;font-weight:900;letter-spacing:0.2em;text-transform:uppercase;color:#aaa;border-bottom:1px solid #f0f0f0;padding-bottom:5px;margin-bottom:8px;}
  .content-text{color:#333;font-size:13px;white-space:pre-wrap;line-height:1.7;}
  .logline{font-style:italic;color:#555;border-left:3px solid #e0e0e0;padding-left:12px;}
  .tag{display:inline-block;background:#f3f4f6;border:1px solid #e5e7eb;border-radius:4px;padding:2px 8px;font-size:11px;font-weight:600;margin:2px;color:#374151;}
  .ip-box{background:#f0fdf4;border:1px solid #86efac;border-radius:8px;padding:12px 16px;}
  .ip-item{font-size:12px;color:#15803d;font-weight:700;margin-bottom:4px;}
  .ip-item::before{content:'✓  ';}
  .chain{background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:12px 16px;margin-top:8px;font-size:11px;}
  .chain-row{display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid #f1f5f9;}
  .chain-row:last-child{border:none;}
  .ch-label{color:#64748b;font-weight:600;}
  .ch-val{color:#1e293b;font-weight:700;font-family:monospace;font-size:10px;}
  .footer{margin-top:40px;padding-top:16px;border-top:1px solid #e5e7eb;display:flex;justify-content:space-between;font-size:10px;color:#aaa;}
  @media print{body{padding:28px 36px;}@page{margin:20mm;}}
</style>
</head>
<body>
<div class="watermark">CINECRAFT · CONFIDENTIAL</div>
<div class="content">
  <div class="header">
    <div class="logo">CineCraft Connect — Official Pitch Record</div>
    <h1>${submission.title}</h1>
    <div class="pitch-call">Submitted to: ${pitchCallTitle}</div>
    <div class="meta">Submitted by: <strong>${submission.profiles?.full_name || 'Writer'}</strong> · Date: <strong>${submittedAt}</strong> · Reviewed by: <strong>${reviewerName}</strong> · Downloaded: <strong>${timestamp}</strong></div>
  </div>
  <div class="legal">⚠ LEGAL NOTICE: This document is confidential under CineCraft's Pitch Marketplace Terms. Unauthorized distribution is actionable under IPC §420 and the Indian IT Act 2000. This download event has been permanently logged as legal evidence.</div>
  <div class="section"><div class="label">Logline</div><div class="content-text logline">"${submission.logline}"</div></div>
  ${submission.genre || submission.language || submission.format ? `<div class="section"><div class="label">Tags</div><div>${[submission.genre,submission.language,submission.format,submission.tone].filter(Boolean).map(t=>`<span class="tag">${t}</span>`).join('')}</div></div>` : ''}
  <div class="section"><div class="label">Short Synopsis</div><div class="content-text">${submission.short_synopsis||'—'}</div></div>
  ${submission.full_synopsis?`<div class="section"><div class="label">Full Synopsis (Protected)</div><div class="content-text">${submission.full_synopsis}</div></div>`:''}
  ${submission.why_fits?`<div class="section"><div class="label">Why This Fits the Call</div><div class="content-text">${submission.why_fits}</div></div>`:''}
  ${submission.character_notes?`<div class="section"><div class="label">Character Notes</div><div class="content-text">${submission.character_notes}</div></div>`:''}
  <div class="section"><div class="label">IP Declarations</div><div class="ip-box">
    ${submission.rights_owned?'<div class="ip-item">Rights Owned by Submitter</div>':''}
    ${submission.is_original_work?'<div class="ip-item">Declared as Original Work</div>':''}
    ${(submission as any).guild_registration_number?`<div class="ip-item">Guild Registration: ${(submission as any).guild_registration_number}</div>`:''}
    ${(submission as any).nda_signature?`<div class="ip-item">Writer NDA Signed: ${(submission as any).nda_signature}</div>`:''}
  </div></div>
  <div class="section"><div class="label">Chain of Custody Log</div><div class="chain">
    <div class="chain-row"><span class="ch-label">Submission ID</span><span class="ch-val">${submission.id}</span></div>
    <div class="chain-row"><span class="ch-label">Pitch Call</span><span class="ch-val">${pitchCallTitle}</span></div>
    <div class="chain-row"><span class="ch-label">Submitted (UTC)</span><span class="ch-val">${new Date(submission.submitted_at).toISOString()}</span></div>
    <div class="chain-row"><span class="ch-label">Reviewed By</span><span class="ch-val">${reviewerName}</span></div>
    <div class="chain-row"><span class="ch-label">Download Timestamp (IST)</span><span class="ch-val">${timestamp}</span></div>
    <div class="chain-row"><span class="ch-label">Platform</span><span class="ch-val">CineCraft Connect — Pitch Marketplace</span></div>
  </div></div>
  <div class="footer"><span>Generated by CineCraft Connect · cinecraftconnect.com</span><span>${timestamp}</span></div>
</div>
<script>window.onload=function(){window.print();}</script>
</body></html>`;

    const win = window.open('', '_blank');
    if (win) { win.document.write(html); win.document.close(); }
};

// ── NDA Gate ──────────────────────────────────────────────────────────────────
const NDAGate = ({ submissionId, onSigned }: { submissionId: string; onSigned: () => void }) => {
    const { profile, user } = useAuth();
    const [signature, setSignature] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSign = async () => {
        if (signature.trim().length < 3 || !user) return;
        setLoading(true);
        try {
            await (supabase as any).from('nda_viewer_signatures').insert({
                pitch_submission_id: submissionId, signed_by: user.id,
                signature: signature.trim(), signed_at: new Date().toISOString(),
            });
        } catch { /* already signed */ }
        onSigned();
        setLoading(false);
    };

    return (
        <div className="max-w-md mx-auto py-16 text-center space-y-6">
            <div className="relative inline-flex">
                <div className="h-20 w-20 rounded-3xl bg-amber-500/10 border-2 border-amber-500/20 flex items-center justify-center">
                    <PenLine className="h-10 w-10 text-amber-500" />
                </div>
                <div className="absolute inset-0 rounded-3xl bg-amber-500/5 animate-ping" />
            </div>
            <div className="space-y-2">
                <h2 className="text-2xl font-black">NDA Required</h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                    This pitch is NDA-protected. Sign below to unlock the full content. Your signature and identity are permanently recorded.
                </p>
            </div>
            <div className="text-left space-y-4 p-6 bg-amber-500/5 border border-amber-400/30 rounded-2xl">
                <ul className="space-y-2 text-xs text-muted-foreground">
                    {['Treat this pitch with strict confidentiality','Not share the content with any third party','Be bound by the CineCraft Arbitration Clause'].map((t,i) => (
                        <li key={i} className="flex items-start gap-2"><span className="text-amber-500 mt-0.5 shrink-0">•</span>{t}</li>
                    ))}
                </ul>
                <div className="space-y-2">
                    <Label className="text-xs font-black uppercase tracking-widest">Type your full legal name *</Label>
                    <Input
                        placeholder={(profile as any)?.full_name || 'Your full legal name'}
                        value={signature}
                        onChange={e => setSignature(e.target.value)}
                        className={cn('h-12 transition-all', signature.trim().length >= 3 ? 'border-green-500/50 bg-green-500/5' : 'border-amber-400/40')}
                    />
                    {signature.trim().length >= 3 && (
                        <p className="text-xs text-green-500 font-semibold flex items-center gap-1.5">
                            <CheckCircle2 className="h-3.5 w-3.5" /> Signed as "{signature}" — timestamp will be logged
                        </p>
                    )}
                </div>
                <Button className="w-full h-11 bg-amber-500 hover:bg-amber-600 text-white font-black" disabled={signature.trim().length < 3 || loading} onClick={handleSign}>
                    <PenLine className="h-4 w-4 mr-2" />{loading ? 'Recording…' : 'Sign NDA & View Pitch'}
                </Button>
            </div>
        </div>
    );
};

// ── Attachment Link ───────────────────────────────────────────────────────────
const AttachmentLink = ({ href, label, submissionId }: { href: string; label: string; ndaSigned: boolean; submissionId: string }) => {
    const [showWarning, setShowWarning] = useState(false);
    const { user } = useAuth();
    const handleProceed = async () => {
        await (supabase as any).from('pitch_access_logs').insert({ pitch_submission_id: submissionId, accessed_by: user?.id, action: 'attachment_opened' }).then(()=>{}).catch(()=>{});
        window.open(href, '_blank', 'noopener,noreferrer');
        setShowWarning(false);
    };
    return (
        <>
            <button onClick={() => setShowWarning(true)} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-muted/40 border border-border/50 hover:border-primary/30 hover:bg-primary/5 transition-all text-sm font-semibold group">
                <FileText className="h-4 w-4 text-primary" />{label}
                <ExternalLink className="h-3 w-3 text-muted-foreground group-hover:text-primary transition-colors" />
            </button>
            {showWarning && (
                <div className="fixed inset-0 bg-black/70 z-[9999] flex items-center justify-center p-4" onClick={() => setShowWarning(false)}>
                    <div className="bg-card border border-border rounded-2xl p-6 max-w-sm w-full shadow-2xl" onClick={e => e.stopPropagation()}>
                        <div className="flex items-start gap-3 mb-4">
                            <div className="h-10 w-10 bg-amber-500/10 rounded-xl flex items-center justify-center shrink-0"><AlertTriangle className="h-5 w-5 text-amber-500" /></div>
                            <div><p className="font-black">Confidential Attachment</p><p className="text-xs text-muted-foreground">Access will be permanently logged</p></div>
                            <button onClick={() => setShowWarning(false)} className="ml-auto text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
                        </div>
                        <p className="text-xs text-muted-foreground leading-relaxed mb-5">Sharing this document violates the NDA you signed. This event is permanently recorded as legal evidence.</p>
                        <div className="flex gap-2">
                            <Button variant="outline" size="sm" className="flex-1" onClick={() => setShowWarning(false)}>Cancel</Button>
                            <Button size="sm" className="flex-1 gap-1.5" onClick={handleProceed}><ExternalLink className="h-3.5 w-3.5" /> Open File</Button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function ReviewSubmission() {
    const { submissionId } = useParams<{ submissionId: string }>();
    const { push, goBack } = useAppNavigation();
    const { user, profile } = useAuth();
    const { toast } = useToast();

    const [submission, setSubmission] = useState<PitchSubmission | null>(null);
    const [fetching, setFetching] = useState(true);
    const [ndaRequired, setNdaRequired] = useState(false);
    const [ndaGatePassed, setNdaGatePassed] = useState(false);
    const [checkingNda, setCheckingNda] = useState(true);
    const [downloading, setDownloading] = useState(false);
    const [updatingStatus, setUpdatingStatus] = useState('');

    useEffect(() => {
        if (!submissionId) return;
        const load = async () => {
            setFetching(true);
            try {
                const { data, error } = await supabase
                    .from('pitch_submissions')
                    .select(`*, profiles:submitter_id (full_name, avatar_url, craft, username, location, is_verified), pitch_calls:pitch_call_id (title, nda_required)`)
                    .eq('id', submissionId)
                    .single();
                if (error) throw error;
                setSubmission(data as any);
                const nda = !!(data as any).pitch_calls?.nda_required;
                setNdaRequired(nda);
                if (!nda || !user) { setNdaGatePassed(true); setCheckingNda(false); return; }
                const { data: sig } = await (supabase as any).from('nda_viewer_signatures').select('id').eq('pitch_submission_id', submissionId).eq('signed_by', user.id).maybeSingle();
                setNdaGatePassed(!!sig);
            } catch {
                toast({ title: 'Error', description: 'Could not load submission.', variant: 'destructive' });
                goBack();
            } finally {
                setFetching(false);
                setCheckingNda(false);
            }
        };
        load();
    }, [submissionId, user?.id]);

    const NOTIFY_CONFIGS: Record<string, { title: string; message: string; priority: string; actionable: boolean }> = {
        request_full_deck: { title: '📄 Full Deck Requested!', message: 'A producer has reviewed your pitch and is requesting your full pitch deck. Time to shine!', priority: 'high', actionable: true },
        shortlisted:       { title: '⭐ Your Pitch Was Shortlisted!', message: 'A producer has shortlisted your pitch. Your story caught their attention!', priority: 'high', actionable: false },
        interested:        { title: '🎉 A Producer Is Interested!', message: 'A producer has marked your pitch as "Interested". They may reach out soon.', priority: 'urgent', actionable: false },
        invite_to_discuss: { title: "💬 You've Been Invited to Discuss!", message: 'A producer wants to talk about your pitch. Head to your messages!', priority: 'urgent', actionable: true },
        passed:            { title: 'Pitch Update', message: 'A producer reviewed your pitch and passed this time. Keep pitching!', priority: 'normal', actionable: false },
    };

    const handleUpdateStatus = async (status: string) => {
        if (!submission) return;
        setUpdatingStatus(status);
        await supabase.from('pitch_submissions').update({ status } as any).eq('id', submission.id);
        setSubmission(prev => prev ? { ...prev, status } : prev);
        setUpdatingStatus('');
        toast({ title: 'Status updated', duration: 2000 });
    };

    const handleDownload = async () => {
        if (!submission) return;
        setDownloading(true);
        await (supabase as any).from('pitch_access_logs').insert({ pitch_submission_id: submission.id, accessed_by: user?.id, action: 'pdf_downloaded' }).then(()=>{}).catch(()=>{});
        downloadAsPDF(submission, (profile as any)?.full_name || 'Creator');
        setDownloading(false);
    };

    if (fetching || checkingNda) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center">
                <LoadingSpinner size="lg" />
            </div>
        );
    }

    if (!submission) return null;

    const statusInfo = PITCH_STATUS_LABELS[submission.status || 'submitted'];
    const avatarUrl = getSafeImageUrl(submission.profiles?.avatar_url || null);
    const initials = (submission.profiles?.full_name || 'W').split(' ').map(n => n[0]).join('').toUpperCase();
    const pitchCallTitle = (submission as any).pitch_calls?.title;

    return (
        <div className="min-h-screen bg-background text-foreground pb-28">
            <SEO title={`Reviewing: ${submission.title} | CineCraft`} />

            {/* Ambient blobs */}
            <div className="fixed inset-0 overflow-hidden pointer-events-none">
                <div className="absolute -top-40 -left-20 w-80 h-80 rounded-full bg-primary/5 blur-[100px]" />
                <div className="absolute bottom-10 right-0 w-72 h-72 rounded-full bg-purple-500/4 blur-[120px]" />
            </div>

            <div className="max-w-5xl mx-auto px-4 md:px-8 pt-6 md:pt-20 relative z-10 space-y-6">

                {/* ── TOP CONTROL BAR — always visible ── */}
                <div className="flex items-center justify-between gap-3 flex-wrap">
                    <button
                        onClick={() => push('/pitch?tab=inbox')}
                        className="inline-flex items-center gap-2 text-sm font-bold text-muted-foreground hover:text-foreground transition-colors group"
                    >
                        <ArrowLeft className="h-4 w-4 group-hover:-translate-x-1 transition-transform" />
                        Back to Inbox
                    </button>

                    <div className="flex items-center gap-2 flex-wrap justify-end">
                        <Badge className={cn('text-xs font-bold px-3 py-1', statusInfo.color)}>
                            {statusInfo.label}
                        </Badge>
                        {ndaGatePassed && (
                            <Button
                                size="sm"
                                variant="outline"
                                className="h-9 gap-2 rounded-xl border-primary/30 text-primary hover:bg-primary/10 font-bold"
                                onClick={handleDownload}
                                disabled={downloading}
                            >
                                <Download className="h-3.5 w-3.5" />
                                {downloading ? 'Opening PDF…' : 'Download PDF'}
                            </Button>
                        )}
                    </div>
                </div>

                {/* ── PITCH CALL CONTEXT BANNER ── */}
                {pitchCallTitle && (
                    <motion.div
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="flex items-center gap-3 p-4 bg-primary/5 border border-primary/20 rounded-2xl"
                    >
                        <div className="h-9 w-9 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                            <Megaphone className="h-4.5 w-4.5 text-primary" />
                        </div>
                        <div className="min-w-0">
                            <p className="text-[10px] font-black uppercase tracking-widest text-primary/70 mb-0.5">Submitted in response to</p>
                            <p className="font-black text-foreground text-base leading-tight truncate">"{pitchCallTitle}"</p>
                        </div>
                        <button
                            onClick={() => push(`/pitch/${submission.pitch_call_id}`)}
                            className="ml-auto text-xs font-bold text-primary/70 hover:text-primary transition-colors whitespace-nowrap flex items-center gap-1"
                        >
                            View Call <ChevronRight className="h-3.5 w-3.5" />
                        </button>
                    </motion.div>
                )}

                {/* ── WRITER IDENTITY CARD ── */}
                <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.04 }}
                    className="flex items-center gap-4 p-5 bg-card border border-border/60 rounded-2xl"
                >
                    <Avatar className="h-14 w-14 rounded-2xl ring-2 ring-border/30 shrink-0">
                        <AvatarImage src={avatarUrl || undefined} />
                        <AvatarFallback className="bg-primary/10 text-primary font-black text-xl rounded-2xl">{initials}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-black text-lg">{submission.profiles?.full_name || 'Writer'}</p>
                            <span className="text-xs font-bold text-primary bg-primary/10 px-2.5 py-0.5 rounded-full uppercase tracking-wide">
                                {submission.profiles?.craft || 'Creator'}
                            </span>
                        </div>
                        <p className="text-xs text-muted-foreground flex items-center gap-1.5 mt-1">
                            <Clock className="h-3 w-3 shrink-0" />
                            Submitted {formatDistanceToNow(new Date(submission.submitted_at), { addSuffix: true })}
                        </p>
                    </div>
                    <Button
                        variant="outline"
                        className="shrink-0 h-10 rounded-xl font-bold gap-2 text-sm"
                        onClick={() => push(`/dm/${submission.submitter_id}`)}
                    >
                        <MessageSquare className="h-4 w-4" />
                        <span className="hidden sm:inline">Message</span>
                    </Button>
                </motion.div>

                {/* NDA Gate — shown centered if not passed */}
                {!ndaGatePassed ? (
                    <NDAGate submissionId={submission.id} onSigned={() => setNdaGatePassed(true)} />
                ) : (
                    <div className="grid lg:grid-cols-12 gap-6">

                        {/* ── LEFT — Pitch Content ── */}
                        <div className="lg:col-span-8 space-y-5">

                            {/* Title + Logline */}
                            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.06 }} className="bg-card border border-border/60 rounded-2xl p-6 space-y-3">
                                <h1 className="text-2xl md:text-3xl font-black text-foreground leading-tight">{submission.title}</h1>
                                <p className="text-primary font-semibold italic border-l-2 border-primary/30 pl-4 py-0.5 leading-relaxed">
                                    "{submission.logline}"
                                </p>
                                {/* Tags */}
                                {(submission.genre || submission.language || submission.format || submission.tone) && (
                                    <div className="flex flex-wrap gap-2 pt-1">
                                        {[submission.genre, submission.language, submission.format, submission.tone].filter(Boolean).map((tag, i) => (
                                            <span key={i} className="text-xs font-semibold bg-muted/50 border border-border/40 px-3 py-1 rounded-full">{tag}</span>
                                        ))}
                                    </div>
                                )}
                            </motion.div>

                            {/* Short Synopsis */}
                            <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }} className="bg-card border border-border/60 rounded-2xl p-6 space-y-3">
                                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">Short Synopsis</p>
                                <p className="text-sm leading-relaxed text-foreground/90">{submission.short_synopsis}</p>
                            </motion.section>

                            {/* Full Synopsis — Watermarked */}
                            {submission.full_synopsis && (
                                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
                                    <WatermarkedContent className="space-y-3 p-6 bg-primary/5 border border-primary/20 rounded-2xl">
                                        <div className="flex items-center gap-2">
                                            <div className="h-7 w-7 bg-primary/10 rounded-lg flex items-center justify-center shrink-0">
                                                <Lock className="h-3.5 w-3.5 text-primary" />
                                            </div>
                                            <p className="text-xs font-black uppercase tracking-widest text-primary">Full Synopsis — Protected & Watermarked</p>
                                        </div>
                                        <p className="text-sm leading-relaxed text-foreground/90">{submission.full_synopsis}</p>
                                    </WatermarkedContent>
                                </motion.div>
                            )}

                            {/* Why it Fits */}
                            {submission.why_fits && (
                                <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }} className="bg-card border border-border/60 rounded-2xl p-6 space-y-3">
                                    <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">Why This Fits Your Call</p>
                                    <p className="text-sm leading-relaxed text-muted-foreground">{submission.why_fits}</p>
                                </motion.section>
                            )}

                            {/* Character Notes */}
                            {submission.character_notes && (
                                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.14 }}>
                                    <WatermarkedContent className="bg-card border border-border/60 rounded-2xl p-6 space-y-3">
                                        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">Character Notes</p>
                                        <p className="text-sm leading-relaxed">{submission.character_notes}</p>
                                    </WatermarkedContent>
                                </motion.div>
                            )}

                            {/* Attachments */}
                            {(submission.treatment_url || submission.lookbook_url || (submission as any).full_deck_url) && (
                                <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.16 }} className="bg-card border border-border/60 rounded-2xl p-6 space-y-3">
                                    <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">Attachments</p>
                                    <div className="flex gap-2 flex-wrap">
                                        {(submission as any).full_deck_url && <AttachmentLink href={(submission as any).full_deck_url} label="Full Deck (Requested)" ndaSigned={ndaGatePassed} submissionId={submission.id} />}
                                        {submission.treatment_url && <AttachmentLink href={submission.treatment_url} label="Treatment / Pitch Deck" ndaSigned={ndaGatePassed} submissionId={submission.id} />}
                                        {submission.lookbook_url && <AttachmentLink href={submission.lookbook_url} label="Lookbook" ndaSigned={ndaGatePassed} submissionId={submission.id} />}
                                    </div>
                                </motion.section>
                            )}

                            {/* IP Declarations */}
                            <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18 }} className="p-5 bg-green-500/5 border border-green-500/20 rounded-2xl space-y-3">
                                <p className="text-[10px] font-black uppercase tracking-widest text-green-600/80">IP Declarations</p>
                                <div className="flex flex-wrap items-center gap-3">
                                    <span className={cn('flex items-center gap-1.5 text-sm font-bold', submission.rights_owned ? 'text-green-500' : 'text-destructive')}>
                                        {submission.rights_owned ? <CheckCircle2 className="h-4 w-4" /> : <X className="h-4 w-4" />} Rights Owned
                                    </span>
                                    <span className="text-border">·</span>
                                    <span className={cn('flex items-center gap-1.5 text-sm font-bold', submission.is_original_work ? 'text-green-500' : 'text-destructive')}>
                                        {submission.is_original_work ? <CheckCircle2 className="h-4 w-4" /> : <X className="h-4 w-4" />} Original Work
                                    </span>
                                    {(submission as any).nda_signature && (
                                        <><span className="text-border">·</span><span className="flex items-center gap-1.5 text-sm font-bold text-amber-500"><Shield className="h-4 w-4" /> NDA Signed</span></>
                                    )}
                                </div>
                                {(submission as any).guild_registration_number ? (
                                    <div className="flex items-center gap-2">
                                        <Award className="h-4 w-4 text-primary" />
                                        <span className="text-xs font-bold text-primary">Guild Registered:</span>
                                        <code className="text-xs bg-primary/10 px-2 py-0.5 rounded-md font-mono text-primary">{(submission as any).guild_registration_number}</code>
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-2">
                                        <AlertTriangle className="h-3.5 w-3.5 text-muted-foreground" />
                                        <span className="text-xs text-muted-foreground">No SWA/WGA registration number provided</span>
                                    </div>
                                )}
                            </motion.section>
                        </div>

                        {/* ── RIGHT Sidebar — Decision Panel ── */}
                        <div className="lg:col-span-4">
                            <motion.div
                                initial={{ opacity: 0, x: 12 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: 0.08 }}
                                className="sticky top-24 bg-card border border-border/60 rounded-2xl p-5 space-y-4"
                            >
                                <div>
                                    <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 mb-1">Your Decision</p>
                                    <p className="text-xs text-muted-foreground">How do you feel about this pitch?</p>
                                </div>

                                <div className="space-y-2">
                                    {STATUS_ACTIONS.map(action => {
                                        const isActive = submission.status === action.value;
                                        return (
                                            <button
                                                key={action.value}
                                                onClick={() => handleUpdateStatus(action.value)}
                                                disabled={updatingStatus !== ''}
                                                className={cn(
                                                    'w-full flex items-center gap-3 px-4 py-3 rounded-xl border text-sm font-bold transition-all text-left',
                                                    isActive
                                                        ? `${action.activeBg} text-white border-transparent shadow-md`
                                                        : `bg-card/50 ${action.ring} ${action.color} hover:bg-muted/30`
                                                )}
                                            >
                                                <action.icon className="h-4 w-4 shrink-0" />
                                                {action.label}
                                                {updatingStatus === action.value && (
                                                    <span className="ml-auto h-3 w-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
                                                )}
                                                {isActive && updatingStatus === '' && (
                                                    <CheckCircle2 className="ml-auto h-4 w-4 opacity-80" />
                                                )}
                                            </button>
                                        );
                                    })}
                                </div>

                                {(submission.status === 'interested' || submission.status === 'invite_to_discuss') && (
                                    <Button
                                        className="w-full h-11 bg-green-600 hover:bg-green-700 text-white font-black rounded-xl gap-2"
                                        onClick={() => push(`/dm/${submission.submitter_id}`)}
                                    >
                                        <Sparkles className="h-4 w-4" /> Start Collaboration
                                        <ChevronRight className="h-4 w-4" />
                                    </Button>
                                )}

                                <div className="pt-2 border-t border-border/40">
                                    <Button variant="ghost" size="sm" className="w-full gap-2 text-muted-foreground hover:text-foreground text-xs" onClick={() => push(`/profile/${submission.submitter_id}`)}>
                                        <User className="h-3.5 w-3.5" /> View Writer's Profile
                                    </Button>
                                </div>
                            </motion.div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
