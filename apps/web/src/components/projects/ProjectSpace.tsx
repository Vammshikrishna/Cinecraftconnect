import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAppNavigation } from '@/contexts/NavigationContext';
import {
  MessageCircle,
  CheckSquare,
  FileText,
  Users,
  Camera,
  ClipboardList,
  Briefcase,
  DollarSign,
  ChevronRight,
  ArrowLeft,
  UserPlus,
  Settings,
  Phone,
  Video,
  ShieldBan,
  Mic,
} from 'lucide-react';

import { ProjectChatInterface } from '@/components/discussions/ProjectChatInterface';
import Tasks from '@/components/projects/Tasks';
import Files from '@/components/projects/Files';
import CallSheet from '@/components/projects/CallSheet';
import ShotList from '@/components/projects/ShotList';
import LegalDocs from '@/components/projects/LegalDocs';
import BudgetSched from '@/components/projects/BudgetSched';
import Team from '@/components/projects/Team';
import ProjectApplicants from '@/components/projects/ProjectApplicants';
import ProjectSettings from '@/components/projects/ProjectSettings';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { SpaceEscalationPanel } from '@/components/governance/SpaceEscalationPanel';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { isSpaceCreator } from '@/lib/spaceRoles';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { LoadingSpinner } from '@/components/ui/loading-spinner';

import { useToast } from '@/hooks/use-toast';
import { useAppRole } from '@/hooks/useAppRole';
import { useGlobalCall } from '@/contexts/CallContext';
import { StaffObserverBanner } from '@/components/governance/StaffObserverBanner';
import { ProjectCallControls } from '@/components/projects/ProjectCallControls';
import { useActiveRoomCall } from '@/hooks/useActiveRoomCall';
import { friendlyError } from '@cinecraft/core';

interface ProjectSpaceProps {
  projectId: string;
  projectTitle: string;
  projectDescription: string;
  projectImageUrl?: string;
  projectCreatorId?: string;
  initialSpaceId?: string | null;
}

const SECTIONS = ['chat', 'tasks', 'files', 'team', 'call-sheet', 'shot-list', 'legal-docs', 'budget-sched', 'applicants', 'settings', 'call'] as const;
type ActiveSection = typeof SECTIONS[number];

/** Round project picture, like a chat avatar; falls back to the first letter of the title. */
const ProjectAvatar = ({ url, title, className }: { url?: string; title: string; className?: string }) => {
  const [failed, setFailed] = useState(false);
  return (
    <div className={cn('shrink-0 rounded-full overflow-hidden bg-gradient-to-br from-primary to-purple-500 flex items-center justify-center text-white font-bold border border-border/40', className)}>
      {url && !failed ? (
        <img src={url} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" onError={() => setFailed(true)} />
      ) : (
        <span className="uppercase">{(title || '?').trim().charAt(0)}</span>
      )}
    </div>
  );
};

