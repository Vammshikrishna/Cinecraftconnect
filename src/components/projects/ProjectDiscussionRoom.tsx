import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { 
  MessageCircle, 
  CheckSquare, 
  FileText, 
  Calendar,
  DollarSign,
  Sparkles,
  ChevronRight
} from 'lucide-react';
import { EnhancedChatInterface } from '@/components/discussions/EnhancedChatInterface';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

interface ProjectDiscussionRoomProps {
  projectId: string;
  projectTitle: string;
  projectDescription?: string;
}

type ActiveSection = 'chat' | 'tasks' | 'files' | 'schedule' | 'budget';

export const ProjectDiscussionRoom = ({ 
  projectId, 
  projectTitle,
  projectDescription = "A collaborative workspace for your production team"
}: ProjectDiscussionRoomProps) => {
  const { user } = useAuth();
  const [roomId, setRoomId] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<'creator' | 'admin' | 'moderator' | 'member'>('member');
  const [loading, setLoading] = useState(true);
  const [activeSection, setActiveSection] = useState<ActiveSection>('chat');

  useEffect(() => {
    fetchDiscussionRoom();
  }, [projectId, user]);

  const fetchDiscussionRoom = async () => {
    if (!user) return;

    try {
      // Get the discussion room for this project
      const { data: room } = await supabase
        .from('discussion_rooms')
        .select('id')
        .eq('project_id', projectId)
        .single();

      if (room) {
        setRoomId(room.id);

        // Get user's role in this room
        const { data: membership } = await supabase
          .from('room_members')
          .select('role')
          .eq('room_id', room.id)
          .eq('user_id', user.id)
          .single();

        if (membership) {
          setUserRole(membership.role as any);
        }
      }
    } catch (error) {
      console.error('Error fetching discussion room:', error);
    } finally {
      setLoading(false);
    }
  };

  const navItems = [
    { id: 'chat' as ActiveSection, label: 'Chat', icon: MessageCircle },
    { id: 'tasks' as ActiveSection, label: 'Tasks', icon: CheckSquare },
    { id: 'files' as ActiveSection, label: 'Files', icon: FileText },
    { id: 'schedule' as ActiveSection, label: 'Schedule', icon: Calendar },
    { id: 'budget' as ActiveSection, label: 'Budget', icon: DollarSign },
  ];

  const renderContent = () => {
    if (!roomId) return null;

    switch (activeSection) {
      case 'chat':
        return (
          <Card className="h-full">
            <EnhancedChatInterface roomId={roomId} userRole={userRole} />
          </Card>
        );
      case 'tasks':
        return (
          <Card className="p-8">
            <h3 className="text-xl font-semibold mb-4">Task Management</h3>
            <p className="text-muted-foreground">Create and manage production tasks, assign team members, and track progress.</p>
          </Card>
        );
      case 'files':
        return (
          <Card className="p-8">
            <h3 className="text-xl font-semibold mb-4">File Repository</h3>
            <p className="text-muted-foreground">Share scripts, storyboards, legal documents, and other project files.</p>
          </Card>
        );
      case 'schedule':
        return (
          <Card className="p-8">
            <h3 className="text-xl font-semibold mb-4">Production Schedule</h3>
            <p className="text-muted-foreground">Manage call sheets, shot lists, and production calendar.</p>
          </Card>
        );
      case 'budget':
        return (
          <Card className="p-8">
            <h3 className="text-xl font-semibold mb-4">Budget Tracker</h3>
            <p className="text-muted-foreground">Track expenses, manage budgets, and generate financial reports.</p>
          </Card>
        );
      default:
        return null;
    }
  };

  if (loading || !roomId) {
    return (
      <div className="flex items-center justify-center h-96">
        <p className="text-muted-foreground">Loading workspace...</p>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-12rem)] gap-0">
      {/* Sidebar */}
      <div className="w-80 bg-card border-r border-border flex flex-col">
        {/* Project Header */}
        <div className="p-6 border-b border-border">
          <h2 className="text-2xl font-bold mb-2">{projectTitle}</h2>
          <p className="text-sm text-muted-foreground">{projectDescription}</p>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4">
          <div className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeSection === item.id;
              
              return (
                <Button
                  key={item.id}
                  variant="ghost"
                  className={cn(
                    "w-full justify-start gap-3 h-11 px-4",
                    isActive && "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground"
                  )}
                  onClick={() => setActiveSection(item.id)}
                >
                  <Icon className="h-5 w-5" />
                  <span>{item.label}</span>
                  {isActive && <ChevronRight className="h-4 w-4 ml-auto" />}
                </Button>
              );
            })}
          </div>

          {/* AI Tools Section */}
          <div className="mt-8 pt-6 border-t border-border">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase mb-3 px-2">
              AI Tools
            </h3>
            <Button
              variant="ghost"
              className="w-full justify-start gap-3 h-11 px-4 text-accent-foreground"
            >
              <Sparkles className="h-5 w-5" />
              <span>Learning Assistant</span>
            </Button>
            <p className="text-xs text-muted-foreground px-4 mt-2">
              Ask questions about project skills.
            </p>
          </div>
        </nav>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 bg-background overflow-auto">
        <div className="h-full">
          {renderContent()}
        </div>
      </div>
    </div>
  );
};
