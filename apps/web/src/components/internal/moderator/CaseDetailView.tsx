import React, { useState, useEffect } from 'react';
import { SuggestionBanner, BundleButtons } from './CaseAssist';
import { 
  Shield, User, AlertTriangle, 
  Trash2, Ban, 
  FileText, ExternalLink, Send,
  ArrowLeft, ThumbsUp,
  ShieldAlert, ShieldCheck, EyeOff, Copy
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useGovernance } from '@/hooks/useGovernance';
import { GovernanceService } from '@/services/governance/GovernanceService';
import type { GovernanceAction } from '@/services/governance/types';
import { useAuth } from '@/contexts/AuthContext';
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { friendlyError } from '@cinecraft/core';
import ReasonDialog from '@/components/internal/shared/ReasonDialog';
import { safeUsername, safeInitials, trustScoreOr } from '@/components/internal/shared/staffHelpers';
import { CaseTimeline, ClaimLockBanner, EscalationBanner, ReplyPicker, ReportersList, RepeatOffenderBanner, useRepeatFacts } from './CaseToolsParts';
import { canActOnCase, claimInfo, escalationError, isOpenStatus, type EscalationTarget } from './caseTools';
import { DuplicateBanner, MarkDuplicateDialog } from './DuplicateTools';

interface CaseDetailViewProps {
  caseId: string;
  onClose: () => void;
  /** a keyboard shortcut for this case (c, d, e); n changes on every press so the same key twice still runs */
  command?: { action: 'claim' | 'dismiss' | 'escalate'; n: number } | null;
  /** open another case (the primary of a duplicate) */
  onOpenCase?: (id: string) => void;
}

