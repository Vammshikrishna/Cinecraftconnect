import { useState, useEffect, useCallback } from 'react';
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
  UserPlus
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
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';

interface ProjectSpaceProps {
  projectId: string;
  projectTitle: string;
  projectDescription: string;
}

type ActiveSection = 'chat' | 'tasks' | 'files' | 'team' | 'call-sheet' | 'shot-list' | 'legal-docs' | 'budget-sched' | 'applicants';

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
          .single();

        if (error && error.code !== 'PGRST116') throw error;

        if (membership) {
          // Member exists, default to member role
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
  }

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
      default:
        return <div className="flex items-center justify-center h-full"><p className="text-muted-foreground">Select a section</p></div>;
    }
  };

  return (
    <div className="flex flex-col h-full w-full bg-background text-foreground border border-border/50 rounded-lg overflow-hidden">
      <header className="px-4 py-3 border-b border-border/50 flex items-center">
        <Button
          variant="outline"
          onClick={() => navigate('/projects')}
          className="gap-2 text-sm"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Projects
        </Button>
      </header>
      <div className="flex flex-1 overflow-hidden">
        <div
          className="flex flex-col border-r border-border/50 bg-slate-900/50"
          style={{ width: sidebarWidth }}
        >
          <div className="p-4 border-b border-border/50">
            <h2 className="text-lg font-semibold px-2">{projectTitle}</h2>
            <p className="text-xs text-muted-foreground px-2 pt-1">{projectDescription}</p>
          </div>

          <nav className="flex-1 p-2 space-y-4 text-sm">
            <div>
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-2">COLLABORATION</h3>
              <div className="space-y-1">
                {collaborationNavItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeSection === item.id;
                  return (
                    <Button
                      key={item.id}
                      variant={isActive ? "secondary" : "ghost"}
                      className={`w-full justify-start gap-3 h-10 px-2 font-normal ${isActive ? 'text-foreground' : 'text-muted-foreground'
                        }`}
                      onClick={() => setActiveSection(item.id)}
                    >
                      <Icon className="h-5 w-5" />
                      <span>{item.label}</span>
                      {isActive && <ChevronRight className="h-4 w-4 ml-auto" />}
                    </Button>
                  );
                })}
              </div>
            </div>

            <div>
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-2">PRODUCTION OFFICE</h3>
              <div className="space-y-1">
                {productionOfficeNavItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeSection === item.id;
                  return (
                    <Button
                      key={item.id}
                      variant={isActive ? "secondary" : "ghost"}
                      className={`w-full justify-start gap-3 h-10 px-2 font-normal ${isActive ? 'text-foreground' : 'text-muted-foreground'
                        }`}
                      onClick={() => setActiveSection(item.id)}
                    >
                      <Icon className="h-5 w-5" />
                      <span>{item.label}</span>
                      {isActive && <ChevronRight className="h-4 w-4 ml-auto" />}
                    </Button>
                  );
                })}
              </div>
            </div>

            <div>
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-2">TEAM</h3>
              <div className="space-y-1">
                {teamNavItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeSection === item.id;
                  return (
                    <Button
                      key={item.id}
                      variant={isActive ? "secondary" : "ghost"}
                      className={`w-full justify-start gap-3 h-10 px-2 font-normal ${isActive ? 'text-foreground' : 'text-muted-foreground'
                        }`}
                      onClick={() => setActiveSection(item.id)}
                    >
                      <Icon className="h-5 w-5" />
                      <span>{item.label}</span>
                      {isActive && <ChevronRight className="h-4 w-4 ml-auto" />}
                    </Button>
                  );
                })}
              </div>
            </div>
          </nav>
        </div>

        <div
          className="w-1 cursor-col-resize hover:bg-primary transition-colors"
          onMouseDown={handleMouseDown}
        />

        <main className="flex-1 flex flex-col overflow-hidden">
          {renderContent()}
        </main>
      </div>
    </div>
  );
};