export const ProjectSpace = ({
  projectId,
  projectTitle,
  projectDescription,
  projectImageUrl,
  projectCreatorId,
  initialSpaceId,
}: ProjectSpaceProps) => {
  const { push, goBack } = useAppNavigation();
  const { user } = useAuth();
  const { isInternal, loading: roleLoading } = useAppRole();
  const { toast } = useToast();
  const [userRole, setUserRole] = useState<'creator' | 'admin' | 'member' | 'guest'>('guest');
  const [spaceCreatorId, setSpaceCreatorId] = useState<string | null>(null);
  const [resolvedSpaceId, setResolvedSpaceId] = useState<string | null>(initialSpaceId || null);
  const [requestStatus, setRequestStatus] = useState<'none' | 'pending' | 'rejected' | 'approved'>('none');
  const [checkingAccess, setCheckingAccess] = useState(true);
  const [hasGrantedAccess, setHasGrantedAccess] = useState<boolean>(false);
  const [activeSection, setActiveSection] = useState<ActiveSection>('chat');
  const [sidebarWidth, setSidebarWidth] = useState(280);
  const [isResizing, setIsResizing] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Global Call state
  const { callState, startCall: startGlobalCall, joinCall: joinGlobalCall, toggleMinimize, togglePipHidden, findActiveCall } = useGlobalCall();
  const isInCall = callState.isActive && (callState.roomId === resolvedSpaceId || callState.roomId === projectId);
  // A call or audio space somebody has already started here: offer "Join" instead of the start options.
  const activeRoomCall = useActiveRoomCall('project', resolvedSpaceId);
  const isCallMinimized = callState.isMinimized;

  const [isBookmarked, setIsBookmarked] = useState(false);

  useEffect(() => {
    if (!user?.id || !resolvedSpaceId) return;
    const checkBookmark = async () => {
      const { data } = await supabase
        .from('project_space_bookmarks')
        .select('id')
        .eq('project_space_id', resolvedSpaceId)
        .eq('user_id', user.id)
        .maybeSingle();
      setIsBookmarked(!!data);
    };
    checkBookmark();
  }, [user?.id, resolvedSpaceId]);

  useEffect(() => {
    const handleBookmarkChange = (e: Event) => {
      const customEvent = e as CustomEvent<{ projectId: string; isBookmarked: boolean }>;
      if (customEvent.detail?.projectId === projectId || (resolvedSpaceId && customEvent.detail?.projectId === resolvedSpaceId)) {
        setIsBookmarked(customEvent.detail.isBookmarked);
      }
    };
    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'cc_project_bookmark_sync' && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          if (parsed?.projectId === projectId || (resolvedSpaceId && parsed?.projectId === resolvedSpaceId)) {
            setIsBookmarked(parsed.isBookmarked);
          }
        } catch { }
      }
    };
    window.addEventListener('projectBookmarkChanged', handleBookmarkChange);
    window.addEventListener('storage', handleStorage);
    return () => {
      window.removeEventListener('projectBookmarkChanged', handleBookmarkChange);
      window.removeEventListener('storage', handleStorage);
    };
  }, [projectId, resolvedSpaceId]);

  const handleToggleBookmark = async () => {
    if (!user) {
      toast({ title: "Sign in required", variant: "destructive" });
      return;
    }
    if (!resolvedSpaceId) return;

    const nextState = !isBookmarked;
    setIsBookmarked(nextState);

    window.dispatchEvent(new CustomEvent('projectBookmarkChanged', {
      detail: { projectId, isBookmarked: nextState }
    }));
    try {
      localStorage.setItem('cc_project_bookmark_sync', JSON.stringify({
        projectId,
        isBookmarked: nextState,
        ts: Date.now()
      }));
    } catch { }

    try {
      if (!nextState) {
        await supabase
          .from('project_space_bookmarks')
          .delete()
          .eq('project_space_id', resolvedSpaceId)
          .eq('user_id', user.id);
        toast({ title: "Bookmark removed" });
      } else {
        await supabase
          .from('project_space_bookmarks')
          .upsert(
            { project_space_id: resolvedSpaceId, user_id: user.id },
            { onConflict: 'user_id,project_space_id' }
          );
        toast({ title: "Project space bookmarked!" });
      }
    } catch (e: any) {
      setIsBookmarked(!nextState);
      window.dispatchEvent(new CustomEvent('projectBookmarkChanged', {
        detail: { projectId, isBookmarked: !nextState }
      }));
      toast({ title: "Failed to update bookmark", variant: "destructive" });
    }
  };

  const [searchParams] = useSearchParams();
  const autoJoinParam = searchParams.get('autoJoin');
  const autoJoinHandled = useRef(false);


  useEffect(() => {
    const callRoomId = resolvedSpaceId || projectId;
    if (autoJoinParam === 'true' && callRoomId && !isInCall && !callState.isActive && !autoJoinHandled.current) {
      autoJoinHandled.current = true;
      console.log('📞 [AUTO-JOIN] Launching Project Space call for:', projectTitle || projectId);
      joinGlobalCall('project', callRoomId, projectTitle || 'Project Space Call', 'member');
    }
  }, [autoJoinParam, resolvedSpaceId, projectId, isInCall, callState.isActive, projectTitle, joinGlobalCall]);

  // Resolve space ID — only if not already provided by parent
  useEffect(() => {
    if (resolvedSpaceId) return; // Already have it from initialSpaceId
    let mounted = true;
    const resolveSpace = async () => {
      if (!projectId) return;
      try {
        const { data } = await supabase
          .from('project_spaces')
          .select('id')
          .eq('project_id', projectId)
          .maybeSingle();

        if (mounted && data) {
          setResolvedSpaceId(data.id);
        } else if (mounted) {
          // Auto-create the space if it doesn't exist
          const { data: newSpace } = await supabase
            .from('project_spaces')
            .insert({ project_id: projectId, name: 'General' })
            .select()
            .single();
          if (mounted && newSpace) {
            setResolvedSpaceId(newSpace.id);
          }
        }
      } catch (e) {
        // Silent catch for resolution
      }
    };
    resolveSpace();
    return () => { mounted = false; };
  }, [projectId, resolvedSpaceId]);

  // Scroll active tab into view
  useEffect(() => {
    const element = document.getElementById(`tab-${activeSection}`);
    if (element && scrollContainerRef.current) {
      const container = scrollContainerRef.current;
      const elementRect = element.getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();

      // Calculate center position
      const scrollLeft = element.offsetLeft - (containerRect.width / 2) + (elementRect.width / 2);
      container.scrollTo({ left: scrollLeft, behavior: 'smooth' });
    }
  }, [activeSection]);

  const handleSelectSection = useCallback((section: ActiveSection) => {
    if (section === 'call') {
      if (isCallMinimized) toggleMinimize(false);
      if (callState.isPipHidden) togglePipHidden(false);
    } else if (isInCall) {
      if (!isCallMinimized) toggleMinimize(true);
    }
    setActiveSection(section);
  }, [isCallMinimized, toggleMinimize, callState.isPipHidden, togglePipHidden, isInCall]);

  // Synchronize activeSection with call minimization state
  useEffect(() => {
    if (isInCall) {
      if ((activeSection as string) === 'call') {
        if (isCallMinimized) {
          setActiveSection('chat');
        } else if (callState.isPipHidden) {
          togglePipHidden(false);
        }
      } else {
        if (!isCallMinimized) {
          handleSelectSection('call');
        }
      }
    }
  }, [activeSection, isInCall, isCallMinimized, togglePipHidden, setActiveSection, handleSelectSection]);

  // Auto-switch away from 'call' section when call ends
  useEffect(() => {
    if (!isInCall && (activeSection as string) === 'call') {
      setActiveSection('chat');
    }
  }, [isInCall, activeSection, setActiveSection]);

  // Auto-switch to 'call' section when call starts for this space
  const prevIsInCall = useRef(false);
  useEffect(() => {
    if (isInCall && !prevIsInCall.current) {
      setActiveSection('call');
    }
    prevIsInCall.current = isInCall;
  }, [isInCall, setActiveSection]);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  };

  const handleMouseUp = useCallback(() => {
    setIsResizing(false);
  }, []);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (isResizing) {
      const newWidth = e.clientX;
      if (newWidth > 240 && newWidth < 500) {
        setSidebarWidth(newWidth);
      }
    }
  }, [isResizing]);

  useEffect(() => {
    if (isResizing) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    }
  }, [isResizing, handleMouseMove, handleMouseUp]);

  // Management powers belong to the space creator / project creator only (same rule as cj_can_manage_space).
  useEffect(() => {
    if (!resolvedSpaceId) return;
    let active = true;
    (async () => {
      const { data } = await (supabase as any).from('project_spaces').select('creator_id').eq('id', resolvedSpaceId).maybeSingle();
      if (active) setSpaceCreatorId(data?.creator_id ?? null);
    })();
    return () => { active = false; };
  }, [resolvedSpaceId]);
  const canManage = isSpaceCreator(user?.id, { creator_id: spaceCreatorId }, { creator_id: projectCreatorId });

  // Instant creator detection — runs synchronously on every render cycle where user becomes available
  // This is the FAST PATH: if we know the creator, skip ALL async checks and loading screens
  useEffect(() => {
    if (projectCreatorId && user?.id && projectCreatorId === user.id) {
      setUserRole('creator');
      setCheckingAccess(false);
    }
  }, [projectCreatorId, user?.id]);

  useEffect(() => {
    // Creator already identified — no async check needed
    if (projectCreatorId && user?.id && projectCreatorId === user.id) return;

    let active = true;
    const checkAccess = async () => {
      setCheckingAccess(true);
      if (!user?.id || !resolvedSpaceId) {
        if (active) setCheckingAccess(false);
        return;
      }

      try {
        // Run remaining checks in parallel
        const [membershipRes, requestRes, applicationRes, grantRes] = await Promise.all([
          // 1. Check Membership
          supabase
            .from('project_space_members')
            .select('role')
            .eq('project_space_id', resolvedSpaceId)
            .eq('user_id', user.id)
            .maybeSingle(),

          // 2. Check for pending join request
          supabase
            .from('project_space_join_requests' as any)
            .select('status, id')
            .eq('project_space_id', resolvedSpaceId)
            .eq('user_id', user.id)
            .maybeSingle(),

          // 3. Check for approved application (applicants who were accepted)
          supabase
            .from('project_applications' as any)
            .select('status')
            .eq('project_id', resolvedSpaceId)
            .eq('user_id', user.id)
            .eq('status', 'approved')
            .maybeSingle(),

          // 4. Check for active grant if staff is guest
          isInternal ? (supabase as any)
            .from('space_access_grants')
            .select('id')
            .eq('user_id', user.id)
            .eq('target_type', 'project_space')
            .eq('target_id', resolvedSpaceId)
            .gt('expires_at', new Date().toISOString())
            .maybeSingle() : Promise.resolve({ data: null })
        ]);

        if (!active) return;

        // Internal staff ALWAYS require an active grant for private project spaces.
        // Membership is intentionally ignored — governance accounts must go through
        // break glass every time, even if they were added as a regular member.
        if (isInternal) {
          const hasGrant = !!grantRes.data;
          setHasGrantedAccess(hasGrant);
          if (!hasGrant) {
            setUserRole('guest'); // Force Intercept screen — grant required
            return;
          }
          // Has a valid grant — fall through to set membership role below
        }

        if (membershipRes.data) {
          setUserRole(membershipRes.data.role === 'admin' ? 'admin' : 'member');
          return;
        }

        // If user has an approved application, treat them as a member
        if (applicationRes.data) {
          setUserRole('member');
          return;
        }

        if (requestRes.data) {
          const status = (requestRes.data as any).status;
          // An "approved" request without a membership row is stale (the person was removed afterwards), so it
          // must not show "approved, refresh the page": they have to ask to join again.
          if (status === 'pending' || status === 'rejected') {
            setRequestStatus(status);
          }
        }

        setUserRole('guest');

      } catch (err) {
        // Silent catch for access check
      } finally {
        if (active) setCheckingAccess(false);
      }
    };

    checkAccess();

    return () => { active = false; };
  }, [projectId, resolvedSpaceId, user?.id, isInternal, projectCreatorId]);

  useEffect(() => {
    if (!checkingAccess && !roleLoading && userRole === 'guest' && requestStatus !== 'approved' && !isInternal) {
      push(`/projects/${projectId}`, { noScroll: true });
    }
  }, [checkingAccess, roleLoading, userRole, requestStatus, projectId, push, isInternal]);

  const [requestNote, setRequestNote] = useState('');

  const handleJoinRequest = async () => {

    if (!user) {
      toast({ title: "Error", description: "You must be logged in.", variant: "destructive" });
      return;
    }
    if (!resolvedSpaceId) {
      toast({ title: "Error", description: "Could not identify project space. Please refresh.", variant: "destructive" });
      return;
    }

    try {
      const { error } = await supabase
        .from('project_space_join_requests' as any)
        .insert({
          project_space_id: resolvedSpaceId,
          user_id: user.id,
          message: requestNote || null
        });

      if (error) {
        if (error.code === '23505') {
          // Duplicate request, treat as success/pending
          setRequestStatus('pending');
          toast({ title: "Request Pending", description: "You have already requested to join." });
          return;
        }
        throw error;
      }
      setRequestStatus('pending');
      toast({ title: "Request Sent", description: "Your request has been sent to the project owner." });
    } catch (e: any) {
      toast({ title: "Error", description: "Failed to send request: " + (e.message || "Unknown error"), variant: "destructive" });
    }
  };

  // the visit ran out or was ended from the banner
  const handleObserverEnded = () => {
    setHasGrantedAccess(false);
    setUserRole('guest');
    push('/projects', { noScroll: true });
  };

  // Starting a call ends any call already running in this space, so join it when one (or an audio space) is live.
  const handleStartAudioSpace = async (speakingMode: 'open' | 'request') => {
    if (!resolvedSpaceId) return;
    const active = await findActiveCall('project', resolvedSpaceId);
    const success = active
      ? await joinGlobalCall('project', resolvedSpaceId, projectTitle || 'Project Space')
      : await startGlobalCall('project', resolvedSpaceId, projectTitle || 'Project Space', 'member', { mode: 'audio_space', speakingMode });
    if (!success) {
      toast({ title: "Could not start the audio space", description: "Audio spaces need the latest server update: run the database part_n SQL and deploy the livekit-token and space-control functions.", variant: "destructive" });
    }
  };

  const handleStartCall = async () => {
    if (!resolvedSpaceId) return;
    const active = await findActiveCall('project', resolvedSpaceId);
    const success = active
      ? await joinGlobalCall('project', resolvedSpaceId, projectTitle || 'Project Call')
      : await startGlobalCall('project', resolvedSpaceId, projectTitle || 'Project Call');
    if (!success) {
      toast({
        title: "Error",
        description: "Failed to start call. Please try again.",
        variant: "destructive"
      });
    }
  };

  const collaborationNavItems = [
    { id: 'chat' as ActiveSection, label: 'Chat', icon: MessageCircle },
    { id: 'tasks' as ActiveSection, label: 'Tasks', icon: CheckSquare },
    { id: 'files' as ActiveSection, label: 'Files', icon: FileText },
  ];

  const productionOfficeNavItems = [
    { id: 'call-sheet' as ActiveSection, label: 'Call Sheet', icon: ClipboardList },
    { id: 'shot-list' as ActiveSection, label: 'Shot List', icon: Camera },
    { id: 'legal-docs' as ActiveSection, label: 'Legal Docs', icon: Briefcase },
    { id: 'budget-sched' as ActiveSection, label: 'Budget/Sched', icon: DollarSign },
  ];

  const teamNavItems = [
    { id: 'team' as ActiveSection, label: 'Team', icon: Users },
  ];

  // Only the creator manages; staff observers get the tabs read-only. Admins and members do not see them.
  if (canManage || isInternal) {
    teamNavItems.push({ id: 'applicants' as ActiveSection, label: 'Applicants', icon: UserPlus });
    teamNavItems.push({ id: 'settings' as ActiveSection, label: 'Settings', icon: Settings });
  }

  const displayCollaborationNavItems = isInCall
    ? [{ id: 'call' as ActiveSection, label: 'Live Call', icon: Video }, ...collaborationNavItems]
    : collaborationNavItems;

  const allNavItems = [
    ...collaborationNavItems,
    ...productionOfficeNavItems,
    ...teamNavItems
  ];

  if (isInCall) {
    allNavItems.unshift({ id: 'call' as ActiveSection, label: 'Live Call', icon: Video });
  }

  const renderContent = () => {
    if (!resolvedSpaceId) return (
      <div className="flex-1 flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );

    if (userRole === 'guest' && !isInternal) {
      return (
        <div className="flex flex-col items-center justify-center h-full p-8 text-center space-y-6">
          <div className="bg-primary/10 p-6 rounded-full">
            <Users className="w-12 h-12 text-primary" />
          </div>
          <div>
            <h2 className="text-2xl font-bold mb-2">Private Project Space</h2>
            <p className="text-muted-foreground max-w-md">
              {requestStatus === 'pending'
                ? "Your request to join this project is pending approval from the creator."
                : requestStatus === 'rejected'
                  ? "Your request to join was declined by the project owner."
                  : "You need to be a member of this project to view its content and collaborate."}
            </p>
          </div>

          {requestStatus === 'none' && (
            <Button onClick={handleJoinRequest} size="lg">
              Request to Join Project
            </Button>
          )}
          {requestStatus === 'pending' && (
            <Button disabled variant="outline">Request Pending</Button>
          )}
        </div>
      );
    }



    return (
      <div className="flex-1 w-full flex flex-col overflow-hidden relative">
        {/* Persistent Sections (Hidden but Mounted) */}
        <ProjectChatInterface
          projectId={projectId}
          spaceId={resolvedSpaceId}
          isActive={activeSection === 'chat'}
        />

        <div className={cn("flex-1 flex flex-col min-h-0", activeSection !== 'call' && "hidden")}>
          <div id="project-call-container" className="flex-1 w-full bg-[#09090b] relative min-h-0 overflow-hidden">
            {/* LiveKitCallContainer portals here */}
          </div>
        </div>

        {/* Dynamic Sections (Standard Switch) */}
        {(() => {
          switch (activeSection) {
            case 'tasks':
              return <Tasks project_id={resolvedSpaceId} />;
            case 'files':
              return <Files project_id={resolvedSpaceId} />;
            case 'call-sheet':
              return <CallSheet project_id={resolvedSpaceId} />;
            case 'shot-list':
              return <ShotList project_id={resolvedSpaceId} />;
            case 'legal-docs':
              return <LegalDocs project_id={resolvedSpaceId} />;
            case 'budget-sched':
              return <BudgetSched project_id={resolvedSpaceId} />;
            case 'team':
              return <Team project_id={resolvedSpaceId} real_project_id={projectId} canManage={canManage} />;
            case 'applicants':
              return <ProjectApplicants projectId={projectId} canManage={canManage} />;
            case 'settings':
              return <ProjectSettings projectId={projectId} canManage={canManage} />;
            default:
              return null;
          }
        })()}
      </div>
    );
  };

  // Only show a loading spinner for unknown users while their access is being checked.
  // Creators bypass this entirely because their role is set synchronously.
  if (userRole === 'guest' && (checkingAccess || roleLoading)) {
    return (
      <div className="h-dvh w-screen bg-background flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (isInternal && userRole === 'guest' && !hasGrantedAccess) {
    // Wait for resolvedSpaceId before showing the escalation panel.
    // If we render with an empty targetId, the grant gets stored with target_id=""
    // and Lock Space will fail to find the row when it tries to delete by real UUID.
    if (!resolvedSpaceId) {
      return (
        <div className="h-dvh w-screen bg-background flex items-center justify-center">
          <LoadingSpinner size="lg" />
        </div>
      );
    }
    return (
      <div className="flex-1 flex flex-col h-full bg-background overflow-hidden relative">
        {/* Top bar with back navigation */}
        <div className="px-4 sm:px-6 py-3 border-b border-border bg-card flex items-center gap-3 shrink-0">
          <Button
            variant="ghost"
            onClick={() => goBack('/projects')}
            className="text-muted-foreground hover:text-foreground flex items-center gap-2 hover:bg-foreground/5 rounded-xl px-4"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="text-sm font-medium">Back to projects</span>
          </Button>
          <div className="h-4 w-[1px] bg-border/40" />
          <span className="text-sm text-muted-foreground">Staff access</span>
        </div>

        {/* Escalation Interface */}
        <SpaceEscalationPanel
          targetType="project_space"
          targetId={resolvedSpaceId}
          chatTitle={projectTitle}
          onAccessGranted={() => {
            setHasGrantedAccess(true);
            // Re-run the access check so userRole updates based on membership
            // (the check effect won't fire again unless deps change)
            setCheckingAccess(true);
          }}
        />
      </div>
    );
  }

  if (userRole === 'guest' && !isInternal) {
    return (
      <div className="h-dvh w-screen bg-background flex flex-col p-4">
        {/* Guest View Dialog */}
        <Dialog open={true} onOpenChange={(open) => { if (!open) push('/projects', { noScroll: true }); }}>
          <DialogContent className="sm:max-w-md" onPointerDownOutside={(e) => e.preventDefault()} onEscapeKeyDown={(e) => e.preventDefault()}>
            <DialogHeader className="sr-only">
              <DialogTitle>Access Restricted</DialogTitle>
              <DialogDescription>
                You need to request access to join this project space.
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col items-center justify-center p-6 space-y-4 text-center">
              <div className="bg-primary/10 p-4 rounded-full">
                <Users className="w-10 h-10 text-primary" />
              </div>
              <p className="text-muted-foreground">
                You are not a member of this project. To view its content and collaborate, you must request to join.
              </p>

              {requestStatus === 'none' && (
                <div className="w-full space-y-2 text-left">
                  <label htmlFor="requestNote" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Optional Note
                  </label>
                  <textarea
                    id="requestNote"
                    placeholder="Briefly explain why you're requesting to join..."
                    value={requestNote}
                    onChange={(e) => setRequestNote(e.target.value)}
                    className="w-full min-h-[100px] bg-background border border-border rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition resize-none"
                  />
                </div>
              )}

              {requestStatus === 'pending' && (
                <div className="p-3 bg-yellow-500/10 text-yellow-500 rounded-md border border-yellow-500/20 text-sm w-full">
                  Your request is currently pending approval.
                </div>
              )}
              {requestStatus === 'approved' && (
                <div className="p-3 bg-primary/10 text-green-500 rounded-md border border-primary/20 text-sm w-full">
                  Your request has been approved! <br />
                  <Button variant="link" onClick={() => window.location.reload()} className="p-0 h-auto font-bold text-primary">
                    Refresh Page
                  </Button> to access.
                </div>
              )}
              {requestStatus === 'rejected' && (
                <div className="p-3 bg-red-500/10 text-red-500 rounded-md border border-red-500/20 text-sm w-full">
                  Your request was declined by the project owner.
                </div>
              )}
            </div>
            <div className="flex flex-row justify-end space-x-2 w-full">
              <Button variant="outline" onClick={() => goBack('/projects')} className="flex-1">
                Cancel
              </Button>
              {requestStatus === 'none' ? (
                <Button onClick={handleJoinRequest} className="flex-1">
                  Request to Join
                </Button>
              ) : requestStatus === 'approved' ? (
                <Button onClick={() => window.location.reload()} className="flex-1 bg-primary hover:bg-primary/90">
                  Enter Space
                </Button>
              ) : (
                <Button disabled className="flex-1 opacity-50">
                  Request Sent
                </Button>
              )}
            </div>
          </DialogContent>
        </Dialog>

        <div className="flex-1 flex items-center justify-center opacity-10 filter blur-sm pointer-events-none">
          <LoadingSpinner size="lg" />
        </div>
      </div>
    );
  }

  const renderNavGroup = (title: string, items: { id: ActiveSection; label: string; icon: any }[]) => (
    <div>
      <h3 className="text-xs font-semibold text-muted-foreground mb-1.5 px-3">{title}</h3>
      <div className="space-y-0.5">
        {items.map((item) => {
          const Icon = item.icon;
          const isActive = activeSection === item.id;
          const isCallItem = item.id === 'call';
          return (
            <button
              key={item.id}
              type="button"
              aria-current={isActive ? 'page' : undefined}
              onClick={() => handleSelectSection(item.id)}
              className={cn(
                'w-full flex items-center gap-3 h-10 px-3 rounded-lg text-sm transition-colors',
                isCallItem
                  ? isActive ? 'bg-red-500/15 text-red-600 font-semibold' : 'bg-red-500/10 text-red-600 hover:bg-red-500/15 font-medium'
                  : isActive ? 'bg-primary/10 text-primary font-semibold' : 'text-muted-foreground hover:bg-muted hover:text-foreground',
              )}
            >
              <Icon className="h-[18px] w-[18px] shrink-0" />
              <span className="flex-1 text-left truncate">{item.label}</span>
              {isCallItem && <span className="text-xs bg-red-500 text-white px-1.5 py-0.5 rounded-full font-semibold">Live</span>}
            </button>
          );
        })}
      </div>
    </div>
  );

  return (
    <div className="flex flex-col flex-1 w-full bg-background text-foreground lg:border lg:border-border lg:rounded-2xl overflow-hidden lg:shadow-sm relative">
      {/* Invisible anchor for Call UI logic to recognize this space */}
      <div id="active-project-anchor" data-project-id={projectId} data-space-id={resolvedSpaceId} className="hidden" />

      {/* Mobile Header & Navigation */}
      <div className="lg:hidden flex flex-col bg-background z-[60] shrink-0 sticky top-0 border-b border-border/40 pb-1">
        <div className="flex items-center px-4 py-3 gap-2">
          <Button aria-label="Back"
            variant="ghost"
            size="icon"
            onClick={() => goBack('/projects')}
            className="h-10 w-10 rounded-full hover:bg-foreground/10 shrink-0"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <ProjectAvatar url={projectImageUrl} title={projectTitle} className="h-10 w-10" />
          <div className="flex flex-col min-w-0 flex-1 py-0.5">
            <h2 className="text-lg font-bold truncate leading-tight">{projectTitle}</h2>
          </div>
          <div className="flex items-center gap-1.5">
            <ProjectCallControls
              layout="header"
              isInCall={isInCall}
              isInternal={isInternal}
              active={activeRoomCall}
              onReturn={() => handleSelectSection('call')}
              onJoin={handleStartCall}
              onStartVideo={handleStartCall}
              onStartAudio={handleStartAudioSpace}
            />
          </div>
        </div>

        <div className="relative w-full py-1">
          <div
            ref={scrollContainerRef}
            className="flex overflow-x-auto gap-2.5 px-4 pb-2.5 pt-1 no-scrollbar w-full"
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
          >
            {allNavItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeSection === item.id;
              return (
                <button
                  id={`tab-${item.id}`}
                  key={item.id}
                  onClick={() => handleSelectSection(item.id)}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold whitespace-nowrap transition-colors duration-200 border shrink-0 min-h-[44px]",
                    isActive
                      ? "bg-primary text-primary-foreground border-primary "
                      : "bg-secondary/40 border-border/30 text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  <span>{item.label}</span>
                </button>
              );
            })}
            <div className="w-4 shrink-0" /> {/* End padding */}
          </div>
          {/* Gradient fade for scroll hint */}
          <div className="absolute right-0 top-0 bottom-3 w-12 bg-gradient-to-l from-background to-transparent pointer-events-none" />
          <div className="absolute left-0 top-0 bottom-3 w-4 bg-gradient-to-r from-background to-transparent pointer-events-none" />
        </div>
      </div>

        <div className="hidden lg:flex shrink-0 items-center gap-3 px-4 h-14 border-b border-border bg-card relative z-10">
          <Button aria-label="Back to projects"
            variant="ghost"
            size="icon"
            onClick={() => goBack('/projects')}
            className="h-9 w-9 rounded-full shrink-0 text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <ProjectAvatar url={projectImageUrl} title={projectTitle} className="h-8 w-8 text-sm" />
          <div className="min-w-0 flex-1 overflow-hidden">
            <h2 className="text-base font-semibold text-foreground truncate">{projectTitle}</h2>
            <p className="text-xs text-muted-foreground -mt-0.5">Project space</p>
          </div>

          <div className="flex items-center gap-2 ml-auto shrink-0">
            <ProjectCallControls
              layout="header"
              isInCall={isInCall}
              isInternal={isInternal}
              active={activeRoomCall}
              onReturn={() => handleSelectSection('call')}
              onJoin={handleStartCall}
              onStartVideo={handleStartCall}
              onStartAudio={handleStartAudioSpace}
            />
          </div>
        </div>

      <div className="flex flex-1 overflow-hidden relative">
        {/* Desktop Sidebar */}
        <div
          className="hidden lg:flex flex-col border-r border-border bg-card relative z-0 h-full"
          style={{ width: sidebarWidth }}
        >
          <nav className="flex-1 p-3 space-y-6 overflow-y-auto custom-scrollbar" aria-label="Project space sections">
            {renderNavGroup('Collaboration', displayCollaborationNavItems)}
            {renderNavGroup('Production office', productionOfficeNavItems)}
            {renderNavGroup('Team', teamNavItems)}
          </nav>
        </div>

        <div
          className="hidden lg:block w-1 cursor-col-resize hover:bg-primary/50 transition-colors bg-border"
          onMouseDown={handleMouseDown}
        />

        <main className="flex-1 flex flex-col overflow-hidden bg-muted/30 relative w-full">
          {isInternal && hasGrantedAccess && resolvedSpaceId && (
            <StaffObserverBanner targetType="project_space" targetId={resolvedSpaceId} onEnded={handleObserverEnded} />
          )}
          {activeRoomCall && !isInCall && activeSection !== 'call' && (
            <div className="shrink-0 flex items-center gap-3 px-4 py-2.5 bg-emerald-500/10 border-b border-emerald-500/20" role="status">
              <span className="relative flex h-2.5 w-2.5 shrink-0">
                <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-60 animate-ping" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
              </span>
              <p className="flex-1 min-w-0 text-sm font-medium text-foreground truncate">
                {activeRoomCall.mode === 'audio_space' ? 'An audio room is live' : 'A video call is live'} in this project
              </p>
              <Button size="sm" onClick={handleStartCall} className="h-8 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-4">
                Join
              </Button>
            </div>
          )}
          {renderContent()}
        </main>
      </div>
    </div>
  );
};

