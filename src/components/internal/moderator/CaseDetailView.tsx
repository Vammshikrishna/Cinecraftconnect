import React, { useState, useEffect } from 'react';
import { 
  Shield, User, AlertTriangle, 
  Trash2, Ban, 
  FileText, ExternalLink, Send,
  MoreVertical, ArrowLeft, ThumbsUp,
  ShieldAlert, ShieldCheck
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useGovernance } from '@/hooks/useGovernance';
import { GovernanceService } from '@/services/governance/GovernanceService';
import { useAuth } from '@/contexts/AuthContext';
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";

interface CaseDetailViewProps {
  caseId: string;
  onClose: () => void;
}

const CaseDetailView: React.FC<CaseDetailViewProps> = ({ caseId, onClose }) => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [note, setNote] = useState('');
  const [notes, setNotes] = useState<any[]>([]);
  const [targetAuthor, setTargetAuthor] = useState<any>(null);
  const [targetContent, setTargetContent] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'details' | 'history' | 'evidence' | 'actions'>('details');
  const { toast } = useToast();
  const { user } = useAuth();
  const { hasPermission, requiresApproval } = useGovernance();

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
    const moderatorIds = Array.from(new Set(notesData.map((n: any) => n.moderator_id))) as string[];
    
    const { data: profilesData } = await supabase
      .from('profiles')
      .select('id, username, avatar_url')
      .in('id', moderatorIds);

    // 3. Merge profile data into notes
    const profilesMap = new Map(profilesData?.map(p => [p.id, p]));
    const notesWithAuthors = notesData.map((n: any) => ({
      ...n,
      author: profilesMap.get(n.moderator_id)
    }));

    setNotes(notesWithAuthors);
  };

  const fetchTargetContent = async (reportData: any) => {
    let table = '';

    switch (reportData.target_type) {
      case 'post': table = 'posts'; break;
      case 'comment': table = 'comments'; break;
      case 'job': table = 'jobs'; break;
      case 'listing': table = 'marketplace_listings'; break;
      default: return;
    }

    const { data: content } = await (supabase as any)
      .from(table)
      .select('*')
      .eq('id', reportData.target_id)
      .single();

    if (content) {
      setTargetContent(content);
    }
  };

  const resolveTargetAuthor = async (reportData: any) => {
    if (reportData.target_type === 'user') {
      const { data: profile } = await supabase.from('profiles').select('id, username, avatar_url').eq('id', reportData.target_id).single();
      setTargetAuthor(profile);
      return;
    }

    let table = '';
    let authorIdField = 'author_id';

    switch (reportData.target_type) {
      case 'post': table = 'posts'; break;
      case 'comment': table = 'comments'; authorIdField = 'user_id'; break;
      case 'job': table = 'jobs'; authorIdField = 'posted_by'; break;
      case 'listing': table = 'marketplace_listings'; authorIdField = 'user_id'; break;
      default: return;
    }

    const { data: content } = await (supabase as any).from(table).select(authorIdField).eq('id', reportData.target_id).single();
    if (content && content[authorIdField]) {
      const { data: profile } = await supabase.from('profiles').select('id, username, avatar_url').eq('id', content[authorIdField]).single();
      setTargetAuthor(profile);
    }
  };

  const handleClaimCase = async () => {
    if (!user) return;
    
    if (!hasPermission('report.claim')) {
      toast({ title: 'Access Denied', description: 'Insufficient permissions to claim cases.', variant: 'destructive' });
      return;
    }

    try {
      const result = await GovernanceService.executeAction({
        action: 'report.claim',
        targetId: caseId,
        targetType: 'content_reports',
        reason: 'Staff claiming case for review',
        payload: { status: 'in_review', assigned_to: user.id },
        actorId: user.id,
        requiresApproval: requiresApproval('report.claim')
      }) as { success: boolean; pending?: boolean };

      if (result.pending) {
        toast({ title: 'Request Staged', description: 'Action sent for administrative approval.' });
      } else {
        toast({ title: 'Case Claimed', description: 'You are now assigned to this case.' });
        fetchCaseDetails();
      }
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const handleAction = async (action: 'dismiss' | 'warn' | 'mute' | 'delete' | 'ban') => {
    if (!user) return;

    const actionMap: Record<string, any> = {
      dismiss: 'report.resolve',
      warn: 'user.warn',
      delete: 'content.delete',
      ban: 'user.ban'
    };

    const govAction = actionMap[action];
    if (!govAction || !hasPermission(govAction)) {
      toast({ title: 'Access Denied', description: `Insufficient permissions for ${action}.`, variant: 'destructive' });
      return;
    }

    try {
      const result = await GovernanceService.executeAction({
        action: govAction,
        targetId: caseId,
        targetType: 'content_reports',
        reason: note || `Standard moderation action: ${action}`,
        payload: { action, p_notify_user: true },
        actorId: user.id,
        requiresApproval: requiresApproval(govAction)
      }) as { success: boolean; pending?: boolean };

      if (result.pending) {
        toast({ title: 'Staged for Approval', description: `The ${action} action requires dual-control validation.` });
      } else {
        toast({ title: 'Success', description: `Action ${action} applied successfully.` });
        onClose();
      }
    } catch (error: any) {
      toast({ title: 'Action Failed', description: error.message, variant: 'destructive' });
    }
  };

  const handleAddNote = async () => {
    if (!note.trim()) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await (supabase as any)
      .from('moderation_notes')
      .insert({
        report_id: caseId,
        moderator_id: user.id,
        content: note
      });
    
    if (!error) {
      setNote('');
      fetchNotes();
      toast({ title: 'Note Added' });
    }
  };

  const handleEscalate = async () => {
    const { error } = await (supabase as any)
      .from('content_reports')
      .update({ priority: 'urgent' })
      .eq('id', caseId);
    
    if (error) {
      toast({ title: 'Escalation Failed', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Case Escalated', description: 'Priority increased to urgent.' });
      fetchCaseDetails();
    }
  };

  const handleViewInContext = () => {
    const typeMap: Record<string, string> = {
      'user': `/profile/${data.target_id}`,
      'post': `/post/${data.target_id}`,
      'comment': `/post/${data.target_id}`, 
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
      <div className="px-6 py-4 border-b border-border/50 flex items-center justify-between bg-card/50 backdrop-blur-md">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" className="w-8 h-8 rounded-lg" onClick={onClose}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div className="h-6 w-px bg-border/50" />
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-black uppercase tracking-tight">Case ID: {caseId.slice(0, 12)}</h2>
              <Badge className={PRIORITY_STYLES[data.priority as keyof typeof PRIORITY_STYLES] + " text-[9px] font-black uppercase"}>
                {data.status}
              </Badge>
            </div>
            <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-widest">
              Reported {new Date(data.created_at).toLocaleString()}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {!data.assigned_to && (
            <Button onClick={handleClaimCase} variant="default" size="sm" className="h-8 text-[10px] font-bold gap-2 rounded-lg bg-primary hover:bg-primary/90 text-white">
              <Shield className="w-3.5 h-3.5" /> Claim Case
            </Button>
          )}
          <Button 
            onClick={handleEscalate}
            variant="outline" size="sm" className="h-8 text-[10px] font-bold gap-2 rounded-lg"
          >
            <ShieldAlert className="w-3.5 h-3.5" /> Escalate to Admin
          </Button>
          <Separator orientation="vertical" className="h-6" />
          <Button variant="ghost" size="icon" className="w-8 h-8 rounded-lg">
            <MoreVertical className="w-4 h-4" />
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
                {/* Violation Summary */}
                <div className="space-y-4">
                  <h3 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Violation Overview</h3>
                  <div className="glass-card p-6 border-amber-500/20 bg-amber-500/5">
                    <div className="flex items-start gap-4">
                      <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center shrink-0">
                        <AlertTriangle className="w-5 h-5 text-amber-500" />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-foreground uppercase tracking-tight mb-1">{data.reason.replace(/_/g, ' ')}</h4>
                        <p className="text-xs text-muted-foreground leading-relaxed italic">
                          "{data.details || 'No additional details provided by reporter.'}"
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Content Preview */}
                {data.target_type !== 'user' && (
                  <div className="space-y-4">
                    <h3 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center justify-between">
                      <span>Reported Content Preview</span>
                      {targetContent && (
                        <span className="text-primary font-black">LIVE DATA</span>
                      )}
                    </h3>
                    
                    <div className="glass-card border-border/50 overflow-hidden bg-card/30">
                      <div className="p-4 border-b border-border/10 flex items-center justify-between bg-muted/20">
                        <div className="flex items-center gap-3">
                          <Avatar className="w-8 h-8 border border-border/50">
                            <AvatarImage src={targetAuthor?.avatar_url} />
                            <AvatarFallback className="text-[10px] font-bold bg-primary/10 text-primary">
                              {targetAuthor?.username?.slice(0, 2).toUpperCase() || '??'}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="text-[11px] font-black tracking-tight">@{targetAuthor?.username || 'Resolving Author...'}</p>
                            <p className="text-[9px] text-muted-foreground uppercase font-medium">{data.target_type} • ID: {data.target_id.slice(0, 8)}</p>
                          </div>
                        </div>
                        <Button 
                          onClick={handleViewInContext}
                          variant="ghost" size="sm" className="h-7 text-[10px] font-bold gap-1.5 rounded-lg px-2 text-primary hover:bg-primary/10"
                        >
                          <ExternalLink className="w-3 h-3" /> View In Context
                        </Button>
                      </div>

                      <div className="space-y-0">
                        {targetContent ? (
                          <>
                            {(targetContent.content || targetContent.description) && (
                              <div className="px-5 pt-4 pb-3">
                                {targetContent.title && <h5 className="font-bold text-sm text-foreground mb-2">{targetContent.title}</h5>}
                                <p className="text-sm text-foreground/90 leading-relaxed whitespace-pre-wrap">
                                  {targetContent.content || targetContent.description}
                                </p>
                              </div>
                            )}

                            {targetContent.media_items && targetContent.media_items.length > 0 && (
                              <div className="w-full bg-black">
                                {targetContent.media_items.map((item: any, idx: number) => (
                                  item.type === 'video' ? (
                                    <video key={idx} src={item.url} controls className="w-full max-h-[500px] object-contain" />
                                  ) : (
                                    <img key={idx} src={item.url} alt="Media" className="w-full max-h-[500px] object-contain" />
                                  )
                                ))}
                              </div>
                            )}

                            {!targetContent.media_items?.length && targetContent.media_urls?.length > 0 && (
                              <div className="w-full bg-black">
                                {targetContent.media_urls.map((url: string, idx: number) => (
                                  <img key={idx} src={url} alt="Media" className="w-full max-h-[500px] object-contain" />
                                ))}
                              </div>
                            )}

                            {!targetContent.media_items?.length && !targetContent.media_urls?.length && targetContent.images?.length > 0 && (
                              <div className={`grid gap-0.5 ${targetContent.images.length > 1 ? 'grid-cols-2' : 'grid-cols-1'}`}>
                                {targetContent.images.map((url: string, idx: number) => (
                                  <img key={idx} src={url} alt="Media" className="w-full aspect-square object-cover" />
                                ))}
                              </div>
                            )}

                            {targetContent.price && (
                              <div className="px-5 py-3 border-t border-border/10 flex items-center justify-between">
                                <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Marketplace Price</span>
                                <span className="text-sm font-black text-primary">{targetContent.price}</span>
                              </div>
                            )}

                            {!targetContent.content && !targetContent.description && !targetContent.media_items?.length && !targetContent.media_urls?.length && !targetContent.images?.length && (
                              <div className="py-12 text-center">
                                <p className="text-xs text-muted-foreground italic">No text or media content available.</p>
                              </div>
                            )}
                          </>
                        ) : (
                          <div className="py-12 flex flex-col items-center justify-center gap-3">
                            <div className="w-6 h-6 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
                            <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Streaming Case Data...</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Reporter Profile */}
                <div className="space-y-4">
                  <h3 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Reporter Profile</h3>
                  <div className="glass-card p-4 border-border/50 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <User className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-foreground">@{data.reporter?.username}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[9px] font-black uppercase tracking-tighter text-muted-foreground">Trust Score:</span>
                          <span className="text-[10px] font-bold text-green-500">{data.reporter?.trust_score || 100}</span>
                        </div>
                      </div>
                    </div>
                    <Button variant="outline" size="sm" className="h-7 text-[10px] font-bold rounded-lg px-3">
                      View Profile History
                    </Button>
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
              <div className="p-4 border-b border-border/50 flex gap-2">
                {(['details', 'history', 'evidence', 'actions'] as const).map(tab => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`flex-1 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${
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
                      <h3 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                        <User className="w-3 h-3" /> Reported Identity
                      </h3>
                      <div className="bg-card/50 border border-border/50 rounded-2xl p-4 flex items-center justify-between group hover:border-primary/30 transition-colors">
                        <div className="flex items-center gap-4">
                          <div className="relative">
                            <Avatar className="w-12 h-12 border-2 border-border/50">
                              <AvatarImage src={targetAuthor?.avatar_url} />
                              <AvatarFallback className="bg-primary/10 text-primary font-black">
                                {targetAuthor?.username?.slice(0, 2).toUpperCase() || '??'}
                              </AvatarFallback>
                            </Avatar>
                            <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-background rounded-full border border-border flex items-center justify-center">
                              <ShieldCheck className="w-3 h-3 text-primary" />
                            </div>
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-black text-foreground">@{targetAuthor?.username || 'Resolving...'}</p>
                              <Badge variant="outline" className="h-4 px-1 text-[8px] font-black uppercase bg-red-500/10 text-red-500 border-red-500/20">Author</Badge>
                            </div>
                            <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-widest">Post Identity</p>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <h3 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                        <Shield className="w-3 h-3" /> Moderation Workflow
                      </h3>
                      <div className="space-y-3">
                        <div className="bg-muted/30 border border-border/30 rounded-2xl p-4 flex items-center justify-between">
                          <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Assigned To</span>
                          <span className="text-[11px] font-black text-foreground">
                            {data.assigned_moderator ? `@${data.assigned_moderator.username}` : '@Unassigned'}
                          </span>
                        </div>
                        <div className="bg-muted/30 border border-border/30 rounded-2xl p-4 flex items-center justify-between">
                          <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Priority</span>
                          <Badge className="bg-red-500/10 text-red-500 border-red-500/20 text-[9px] font-black uppercase">
                            {data.priority || 'medium'}
                          </Badge>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <h3 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                        <FileText className="w-3 h-3" /> Internal Case Notes
                      </h3>
                      <div className="space-y-4">
                        <textarea
                          value={note}
                          onChange={(e) => setNote(e.target.value)}
                          placeholder="Enter internal resolution notes or findings..."
                          className="w-full h-40 bg-card/50 border border-border/50 rounded-2xl p-4 text-xs text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/50 transition-colors resize-none"
                        />
                        <Button 
                          onClick={handleAddNote}
                          className="w-full h-12 bg-primary/10 hover:bg-primary/20 text-primary font-black uppercase tracking-widest text-[10px] rounded-2xl border border-primary/20 gap-2"
                        >
                          <Send className="w-3.5 h-3.5" /> Append Note
                        </Button>
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === 'history' && (
                  <div className="space-y-6">
                    <h3 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Action Log & Notes</h3>
                    {notes.length === 0 ? (
                      <div className="p-8 text-center border-2 border-dashed border-border/50 rounded-2xl">
                        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground opacity-50">No notes found.</p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {notes.map((n) => (
                          <div key={n.id} className="bg-card/50 border border-border/50 rounded-xl p-3 space-y-2">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <Avatar className="w-5 h-5">
                                  <AvatarImage src={n.author?.avatar_url} />
                                  <AvatarFallback className="text-[8px] font-bold">{n.author?.username?.slice(0,2)}</AvatarFallback>
                                </Avatar>
                                <span className="text-[10px] font-bold">{n.author?.username}</span>
                              </div>
                              <span className="text-[9px] text-muted-foreground uppercase">{new Date(n.created_at).toLocaleString()}</span>
                            </div>
                            <p className="text-[11px] leading-relaxed text-foreground/90">{n.content}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {activeTab === 'actions' && (
                  <div className="space-y-6">
                    <div className="space-y-4">
                      <h3 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Enforcement Controls</h3>
                      <div className="grid grid-cols-1 gap-2">
                        <Button 
                          variant="outline" 
                          className="justify-start h-12 rounded-xl border-green-500/20 text-green-600 hover:bg-green-500/5 px-4" 
                          onClick={() => handleAction('dismiss')}
                          disabled={!hasPermission('report.resolve')}
                        >
                          <ThumbsUp className="w-4 h-4 mr-3" />
                          <div className="text-left">
                            <p className="text-xs font-black uppercase tracking-tight">Dismiss Case</p>
                            <p className="text-[9px] font-medium opacity-70">No violation found</p>
                          </div>
                        </Button>
                        <Button 
                          variant="outline" 
                          className="justify-start h-12 rounded-xl border-amber-500/20 text-amber-600 hover:bg-amber-500/5 px-4" 
                          onClick={() => handleAction('warn')}
                          disabled={!hasPermission('user.warn')}
                        >
                          <AlertTriangle className="w-4 h-4 mr-3" />
                          <div className="text-left">
                            <p className="text-xs font-black uppercase tracking-tight">Issue Warning</p>
                            <p className="text-[9px] font-medium opacity-70">Formal account notice {requiresApproval('user.warn') && "• Needs Approval"}</p>
                          </div>
                        </Button>
                        <Button 
                          variant="outline" 
                          className="justify-start h-12 rounded-xl border-red-500/20 text-red-500 hover:bg-red-500/5 px-4" 
                          onClick={() => handleAction('delete')}
                          disabled={!hasPermission('content.delete')}
                        >
                          <Trash2 className="w-4 h-4 mr-3" />
                          <div className="text-left">
                            <p className="text-xs font-black uppercase tracking-tight">Remove Content</p>
                            <p className="text-[9px] font-medium opacity-70">Hard delete from platform</p>
                          </div>
                        </Button>
                        <Button 
                          variant="outline" 
                          className="justify-start h-12 rounded-xl border-red-700/20 text-red-700 hover:bg-red-700/5 px-4" 
                          onClick={() => handleAction('ban')}
                          disabled={!hasPermission('user.ban')}
                        >
                          <Ban className="w-4 h-4 mr-3" />
                          <div className="text-left">
                            <p className="text-xs font-black uppercase tracking-tight">Account Suspension</p>
                            <p className="text-[9px] font-medium opacity-70">Immediate lockout {requiresApproval('user.ban') && "• Needs Approval"}</p>
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