const CaseDetailView: React.FC<CaseDetailViewProps> = ({ caseId, onClose, command, onOpenCase }) => {
  const [duplicateOpen, setDuplicateOpen] = useState(false);
  const [data, setData] = useState<any>(null);
  const [authorityOpen, setAuthorityOpen] = useState(false);
  type EnforceAction = 'dismiss' | 'warn' | 'mute' | 'delete' | 'ban' | 'shadowban';
  const [pendingAction, setPendingAction] = useState<EnforceAction | null>(null);
  const [acting, setActing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [note, setNote] = useState('');
  const [notes, setNotes] = useState<any[]>([]);
  const [targetAuthor, setTargetAuthor] = useState<any>(null);
  // true once the author lookup has finished, so a deleted or unsupported target does not stay on "Resolving..." forever
  const [authorLookupDone, setAuthorLookupDone] = useState(false);
  const [targetContent, setTargetContent] = useState<any>(null);
  const [contentChecked, setContentChecked] = useState(false);
  const [activeTab, setActiveTab] = useState<'details' | 'history' | 'evidence' | 'actions'>('details');
  const { toast } = useToast();
  const { user } = useAuth();
  const { hasPermission, requiresApproval } = useGovernance();
  const [escalateOpen, setEscalateOpen] = useState(false);
  const [timelineKey, setTimelineKey] = useState(0);
  const repeatFacts = useRepeatFacts(targetAuthor?.id);
  // the claim is shown from the moment the case loads; an admin may step in, an idle claim may be taken by anyone
  const lock = data ? claimInfo(data, user?.id) : null;
  const rank = hasPermission('user.verify') ? 2 : 1; // verifying people is an admin-level permission
  const mayAct = lock ? canActOnCase(lock, rank) : true;

  useEffect(() => {
    fetchCaseDetails();
  }, [caseId]);

  const fetchCaseDetails = async () => {
    setLoading(true);
    const { data } = await (supabase as any)
      .from('content_reports')
      .select(`
        *,
        reporter:reported_by(username, full_name, avatar_url, trust_score),
        assigned_moderator:assigned_to(username)
      `)
      .eq('id', caseId)
      .single();
    
    if (data) {
      setData(data);
      resolveTargetAuthor(data);
      fetchTargetContent(data);
      fetchNotes();
    }
    setLoading(false);
  };

  const recordAuthority = async (ref: string) => {
    const { error } = await (supabase as any).rpc('staff_record_authority_report', { p_report: caseId, p_ref: ref });
    if (error) { toast({ title: 'Could not record it', description: friendlyError(error), variant: 'destructive' }); return; }
    toast({ title: 'Recorded', description: 'The report is marked as passed to the authorities.' });
    setData({ ...data, authority_reported_at: new Date().toISOString(), authority_ref: ref });
  };

  const fetchNotes = async () => {
    // 1. Fetch the notes first
    const { data: notesData, error: notesError } = await (supabase as any)
      .from('moderation_notes')
      .select('*')
      .eq('report_id', caseId)
      .order('created_at', { ascending: false });
    
    if (notesError) {
      console.error('Error fetching moderation notes:', notesError);
      return;
    }
    
    if (!notesData || notesData.length === 0) {
      setNotes([]);
      return;
    }

    // 2. Fetch the moderator profiles manually since FK constraint is missing
    const moderatorIds = Array.from(new Set(notesData.map((n: any) => n.author_id || n.moderator_id))) as string[];
    
    const { data: profilesData } = await supabase
      .from('profiles')
      .select('id, username, avatar_url')
      .in('id', moderatorIds);

    // 3. Merge profile data into notes
    const profilesMap = new Map(profilesData?.map(p => [p.id, p]));
    const notesWithAuthors = notesData.map((n: any) => ({
      ...n,
      author: profilesMap.get(n.author_id || n.moderator_id)
    }));

    setNotes(notesWithAuthors);
  };

  const fetchTargetContent = async (reportData: any) => {
    let table = '';

    switch (reportData.target_type) {
      case 'post': table = 'posts'; break;
      case 'comment': table = 'post_comments'; break;
      case 'job': table = 'jobs'; break;
      case 'listing': table = 'marketplace_listings'; break;
      default: setContentChecked(true); return;
    }

    const { data: content } = await (supabase as any)
      .from(table)
      .select('*')
      .eq('id', reportData.target_id)
      .single();

    if (content) {
      setTargetContent(content);
    }
    setContentChecked(true);
  };

  const resolveTargetAuthor = async (reportData: any) => {
    setAuthorLookupDone(false);
    try {
      if (reportData.target_type === 'user') {
        const { data: profile } = await supabase.from('profiles').select('id, username, avatar_url').eq('id', reportData.target_id).single();
        setTargetAuthor(profile);
        return;
      }

      let table = '';
      let authorIdField = 'author_id';

      switch (reportData.target_type) {
        case 'post': table = 'posts'; break;
        case 'comment': table = 'post_comments'; authorIdField = 'user_id'; break;
        case 'job': table = 'jobs'; authorIdField = 'posted_by'; break;
        case 'listing': table = 'marketplace_listings'; authorIdField = 'user_id'; break;
        default: return;
      }

      const { data: content } = await (supabase as any).from(table).select(authorIdField).eq('id', reportData.target_id).maybeSingle();
      if (content && content[authorIdField]) {
        const { data: profile } = await supabase.from('profiles').select('id, username, avatar_url').eq('id', content[authorIdField]).single();
        setTargetAuthor(profile);
      }
    } catch {
      /* the target may be deleted or hidden: the label below says so */
    } finally {
      setAuthorLookupDone(true);
    }
  };

  const handleClaimCase = async () => {
    if (!user) return;
    if (!hasPermission('report.claim')) {
      toast({ title: 'Access Denied', description: 'Insufficient permissions to claim cases.', variant: 'destructive' });
      return;
    }
    try {
      await GovernanceService.claimReport(caseId);
      toast({ title: 'Case Claimed', description: 'You are now assigned to this case.' });
      fetchCaseDetails();
    } catch (error: any) {
      toast({ title: 'Could not claim this case', description: friendlyError(error), variant: 'destructive' });
    }
  };

  const handleAction = async (action: EnforceAction, reason: string) => {
    if (!user || acting) return;
    const actionMap: Record<string, any> = {
      dismiss: 'report.resolve',
      warn: 'user.warn',
      delete: 'content.delete',
      ban: 'user.ban',
      shadowban: 'user.warn' // same staff level as a warning; the database queues it for a second person
    };
    const govAction = actionMap[action];
    if (!govAction || !hasPermission(govAction)) {
      toast({ title: 'Access Denied', description: `Insufficient permissions for ${action}.`, variant: 'destructive' });
      return;
    }
    // delete = take the content down, which needs a second person; so does a ban. Dismiss and warn run now.
    const reportAction = ({ dismiss: 'dismiss', warn: 'warn', delete: 'takedown', ban: 'ban', shadowban: 'shadowban' } as const)[action as 'dismiss' | 'warn' | 'delete' | 'ban' | 'shadowban'];
    if (!reportAction) return;
    setActing(true);
    try {
      const { pending } = await GovernanceService.resolveReport(caseId, reportAction, reason.trim());
      if (pending) {
        toast({ title: 'Sent for second approval', description: 'A different staff member must approve this in the approval queue before it takes effect.' });
      } else {
        toast({ title: action === 'warn' ? 'Warning sent' : 'Report dismissed' });
      }
      onClose();
    } catch (error: any) {
      toast({ title: 'Action Failed', description: friendlyError(error), variant: 'destructive' });
    } finally {
      setActing(false);
    }
  };

  /** Opens the reason box; the permission check runs first so a forbidden action never asks for a reason. */
  const askReason = (action: EnforceAction) => {
    const need: Record<string, string> = { dismiss: 'report.resolve', warn: 'user.warn', delete: 'content.delete', ban: 'user.ban', shadowban: 'user.warn' };
    if (!need[action] || !hasPermission(need[action] as GovernanceAction)) {
      toast({ title: 'Access Denied', description: `Insufficient permissions for ${action}.`, variant: 'destructive' });
      return;
    }
    setPendingAction(action);
  };

  const ACTION_COPY: Record<string, { title: string; description: string; confirm: string; destructive: boolean }> = {
    dismiss: { title: 'Dismiss this case?', description: 'No violation found. The report is closed and any content hidden by the system comes back.', confirm: 'Dismiss', destructive: false },
    warn: { title: 'Warn the author?', description: 'The author gets a formal warning and a strike. This takes effect at once.', confirm: 'Send warning', destructive: false },
    delete: { title: 'Take the content down?', description: 'This is sent to a second staff member, who must approve it in the approval queue before the content is removed.', confirm: 'Send for approval', destructive: true },
    shadowban: { title: 'Shadowban the author?', description: 'Limits the author reach without telling them. A second staff member must approve it first.', confirm: 'Send for approval', destructive: true },
    ban: { title: 'Suspend the account?', description: 'This is sent to a second staff member, who must approve it in the approval queue before the account is locked.', confirm: 'Send for approval', destructive: true },
  };

  const handleAddNote = async () => {
    if (!note.trim()) return;
    const { error } = await (supabase as any).rpc('add_moderation_note', { p_report: caseId, p_content: note });

    if (error) {
      toast({ title: 'Could not save the note', description: friendlyError(error), variant: 'destructive' });
      return;
    }
    setNote('');
    fetchNotes();
    setTimelineKey((k) => k + 1);
    toast({ title: 'Note Added' });
  };

  const handleEscalate = async (reason: string, target: EscalationTarget) => {
    // content_reports cannot be edited directly (part CZ); the staff function checks the role and writes the audit line
    const problem = escalationError(reason, target);
    if (problem) { toast({ title: 'Escalation Failed', description: problem, variant: 'destructive' }); return; }
    try {
      const { recorded } = await GovernanceService.escalateReport(caseId, reason, target);
      toast({
        title: 'Case Escalated',
        description: recorded ? `Priority increased to urgent and sent to ${target.replace('_', ' ')}.` : 'Priority increased to urgent. The reason is saved once the moderation update is applied.',
      });
      fetchCaseDetails();
      setTimelineKey((k) => k + 1);
    } catch (error: any) {
      toast({ title: 'Escalation Failed', description: friendlyError(error), variant: 'destructive' });
    }
  };

  // keyboard shortcuts from the console: same checks as the buttons (permission, claim lock)
  useEffect(() => {
    if (!command || !data) return;
    if (command.action === 'claim') {
      if (!lock?.held || (!lock.mine && mayAct)) void handleClaimCase();
    } else if (!mayAct) {
      toast({ title: 'Another moderator holds this case', description: 'You cannot act on it until they hand it over or it frees up.', variant: 'destructive' });
    } else if (command.action === 'dismiss') {
      askReason('dismiss');
    } else if (command.action === 'escalate') {
      setEscalateOpen(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [command?.n]);

  const preview = targetContent ?? data?.evidence ?? null;

  const handleViewInContext = () => {
    const typeMap: Record<string, string> = {
      'user': `/profile/${data.target_id}`,
      'post': `/post/${data.target_id}`,
      'comment': `/post/${targetContent?.post_id || data.target_id}`, 
      'job': `/jobs/${data.target_id}`,
      'listing': `/marketplace/${data.target_id}`
    };

    const url = typeMap[data.target_type];
    if (url) window.open(url, '_blank');
    else toast({ title: "Context Unavailable", description: "This content type cannot be viewed in context currently." });
  };

  if (loading || !data) {
    return (
      <div className="flex-1 flex items-center justify-center bg-background">
        <div className="w-10 h-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex-1 bg-background flex flex-col h-[calc(100vh-65px)] border-l border-border/50">
      {/* Header */}
      <div className="px-6 py-4 border-b border-border/50 flex items-center justify-between bg-card/50">
        <div className="flex items-center gap-4">
          <Button aria-label="Back" variant="ghost" size="icon" className="w-8 h-8 rounded-lg" onClick={onClose}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div className="h-6 w-px bg-border/50" />
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-black uppercase tracking-tight">Case ID: {caseId.slice(0, 12)}</h2>
              <Badge className={PRIORITY_STYLES[data.priority as keyof typeof PRIORITY_STYLES] + " text-[12px] font-black uppercase"}>
                {data.status}
              </Badge>
            </div>
            <p className="text-[12px] text-muted-foreground font-medium uppercase tracking-widest">
              Reported {new Date(data.created_at).toLocaleString()}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {(!lock?.held || (!lock.mine && mayAct)) && (
            <Button onClick={handleClaimCase} variant="default" size="sm" className="h-8 text-[12px] font-bold gap-2 rounded-lg bg-primary hover:bg-primary/90 text-white">
              <Shield className="w-3.5 h-3.5" /> {lock?.held ? 'Take Over' : 'Claim Case'}
            </Button>
          )}
          <Button
            onClick={() => setEscalateOpen(true)}
            variant="outline" size="sm" className="h-8 text-[12px] font-bold gap-2 rounded-lg"
          >
            <ShieldAlert className="w-3.5 h-3.5" /> Escalate to Admin
          </Button>
        </div>
      </div>

      {/* Main Content Area - RESIZABLE */}
      <div className="flex-1 overflow-hidden">
        <ResizablePanelGroup direction="horizontal">
          
          {/* Left Panel: Content Preview */}
          <ResizablePanel defaultSize={60} minSize={30}>
            <div className="h-full overflow-y-auto border-r border-border/50 scroll-smooth no-scrollbar">
              <div className="p-6 space-y-8">
                <ClaimLockBanner info={lock!} owner={data.assigned_moderator?.username} />
                <EscalationBanner data={data} />
                <DuplicateBanner caseId={caseId} duplicateOf={data.duplicate_of} onOpenCase={onOpenCase} />
                <ReportersList targetType={data.target_type} targetId={data.target_id} />
                <RepeatOffenderBanner facts={repeatFacts} />
                {/* Violation Summary */}
                {data.fast_lane && (
                  <div role="alert" className="rounded-xl border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm space-y-2">
                    <p className="font-bold text-destructive flex items-center gap-2"><ShieldAlert className="w-4 h-4" /> Child-safety report: fast lane</p>
                    <p className="text-xs text-muted-foreground">Hidden from others where it can be, due within 15 minutes, and only an admin can dismiss it. Keep this case as the record. If it shows a child in danger or abuse material, pass it to the authorities and record the reference below.</p>
                    {data.authority_reported_at ? (
                      <p className="text-xs font-medium">Passed to the authorities on {new Date(data.authority_reported_at).toLocaleString()}{data.authority_ref ? ` · reference ${data.authority_ref}` : ''}</p>
                    ) : (
                      <Button size="sm" variant="outline" className="h-8 text-xs font-bold" onClick={() => setAuthorityOpen(true)}>Record that it was passed to the authorities</Button>
                    )}
                  </div>
                )}
                <SuggestionBanner reportId={caseId} />
                {Array.isArray(data.auto_actions) && data.auto_actions.length > 0 && (
                  <div className="rounded-xl border border-border/50 bg-muted/30 px-4 py-3 text-xs space-y-1">
                    <p className="font-bold uppercase tracking-wider text-muted-foreground text-[12px]">What the system did</p>
                    {data.auto_actions.map((a: string) => (
                      <p key={a}>{a === 'child_safety' ? 'Child-safety fast lane: marked urgent, due in 15 minutes, admins alerted.' : a === 'hide' ? 'Hid the content from others until a moderator looks.' : a === 'trusted_reporter' ? 'Raised the priority: this reporter\'s reports are usually upheld.' : a === 'low_reliability' ? 'Lowered the priority: most of this reporter\'s earlier reports were dismissed.' : a.startsWith('rule:') ? 'Matched the rule: ' + a.slice(5) : a}</p>
                    ))}
                  </div>
                )}
                <div className="space-y-4">
                  <h3 className="text-[12px] font-black uppercase tracking-widest text-muted-foreground">Violation Overview</h3>
                  <div className="glass-card p-6 border-amber-500/20 bg-amber-500/5">
                    <div className="flex items-start gap-4">
                      <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center shrink-0">
                        <AlertTriangle className="w-5 h-5 text-amber-500" />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-foreground uppercase tracking-tight mb-1">{data.reason.replace(/_/g, ' ')}</h4>
                        <p className="text-xs text-muted-foreground leading-relaxed italic">
                          "{data.details || (data.reported_by ? 'No additional details provided by reporter.' : 'No details.')}"
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {(() => { return null; })()}
                {/* Content Preview */}
                {data.target_type !== 'user' && (
                  <div className="space-y-4">
                    <h3 className="text-[12px] font-black uppercase tracking-widest text-muted-foreground flex items-center justify-between">
                      <span>Reported Content Preview</span>
                      {preview && (
                        <span className="text-primary font-black">{targetContent ? 'LIVE DATA' : 'SAVED WHEN REPORTED'}</span>
                      )}
                    </h3>
                    
                    <div className="glass-card border-border/50 overflow-hidden bg-card/30">
                      <div className="p-4 border-b border-border/10 flex items-center justify-between bg-muted/20">
                        <div className="flex items-center gap-3">
                          <Avatar className="w-8 h-8 border border-border/50">
                            <AvatarImage src={targetAuthor?.avatar_url} />
                            <AvatarFallback className="text-[12px] font-bold bg-primary/10 text-primary">
                              {safeInitials(targetAuthor)}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="text-[12px] font-black tracking-tight">{targetAuthor?.username ? `@${targetAuthor.username}` : authorLookupDone ? 'Author not available (content removed or not supported)' : 'Resolving author...'}</p>
                            <p className="text-[12px] text-muted-foreground uppercase font-medium">{data.target_type} • ID: {data.target_id.slice(0, 8)}</p>
                          </div>
                        </div>
                        <Button 
                          onClick={handleViewInContext}
                          variant="ghost" size="sm" className="h-7 text-[12px] font-bold gap-1.5 rounded-lg px-2 text-primary hover:bg-primary/10"
                        >
                          <ExternalLink className="w-3 h-3" /> View In Context
                        </Button>
                      </div>

                      <div className="space-y-0">
                        {preview ? (
                          <>
                            {(preview.content || preview.description) && (
                              <div className="px-5 pt-4 pb-3">
                                {preview.title && <h5 className="font-bold text-sm text-foreground mb-2">{preview.title}</h5>}
                                <p className="text-sm text-foreground/90 leading-relaxed whitespace-pre-wrap">
                                  {preview.content || preview.description}
                                </p>
                              </div>
                            )}

                            {preview.media_items && preview.media_items.length > 0 && (
                              <div className="w-full bg-black">
                                {preview.media_items.map((item: any, idx: number) => (
                                  item.type === 'video' ? (
                                    <video key={idx} src={item.url} controls className="w-full max-h-[500px] object-contain" />
                                  ) : (
                                    <img loading="lazy" decoding="async" key={idx} src={item.url} alt="Media" className="w-full max-h-[500px] object-contain" />
                                  )
                                ))}
                              </div>
                            )}

                            {!preview.media_items?.length && preview.media_urls?.length > 0 && (
                              <div className="w-full bg-black">
                                {preview.media_urls.map((url: string, idx: number) => (
                                  <img loading="lazy" decoding="async" key={idx} src={url} alt="Media" className="w-full max-h-[500px] object-contain" />
                                ))}
                              </div>
                            )}

                            {!preview.media_items?.length && !preview.media_urls?.length && preview.images?.length > 0 && (
                              <div className={`grid gap-0.5 ${preview.images.length > 1 ? 'grid-cols-2' : 'grid-cols-1'}`}>
                                {preview.images.map((url: string, idx: number) => (
                                  <img loading="lazy" decoding="async" key={idx} src={url} alt="Media" className="w-full aspect-square object-cover" />
                                ))}
                              </div>
                            )}

                            {preview.price && (
                              <div className="px-5 py-3 border-t border-border/10 flex items-center justify-between">
                                <span className="text-[12px] font-black text-muted-foreground uppercase tracking-widest">Marketplace Price</span>
                                <span className="text-sm font-black text-primary">{preview.price}</span>
                              </div>
                            )}

                            {!preview.content && !preview.description && !preview.media_items?.length && !preview.media_urls?.length && !preview.images?.length && (
                              <div className="py-12 text-center">
                                <p className="text-xs text-muted-foreground italic">No text or media content available.</p>
                              </div>
                            )}
                          </>
                        ) : (
                          <div className="py-12 flex flex-col items-center justify-center gap-3">
                            {contentChecked ? (
                              <p className="text-xs text-muted-foreground italic px-6 text-center">This content no longer exists and no copy was saved when it was reported.</p>
                            ) : (
                              <>
                                <div className="w-6 h-6 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
                                <p className="text-[12px] font-black uppercase tracking-widest text-muted-foreground">Loading…</p>
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Reporter Profile */}
                <div className="space-y-4">
                  <h3 className="text-[12px] font-black uppercase tracking-widest text-muted-foreground">{data.reported_by ? 'Reporter Profile' : 'Source'}</h3>
                  <div className="glass-card p-4 border-border/50 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <User className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-foreground">{data.reported_by ? `@${safeUsername(data.reporter)}` : 'Found automatically'}</p>
                        {!data.reported_by && <p className="text-[12px] text-muted-foreground mt-0.5">{data.auto_rule || 'Automatic detection'}. A person has to decide.</p>}
                        {data.reported_by && (
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[12px] font-black uppercase tracking-tighter text-muted-foreground">Trust Score:</span>
                          <span className="text-[12px] font-bold text-green-500">{trustScoreOr(data.reporter?.trust_score)}</span>
                        </div>
                        )}
                      </div>
                    </div>
                    {data.reported_by && (
                      <Button variant="outline" size="sm" className="h-7 text-[12px] font-bold rounded-lg px-3" onClick={() => window.open(`/profile/${data.reported_by}`, '_blank', 'noopener')}>
                        View Profile
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </ResizablePanel>

          {/* Resize Handle */}
          <ResizableHandle withHandle className="bg-border/20" />

          {/* Right Panel: Management Tabs */}
          <ResizablePanel defaultSize={40} minSize={25}>
            <div className="h-full bg-card/30 flex flex-col">
              <div className="p-4 border-b border-border/50 flex gap-2" role="tablist" aria-label="Case sections">
                {(['details', 'history', 'evidence', 'actions'] as const).map(tab => (
                  <button
                    key={tab}
                    role="tab"
                    aria-selected={activeTab === tab}
                    onClick={() => setActiveTab(tab)}
                    className={`flex-1 py-2 rounded-lg text-[12px] font-black uppercase tracking-widest transition-colors ${
                      activeTab === tab 
                        ? 'bg-primary text-white shadow-lg shadow-primary/20' 
                        : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                    }`}
                  >
                    {tab}
                  </button>
                ))}
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-6 no-scrollbar">
                {activeTab === 'details' && (
                  <div className="space-y-6">
                    <div className="space-y-4">
                      <h3 className="text-[12px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                        <User className="w-3 h-3" /> Reported Identity
                      </h3>
                      <div className="bg-card/50 border border-border/50 rounded-2xl p-4 flex items-center justify-between group hover:border-primary/30 transition-colors">
                        <div className="flex items-center gap-4">
                          <div className="relative">
                            <Avatar className="w-12 h-12 border-2 border-border/50">
                              <AvatarImage src={targetAuthor?.avatar_url} />
                              <AvatarFallback className="bg-primary/10 text-primary font-black">
                                {safeInitials(targetAuthor)}
                              </AvatarFallback>
                            </Avatar>
                            <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-background rounded-full border border-border flex items-center justify-center">
                              <ShieldCheck className="w-3 h-3 text-primary" />
                            </div>
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-black text-foreground">{targetAuthor?.username ? `@${targetAuthor.username}` : authorLookupDone ? 'Author not available' : 'Resolving...'}</p>
                              <Badge variant="outline" className="h-4 px-1 text-xs font-black uppercase bg-red-500/10 text-red-500 border-red-500/20">Author</Badge>
                            </div>
                            <p className="text-[12px] text-muted-foreground font-medium uppercase tracking-widest">{data.target_type === 'user' ? 'Account' : data.target_type + ' author'}</p>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <h3 className="text-[12px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                        <Shield className="w-3 h-3" /> Moderation Workflow
                      </h3>
                      <div className="space-y-3">
                        <div className="bg-muted/30 border border-border/30 rounded-2xl p-4 flex items-center justify-between">
                          <span className="text-[12px] font-black text-muted-foreground uppercase tracking-widest">Assigned To</span>
                          <span className="text-[12px] font-black text-foreground">
                            {data.assigned_moderator ? `@${data.assigned_moderator.username}` : '@Unassigned'}
                          </span>
                        </div>
                        <div className="bg-muted/30 border border-border/30 rounded-2xl p-4 flex items-center justify-between">
                          <span className="text-[12px] font-black text-muted-foreground uppercase tracking-widest">Priority</span>
                          <Badge className="bg-red-500/10 text-red-500 border-red-500/20 text-[12px] font-black uppercase">
                            {data.priority || 'medium'}
                          </Badge>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <h3 className="text-[12px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                        <FileText className="w-3 h-3" /> Internal Case Notes
                      </h3>
                      <div className="space-y-4">
                        <ReplyPicker onPick={(body) => setNote((cur) => (cur.trim() ? `${cur.trim()} ${body}` : body))} />
                        <textarea
                          value={note}
                          onChange={(e) => setNote(e.target.value)}
                          placeholder="Enter internal resolution notes or findings..."
                          className="w-full h-40 bg-card/50 border border-border/50 rounded-2xl p-4 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 transition-colors resize-none"
                        />
                        <Button 
                          onClick={handleAddNote}
                          className="w-full h-12 bg-primary/10 hover:bg-primary/20 text-primary font-black uppercase tracking-widest text-[12px] rounded-2xl border border-primary/20 gap-2"
                        >
                          <Send className="w-3.5 h-3.5" /> Append Note
                        </Button>
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === 'history' && (
                  <div className="space-y-6">
                    <h3 className="text-[12px] font-black uppercase tracking-widest text-muted-foreground">Timeline</h3>
                    <CaseTimeline caseId={caseId} refreshKey={timelineKey} />
                    <h3 className="text-[12px] font-black uppercase tracking-widest text-muted-foreground">Action Log & Notes</h3>
                    {notes.length === 0 ? (
                      <div className="p-8 text-center border-2 border-dashed border-border/50 rounded-2xl">
                        <p className="text-[12px] font-black uppercase tracking-widest text-muted-foreground opacity-50">No notes found.</p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {notes.map((n) => (
                          <div key={n.id} className="bg-card/50 border border-border/50 rounded-xl p-3 space-y-2">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <Avatar className="w-5 h-5">
                                  <AvatarImage src={n.author?.avatar_url} />
                                  <AvatarFallback className="text-[12px] font-bold">{n.author?.username?.slice(0,2)}</AvatarFallback>
                                </Avatar>
                                <span className="text-[12px] font-bold">{n.author?.username}</span>
                              </div>
                              <span className="text-[12px] text-muted-foreground uppercase">{new Date(n.created_at).toLocaleString()}</span>
                            </div>
                            <p className="text-[12px] leading-relaxed text-foreground/90">{n.content}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {activeTab === 'actions' && (
                  <div className="space-y-6">
                    <BundleButtons reportId={caseId} onDone={onClose} />
                    <div className="space-y-4">
                      <h3 className="text-[12px] font-black uppercase tracking-widest text-muted-foreground">Enforcement Controls</h3>
                      {!mayAct && <p className="text-xs rounded-xl border border-violet-500/30 bg-violet-500/5 px-3 py-2" role="status">Another moderator holds this case, so these buttons are off until they hand it over or it frees up.</p>}
                      <div className="grid grid-cols-1 gap-2">
                        <Button 
                          variant="outline" 
                          className="justify-start h-auto min-h-12 py-2 whitespace-normal leading-snug rounded-xl border-green-500/20 text-green-600 hover:bg-green-500/5 px-4" 
                          onClick={() => askReason('dismiss')}
                          disabled={acting || !mayAct || !hasPermission('report.resolve')}
                        >
                          <ThumbsUp className="w-4 h-4 mr-3" />
                          <div className="text-left">
                            <p className="text-xs font-black uppercase tracking-tight">Dismiss Case</p>
                            <p className="text-[12px] font-medium opacity-70">No violation found</p>
                          </div>
                        </Button>
                        <Button 
                          variant="outline" 
                          className="justify-start h-auto min-h-12 py-2 whitespace-normal leading-snug rounded-xl border-amber-500/20 text-amber-600 hover:bg-amber-500/5 px-4" 
                          onClick={() => askReason('warn')}
                          disabled={acting || !mayAct || !hasPermission('user.warn')}
                        >
                          <AlertTriangle className="w-4 h-4 mr-3" />
                          <div className="text-left">
                            <p className="text-xs font-black uppercase tracking-tight">Issue Warning</p>
                            <p className="text-[12px] font-medium opacity-70">Formal account notice and a strike{requiresApproval('user.warn') ? ' • Needs Approval' : ''}</p>
                          </div>
                        </Button>
                        <Button 
                          variant="outline" 
                          className="justify-start h-auto min-h-12 py-2 whitespace-normal leading-snug rounded-xl border-red-500/20 text-red-500 hover:bg-red-500/5 px-4" 
                          onClick={() => askReason('delete')}
                          disabled={acting || !mayAct || !hasPermission('content.delete')}
                        >
                          <Trash2 className="w-4 h-4 mr-3" />
                          <div className="text-left">
                            <p className="text-xs font-black uppercase tracking-tight">Remove Content</p>
                            <p className="text-[12px] font-medium opacity-70">Take the content down. Needs a second approver</p>
                          </div>
                        </Button>
                        <Button
                          variant="outline"
                          className="justify-start h-auto min-h-12 py-2 whitespace-normal leading-snug rounded-xl border-border/60 px-4"
                          onClick={() => setDuplicateOpen(true)}
                          disabled={acting || !mayAct || !hasPermission('report.resolve') || !isOpenStatus(data.status)}
                        >
                          <Copy className="w-4 h-4 mr-3" />
                          <div className="text-left">
                            <p className="text-xs font-black uppercase tracking-tight">Mark as Duplicate</p>
                            <p className="text-[12px] font-medium opacity-70">Close this and link it to another open case</p>
                          </div>
                        </Button>
                        <Button
                          variant="outline"
                          className="justify-start h-auto min-h-12 py-2 whitespace-normal leading-snug rounded-xl border-purple-500/20 text-purple-600 hover:bg-purple-500/5 px-4"
                          onClick={() => askReason('shadowban')}
                          disabled={acting || !mayAct || !hasPermission('user.warn')}
                        >
                          <EyeOff className="w-4 h-4 mr-3" />
                          <div className="text-left">
                            <p className="text-xs font-black uppercase tracking-tight">Shadowban Author</p>
                            <p className="text-[12px] font-medium opacity-70">Limits reach, author is not told • Needs a second approver</p>
                          </div>
                        </Button>
                        <Button
                          variant="outline"
                          className="justify-start h-auto min-h-12 py-2 whitespace-normal leading-snug rounded-xl border-red-700/20 text-red-700 hover:bg-red-700/5 px-4"
                          onClick={() => askReason('ban')}
                          disabled={acting || !mayAct || !hasPermission('user.ban')}
                        >
                          <Ban className="w-4 h-4 mr-3" />
                          <div className="text-left">
                            <p className="text-xs font-black uppercase tracking-tight">Account Suspension</p>
                            <p className="text-[12px] font-medium opacity-70">Locks the account. Needs a second approver</p>
                          </div>
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </ResizablePanel>

        </ResizablePanelGroup>
      </div>
      <ReasonDialog
        open={!!pendingAction}
        title={pendingAction ? ACTION_COPY[pendingAction].title : ''}
        description={pendingAction ? ACTION_COPY[pendingAction].description : undefined}
        confirmLabel={pendingAction ? ACTION_COPY[pendingAction].confirm : 'Confirm'}
        destructive={pendingAction ? ACTION_COPY[pendingAction].destructive : false}
        onCancel={() => setPendingAction(null)}
        onConfirm={async (reason) => { const a = pendingAction; setPendingAction(null); if (a) await handleAction(a, reason); }}
      />
      <ReasonDialog
        open={escalateOpen}
        title="Escalate this case"
        description="It becomes urgent and the person you choose is told. Say what you found and what you need from them."
        confirmLabel="Escalate"
        destructive
        hideSavedReasons
        durations={[{ label: 'To an admin', days: 0 }, { label: 'To a super admin', days: 1 }]}
        choiceLabel="Who should look at this"
        onCancel={() => setEscalateOpen(false)}
        onConfirm={async (reason, pick) => { setEscalateOpen(false); await handleEscalate(reason, pick === 1 ? 'super_admin' : 'admin'); }}
      />
      <MarkDuplicateDialog open={duplicateOpen} caseId={caseId} onClose={() => setDuplicateOpen(false)} onDone={() => { setDuplicateOpen(false); onClose(); }} />
      <ReasonDialog
        open={authorityOpen}
        title="Record that this was passed to the authorities"
        description="Enter the reference you were given (a report number or the name of the body and the date). It is kept with the case and in the audit log."
        confirmLabel="Record"
        onCancel={() => setAuthorityOpen(false)}
        onConfirm={async (ref) => { setAuthorityOpen(false); await recordAuthority(ref); }}
      />
    </div>
  );
};

const PRIORITY_STYLES = {
  low:    'bg-muted text-muted-foreground border-border/50',
  medium: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
  high:   'bg-amber-500/10 text-amber-500 border-amber-500/20',
  urgent: 'bg-red-500/10 text-red-500 border-red-500/20 animate-pulse',
};

export default CaseDetailView;
