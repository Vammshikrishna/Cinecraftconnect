import { useState, useEffect, useCallback, useRef } from 'react';
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
  BookOpen
} from 'lucide-react';

import { ProjectChatInterface } from '@/components/discussions/ProjectChatInterface';
import Tasks from '@/components/projects/Tasks';
import Files from '@/components/projects/Files';
import CallSheet from '@/components/projects/CallSheet';
import ShotList from '@/components/projects/ShotList';
import ScreenplayReader from '@/components/projects/ScreenplayReader';
import LegalDocs from '@/components/projects/LegalDocs';
import BudgetSched from '@/components/projects/BudgetSched';
import Team from '@/components/projects/Team';
import ProjectApplicants from '@/components/projects/ProjectApplicants';
import ProjectSettings from '@/components/projects/ProjectSettings';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { LoadingSpinner } from '@/components/ui/loading-spinner';

import { useToast } from '@/hooks/use-toast';
import { useAppRole } from '@/hooks/useAppRole';
import { useGlobalCall } from '@/contexts/CallContext';

interface ProjectSpaceProps {
  projectId: string;
  projectTitle: string;
  projectDescription: string;
}

const SECTIONS = ['chat', 'tasks', 'files', 'team', 'call-sheet', 'shot-list', 'script-reader', 'legal-docs', 'budget-sched', 'applicants', 'settings', 'call'] as const;
type ActiveSection = typeof SECTIONS[number];

