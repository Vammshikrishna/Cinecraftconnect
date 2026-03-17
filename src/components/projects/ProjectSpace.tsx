import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
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
  Settings
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
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { LoadingSpinner } from '@/components/ui/loading-spinner';

import { useToast } from '@/hooks/use-toast';

interface ProjectSpaceProps {
  projectId: string;
  projectTitle: string;
  projectDescription: string;
}

type ActiveSection = 'chat' | 'tasks' | 'files' | 'team' | 'call-sheet' | 'shot-list' | 'legal-docs' | 'budget-sched' | 'applicants' | 'settings';

export const ProjectSpace = ({
  projectId,
  projectTitle,
  projectDescription,
}: ProjectSpaceProps) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [userRole, setUserRole] = useState<'creator' | 'admin' | 'member' | 'guest'>('guest');
  const [resolvedSpaceId, setResolvedSpaceId] = useState<string>(projectId);
  const [requestStatus, setRequestStatus] = useState<'none' | 'pending' | 'rejected' | 'approved'>('none');
  const [checkingAccess, setCheckingAccess] = useState(true); // New loading state
  const [activeSection, setActiveSection] = useState<ActiveSection>('chat');
  const [sidebarWidth, setSidebarWidth] = useState(280);
  const [isResizing, setIsResizing] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Scroll active tab into view
  useEffect(() => {
    let mounted = true;
    const resolveSpace = async () => {
      if (!projectId) return;
      try {
        console.log("Resolving space for project:", projectId);
        const { data, error } = await supabase
          .from('project_spaces')
          .select('id')
          .eq('project_id', projectId)
          .maybeSingle();

        if (error) console.error("Error resolving space query:", error);

        if (mounted && data) {
          console.log("Resolved space ID:", data.id);
          setResolvedSpaceId(data.id);
        } else if (mounted) {
          console.warn("No space found for project:", projectId);
        }
      } catch (e) {
        console.error("Error resolving space:", e);
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
      if (!user || !resolvedSpaceId) {
        if (active) setCheckingAccess(false);
        return;
      }
      console.log(`Checking access for User: ${user.id}, Space: ${resolvedSpaceId}`);

      try {
        // 1. Check Membership
        const { data: membership, error: memError } = await supabase
          .from('project_space_members')
          .select('role')
          .eq('project_space_id', resolvedSpaceId)
          .eq('user_id', user.id)
          .maybeSingle();

        if (!active) return; // Stop if unmounted or new effect fired

        console.log("Membership check:", { membership, error: memError });

        if (membership) {
          console.log("User is member. Role:", membership.role);
          setUserRole('member');
          return; // Exit early
        }

        // 2. Check Creator Status
        const { data: project } = await supabase
          .from('projects')
          .select('creator_id')
          .eq('id', projectId)
          .single();

        if (!active) return;

        if (project && project.creator_id === user.id) {
          console.log("User is creator.");
          setUserRole('creator');
          return;
        }

        // 3. Check for pending join request
        const { data: request, error: reqError } = await supabase
          .from('project_space_join_requests' as any)
          .select('status, id')
          .eq('project_space_id', resolvedSpaceId)
          .eq('user_id', user.id)
          .maybeSingle();

        if (!active) return;

        console.log("Request check:", { request, error: reqError });

        if (request && (request as any).status === 'pending') {
          setRequestStatus('pending');
        } else if (request && (request as any).status === 'rejected') {
          setRequestStatus('rejected');
        } else if (request && (request as any).status === 'approved') {
          console.log("Request is approved (But member check failed/empty).");
          setRequestStatus('approved');
        }

        setUserRole('guest');

      } catch (err) {
        console.error('Error fetching user role:', err);
      } finally {
        if (active) setCheckingAccess(false);
      }
    };

    checkAccess();

    return () => { active = false; };
  }, [projectId, resolvedSpaceId, user]);

  const handleJoinRequest = async () => {
    console.log("Handle Join Request clicked", { user: user?.id, resolvedSpaceId });

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
          user_id: user.id
        });

      if (error) {
        console.error("Join request specific error:", error);
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
      console.error("Join request failed exception:", e);
      toast({ title: "Error", description: "Failed to send request: " + (e.message || "Unknown error"), variant: "destructive" });
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

  if (userRole === 'creator' || userRole === 'admin') {
    teamNavItems.push({ id: 'applicants' as ActiveSection, label: 'Applicants', icon: UserPlus });
    teamNavItems.push({ id: 'settings' as ActiveSection, label: 'Settings', icon: Settings });
  }

  const allNavItems = [
    ...collaborationNavItems,
    ...productionOfficeNavItems,
    ...teamNavItems
  ];

  const renderContent = () => {
    if (userRole === 'guest') {
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



    // ... (rest of renderContent switch)
    switch (activeSection) {
      case 'chat':
        return <ProjectChatInterface projectId={projectId} />;
      case 'tasks':
        return <Tasks project_id={resolvedSpaceId} />; // Use resolved ID
      case 'files':
        return <Files project_id={resolvedSpaceId} />; // Use resolved ID
      case 'call-sheet':
        return <CallSheet project_id={resolvedSpaceId} />;
      case 'shot-list':
        return <ShotList project_id={resolvedSpaceId} />;
      case 'legal-docs':
        return <LegalDocs project_id={resolvedSpaceId} />;
      case 'budget-sched':
        return <BudgetSched project_id={resolvedSpaceId} />;
      case 'team':
        return <Team project_id={projectId} />;
      case 'applicants':
        return <ProjectApplicants projectId={projectId} />;
      case 'settings':
        return <ProjectSettings projectId={projectId} />;
      default:
        return <div className="flex items-center justify-center h-full"><p className="text-muted-foreground">Select a section</p></div>;
    }
  };

  if (checkingAccess) {
    return (
      <div className="h-screen w-screen bg-background flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (userRole === 'guest') {
    return (
      <div className="h-screen w-screen bg-background flex flex-col p-4">
        {/* Guest View Dialog */}
        <Dialog open={true} onOpenChange={(open) => { if (!open) navigate(-1); }}>
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
              {requestStatus === 'pending' && (
                <div className="p-3 bg-yellow-500/10 text-yellow-500 rounded-md border border-yellow-500/20 text-sm w-full">
                  Your request is currently pending approval.
                </div>
              )}
              {requestStatus === 'approved' && (
                <div className="p-3 bg-green-500/10 text-green-500 rounded-md border border-green-500/20 text-sm w-full">
                  Your request has been approved! <br />
                  <Button variant="link" onClick={() => window.location.reload()} className="p-0 h-auto font-bold text-green-600">
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
              <Button variant="outline" onClick={() => navigate(-1)} className="flex-1">
                Cancel
              </Button>
              {requestStatus === 'none' ? (
                <Button onClick={handleJoinRequest} className="flex-1">
                  Request to Join
                </Button>
              ) : requestStatus === 'approved' ? (
                <Button onClick={() => window.location.reload()} className="flex-1 bg-green-600 hover:bg-green-700">
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
    <div className="flex flex-col h-full w-full bg-background/95 backdrop-blur-md text-foreground lg:border lg:border-white/20 lg:rounded-xl overflow-hidden lg:shadow-[0_0_50px_-12px_rgba(0,0,0,0.5)]">
      {/* Mobile Header & Navigation */}
      <div className="lg:hidden flex flex-col border-b border-white/10 bg-background z-[60] shrink-0 sticky top-0">
        <div className="flex items-center justify-between p-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(-1)}
            className="h-9 w-9 rounded-full hover:bg-white/10 shrink-0"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="text-center overflow-hidden px-2">
            <h2 className="text-sm font-semibold truncate leading-tight">{projectTitle}</h2>
            <p className="text-[10px] text-muted-foreground truncate leading-tight opacity-70">Project Space</p>
          </div>
          <div className="w-9 shrink-0" /> {/* Spacer for balance */}
        </div>

        <div className="relative w-full">
          <div
            ref={scrollContainerRef}
            className="flex overflow-x-auto gap-2 px-4 pb-3 scrollbar-hide w-full"
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
          className="hidden lg:flex flex-col border-r border-white/20 bg-card/95 backdrop-blur-xl relative z-0 h-full"
          style={{ width: sidebarWidth }}
        >
          <div className="p-4 border-b border-white/20 bg-gradient-to-b from-white/5 to-transparent flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate(-1)}
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
          className="hidden lg:block w-1 cursor-col-resize hover:bg-primary/50 transition-colors bg-white/10"
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
