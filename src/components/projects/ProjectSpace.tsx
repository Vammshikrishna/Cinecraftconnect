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
  const [userRole, setUserRole] = useState<'creator' | 'admin' | 'member'>('member');
  const [activeSection, setActiveSection] = useState<ActiveSection>('chat');
  const [sidebarWidth, setSidebarWidth] = useState(280);
  const [isResizing, setIsResizing] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

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
    const fetchUserRole = async () => {
      if (!user || !projectId) return;
      try {
        const { data: membership, error } = await supabase
          .from('project_space_members')
          .select('*')
          .eq('project_space_id', projectId)
          .eq('user_id', user.id)
          .maybeSingle();

        if (error && error.code !== 'PGRST116') throw error;

        if (membership) {
          setUserRole('member');
        } else {
          const { data: project, error: projectError } = await supabase
            .from('project_spaces')
            .select('creator_id')
            .eq('id', projectId)
            .single();
          if (projectError) throw projectError;
          if (project && project.creator_id === user.id) {
            setUserRole('creator');
          }
        }
      } catch (error) {
        console.error('Error fetching user role:', error);
      }
    };
    fetchUserRole();
  }, [projectId, user]);

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
    switch (activeSection) {
      case 'chat':
        return <ProjectChatInterface projectId={projectId} />;
      case 'tasks':
        return <Tasks project_id={projectId} />;
      case 'files':
        return <Files project_id={projectId} />;
      case 'call-sheet':
        return <CallSheet project_id={projectId} />;
      case 'shot-list':
        return <ShotList project_id={projectId} />;
      case 'legal-docs':
        return <LegalDocs project_id={projectId} />;
      case 'budget-sched':
        return <BudgetSched project_id={projectId} />;
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

  return (
    <div className="flex flex-col h-full w-full bg-background/95 backdrop-blur-md text-foreground lg:border lg:border-white/20 lg:rounded-xl overflow-hidden lg:shadow-[0_0_50px_-12px_rgba(0,0,0,0.5)]">
      {/* Mobile Header & Navigation */}
      <div className="lg:hidden flex flex-col border-b border-white/10 bg-background/80 backdrop-blur-xl z-30 shrink-0 sticky top-0">
        <div className="flex items-center justify-between p-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/projects')}
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
              onClick={() => navigate('/projects')}
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