export const ProjectSpace = ({
  projectId,
  projectTitle,
  projectDescription,
}: ProjectSpaceProps) => {
  const { push } = useAppNavigation();
  const { user } = useAuth();
  const { isInternal, loading: roleLoading } = useAppRole();
  const { toast } = useToast();
  const [userRole, setUserRole] = useState<'creator' | 'admin' | 'member' | 'guest'>('guest');
  const [resolvedSpaceId, setResolvedSpaceId] = useState<string>(projectId);
  const [requestStatus, setRequestStatus] = useState<'none' | 'pending' | 'rejected' | 'approved'>('none');
  const [checkingAccess, setCheckingAccess] = useState(true); // New loading state
  const [activeSection, setActiveSection] = useState<ActiveSection>('chat');
  const [sidebarWidth, setSidebarWidth] = useState(280);
  const [isResizing, setIsResizing] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Global Call state
  const { callState, startCall: startGlobalCall, toggleMinimize, togglePipHidden } = useGlobalCall();
  const isInCall = callState.isActive && (callState.roomId === resolvedSpaceId || callState.roomId === projectId);
  const isCallMinimized = callState.isMinimized;

  // Scroll active tab into view
  useEffect(() => {
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
        }
      } catch (e) {
        // Silent catch for resolution
      }
    };
    resolveSpace();
    return () => { mounted = false; };
  }, [projectId]);

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

  // Synchronize activeSection with call minimization and hidden state
  useEffect(() => {
    if (isInCall) {
      if ((activeSection as string) === 'call') {
        if (isCallMinimized) toggleMinimize(false);
        if (callState.isPipHidden) togglePipHidden(false);
      } else if ((activeSection as string) !== 'call' && !isCallMinimized) {
        toggleMinimize(true);
      }
    }
  }, [activeSection, isInCall, isCallMinimized, toggleMinimize, callState.isPipHidden, togglePipHidden]);

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

  useEffect(() => {
    let active = true;
    const checkAccess = async () => {
      setCheckingAccess(true);
      if (!user?.id || !resolvedSpaceId) {
        if (active) setCheckingAccess(false);
        return;
      }

      try {
        // 1. Check Creator Status FIRST
        const { data: project } = await supabase
          .from('projects')
          .select('creator_id')
          .eq('id', projectId)
          .single();

        if (!active) return;

        if (project && project.creator_id === user.id) {
          setUserRole('creator');
          return;
        }

        // 2. Check Membership
        const { data: membership } = await supabase
          .from('project_space_members')
          .select('role')
          .eq('project_space_id', resolvedSpaceId)
          .eq('user_id', user.id)
          .maybeSingle();

        if (!active) return;

        if (membership) {
          if (membership.role === 'admin') {
            setUserRole('admin');
          } else {
            setUserRole('member');
          }
          return;
        }

        // 3. Check for pending join request
        const { data: request } = await supabase
          .from('project_space_join_requests' as any)
          .select('status, id')
          .eq('project_space_id', resolvedSpaceId)
          .eq('user_id', user.id)
          .maybeSingle();

        if (!active) return;

        if (request && (request as any).status === 'pending') {
          setRequestStatus('pending');
        } else if (request && (request as any).status === 'rejected') {
          setRequestStatus('rejected');
        } else if (request && (request as any).status === 'approved') {
          setRequestStatus('approved');
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
  }, [projectId, resolvedSpaceId, user?.id]);

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

  const handleStartCall = async () => {
    if (!resolvedSpaceId) return;
    const success = await startGlobalCall('project', resolvedSpaceId, projectTitle || 'Project Call');
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
    { id: 'script-reader' as ActiveSection, label: 'Script Reader', icon: BookOpen },
    { id: 'legal-docs' as ActiveSection, label: 'Legal Docs', icon: Briefcase },
    { id: 'budget-sched' as ActiveSection, label: 'Budget/Sched', icon: DollarSign },
  ];

  const teamNavItems = [
    { id: 'team' as ActiveSection, label: 'Team', icon: Users },
  ];

  if (userRole === 'creator' || userRole === 'admin' || isInternal) {
    teamNavItems.push({ id: 'applicants' as ActiveSection, label: 'Applicants', icon: UserPlus });
    teamNavItems.push({ id: 'settings' as ActiveSection, label: 'Settings', icon: Settings });
  }

  const allNavItems = [
    ...collaborationNavItems,
    ...productionOfficeNavItems,
    ...teamNavItems
  ];

  if (isInCall) {
    allNavItems.unshift({ id: 'call' as ActiveSection, label: 'Live Call', icon: Video });
  }

  const renderContent = () => {
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
            <Button onClick={handleJoinRequest} size="lg" className="animate-pulse">
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
          isActive={activeSection === 'chat'}
        />
        
        <div className={cn("flex-1 flex flex-col", activeSection !== 'call' && "hidden")}>
           <div id="project-call-container" className="flex-1 w-full bg-[#09090b] relative">
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
            case 'script-reader':
              return <ScreenplayReader project_id={resolvedSpaceId} />;
            case 'legal-docs':
              return <LegalDocs project_id={resolvedSpaceId} />;
            case 'budget-sched':
              return <BudgetSched project_id={resolvedSpaceId} />;
            case 'team':
              return <Team project_id={resolvedSpaceId} />;
            case 'applicants':
              return <ProjectApplicants projectId={projectId} />;
            case 'settings':
              return <ProjectSettings projectId={projectId} />;
            default:
              return null;
          }
        })()}
      </div>
    );
  };

  if (checkingAccess || roleLoading) {
    return (
      <div className="h-screen w-screen bg-background flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (userRole === 'guest' && !isInternal) {
    return (
      <div className="h-screen w-screen bg-background flex flex-col p-4">
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
                    className="w-full min-h-[100px] bg-background border border-border rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all resize-none"
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
              <Button variant="outline" onClick={() => push('/projects', { noScroll: true })} className="flex-1">
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

  return (
    <div className="flex flex-col flex-1 w-full bg-background/95 backdrop-blur-md text-foreground lg:border lg:border-border lg:rounded-xl overflow-hidden lg:shadow-[0_0_50px_-12px_rgba(0,0,0,0.5)] relative">
      {/* Invisible anchor for Call UI logic to recognize this space */}
      <div id="active-project-anchor" data-project-id={projectId} data-space-id={resolvedSpaceId} className="hidden" />
      
      {/* Mobile Header & Navigation */}
      <div className="lg:hidden flex flex-col bg-background z-[60] shrink-0 sticky top-0">
        <div className="flex items-center px-3 py-2 gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => push('/projects', { noScroll: true })}
            className="h-9 w-9 rounded-full hover:bg-white/10 shrink-0"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex flex-col min-w-0 flex-1 py-1">
            <h2 className="text-base font-bold truncate leading-tight">{projectTitle}</h2>
          </div>
          <div className="flex items-center gap-1.5">
            {isInCall ? (
              <button 
                onClick={() => setActiveSection('call')}
                className="flex items-center gap-1.5 px-2 py-1 bg-primary/20 border border-primary/30 rounded-full animate-pulse hover:bg-primary/30 transition-all shrink-0"
              >
                <Video className="h-4 w-4 text-green-500" />
                <span className="text-[10px] font-bold text-green-500 uppercase tracking-wider">Live</span>
              </button>
            ) : !isInternal ? (
              <>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleStartCall}
                  className="h-9 w-9 rounded-full hover:bg-white/10 shrink-0"
                >
                  <Phone className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleStartCall}
                  className="h-9 w-9 rounded-full hover:bg-white/10 shrink-0"
                >
                  <Video className="h-4 w-4" />
                </Button>
              </>
            ) : (
              <div title="Staff Observation Only">
                <ShieldBan className="h-4 w-4 text-muted-foreground/30" />
              </div>
            )}
          </div>
        </div>

        <div className="relative w-full">
          <div
            ref={scrollContainerRef}
            className="flex overflow-x-auto gap-2 px-4 pb-2 no-scrollbar w-full"
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
          >
            {allNavItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeSection === item.id;
              return (
                <button
                  id={`tab-${item.id}`}
                  key={item.id}
                  onClick={() => setActiveSection(item.id)}
                  className={cn(
                    "flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all duration-300 border shrink-0",
                    isActive
                      ? "bg-primary text-primary-foreground border-primary shadow-[0_0_15px_-3px_rgba(var(--primary),0.4)] scale-105"
                      : "bg-secondary/30 border-transparent text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {item.label}
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

      <div className="flex flex-1 overflow-hidden relative">
        {/* Desktop Sidebar */}
        <div
            className="hidden lg:flex flex-col border-r border-border bg-card/95 backdrop-blur-xl relative z-0 h-full"
          style={{ width: sidebarWidth }}
        >
          <div className="p-4 border-b border-border bg-gradient-to-b from-muted/5 to-transparent flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => push('/projects', { noScroll: true })}
              className="h-8 w-8 rounded-full hover:bg-white/10 shrink-0 text-muted-foreground hover:text-primary transition-colors"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="overflow-hidden">
              <h2 className="text-lg font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary to-purple-400 truncate">
                {projectTitle}
              </h2>
              <p className="text-xs text-muted-foreground truncate">
                {projectDescription}
              </p>
            </div>
            
            <div className="flex items-center gap-1 ml-auto shrink-0">
              {isInCall ? (
                <button 
                  onClick={() => setActiveSection('call')}
                  className="flex items-center gap-2 px-3 py-1 bg-primary/10 border border-primary/20 rounded-full hover:bg-primary/20 transition-all"
                >
                  <Video className="h-3.5 w-3.5 text-green-500 animate-pulse" />
                  <span className="text-[10px] font-bold text-green-500 uppercase tracking-wider">Live</span>
                </button>
              ) : !isInternal ? (
                <>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleStartCall}
                    className="h-8 w-8 rounded-full hover:bg-primary/10 text-muted-foreground hover:text-primary transition-all"
                    title="Start Voice Call"
                  >
                    <Phone className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleStartCall}
                    className="h-8 w-8 rounded-full hover:bg-primary/10 text-muted-foreground hover:text-primary transition-all"
                    title="Start Video Call"
                  >
                    <Video className="h-4 w-4" />
                  </Button>
                </>
              ) : (
                <div className="bg-muted/30 p-1.5 rounded-full border border-border/50" title="Staff Observation Mode">
                  <ShieldBan className="h-3.5 w-3.5 text-muted-foreground/40" />
                </div>
              )}
            </div>
          </div>

          <nav className="flex-1 p-4 space-y-8 overflow-y-auto custom-scrollbar">
            <div>
              <h3 className="text-xs font-bold text-muted-foreground/70 uppercase tracking-widest mb-3 px-3">
                Collaboration
              </h3>
              <div className="space-y-1">
                {collaborationNavItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeSection === item.id;
                  return (
                    <Button
                      key={item.id}
                      variant="ghost"
                      className={`w-full justify-start gap-3 h-11 px-3 font-medium transition-all duration-200 rounded-lg group ${isActive
                        ? 'bg-primary/15 text-primary border-l-2 border-primary rounded-l-none'
                        : 'text-muted-foreground hover:bg-white/5 hover:text-foreground'
                        }`}
                      onClick={() => setActiveSection(item.id)}
                    >
                      <Icon className={`h-5 w-5 transition-colors ${isActive ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground'}`} />
                      <span>{item.label}</span>
                      {isActive && <ChevronRight className="h-4 w-4 ml-auto opacity-50" />}
                    </Button>
                  );
                })}
              </div>
            </div>

            <div>
              <h3 className="text-xs font-bold text-muted-foreground/70 uppercase tracking-widest mb-3 px-3">
                Production Office
              </h3>
              <div className="space-y-1">
                {productionOfficeNavItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeSection === item.id;
                  return (
                    <Button
                      key={item.id}
                      variant="ghost"
                      className={`w-full justify-start gap-3 h-11 px-3 font-medium transition-all duration-200 rounded-lg group ${isActive
                        ? 'bg-primary/15 text-primary border-l-2 border-primary rounded-l-none'
                        : 'text-muted-foreground hover:bg-white/5 hover:text-foreground'
                        }`}
                      onClick={() => setActiveSection(item.id)}
                    >
                      <Icon className={`h-5 w-5 transition-colors ${isActive ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground'}`} />
                      <span>{item.label}</span>
                      {isActive && <ChevronRight className="h-4 w-4 ml-auto opacity-50" />}
                    </Button>
                  );
                })}
              </div>
            </div>

            <div>
              <h3 className="text-xs font-bold text-muted-foreground/70 uppercase tracking-widest mb-3 px-3">
                Team
              </h3>
              <div className="space-y-1">
                {teamNavItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeSection === item.id;
                  return (
                    <Button
                      key={item.id}
                      variant="ghost"
                      className={`w-full justify-start gap-3 h-11 px-3 font-medium transition-all duration-200 rounded-lg group ${isActive
                        ? 'bg-primary/15 text-primary border-l-2 border-primary rounded-l-none'
                        : 'text-muted-foreground hover:bg-white/5 hover:text-foreground'
                        }`}
                      onClick={() => setActiveSection(item.id)}
                    >
                      <Icon className={`h-5 w-5 transition-colors ${isActive ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground'}`} />
                      <span>{item.label}</span>
                      {isActive && <ChevronRight className="h-4 w-4 ml-auto opacity-50" />}
                    </Button>
                  );
                })}
              </div>
            </div>
          </nav>
        </div>

        <div
          className="hidden lg:block w-1 cursor-col-resize hover:bg-primary/50 transition-colors bg-border"
          onMouseDown={handleMouseDown}
        />

        <main className="flex-1 flex flex-col overflow-hidden bg-background/50 relative w-full">
          <div className="absolute inset-0 bg-[radial-gradient(#ffffff15_1px,transparent_1px)] [background-size:16px_16px] opacity-30 pointer-events-none" />
          {renderContent()}
        </main>
      </div>
    </div>
  );
};

