import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { EnhancedSkeleton } from '@/components/ui/enhanced-skeleton';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { TeamManagementTab } from '@/components/projects/TeamManagementTab';

interface Project {
  id: string;
  title: string;
  description: string;
  creator_id: string;
}

const ProjectSpace = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [isOwner, setIsOwner] = useState(false);

  useEffect(() => {
    const fetchProject = async () => {
      if (!projectId) return;
      setLoading(true);
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .eq('id', projectId)
        .single();
      
      if (error) {
        console.error('Error fetching project:', error);
      } else {
        setProject(data);
        if (user && data && user.id === data.creator_id) {
          setIsOwner(true);
        }
      }
      setLoading(false);
    };

    fetchProject();
  }, [projectId, user]);

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8 mt-20">
        <EnhancedSkeleton className="h-12 w-1/3 mb-4" />
        <EnhancedSkeleton className="h-8 w-1/4 mb-8" />
        <div className="space-y-4">
          <EnhancedSkeleton className="h-10 w-full" />
          <EnhancedSkeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  if (!project) {
    return <div className="text-center py-12">Project not found.</div>;
  }

  return (
    <div className="container mx-auto px-4 py-8 mt-12">
      <Button variant="outline" onClick={() => navigate('/projects')} className="mb-6">
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back to Projects
      </Button>
      <div className="mb-8">
        <h1 className="text-4xl font-bold">{project.title}</h1>
        <p className="text-muted-foreground mt-2 max-w-3xl">{project.description}</p>
      </div>

      <Tabs defaultValue="team" className="w-full">
        <TabsList className="grid w-full grid-cols-5 bg-muted/50">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="tasks">Tasks</TabsTrigger>
          <TabsTrigger value="schedule">Schedule</TabsTrigger>
          <TabsTrigger value="team">Team</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="py-6">
          <h2 className="text-2xl font-semibold mb-4">Project Overview</h2>
          {/* More detailed overview components will go here */}
          <p>This is where a more detailed overview of the project will be displayed.</p>
        </TabsContent>
        <TabsContent value="tasks" className="py-6">
          <h2 className="text-2xl font-semibold mb-4">Task Management</h2>
          {/* Task board components will go here */}
          <p>A Kanban board or a list of tasks will be implemented here.</p>
        </TabsContent>
        <TabsContent value="schedule" className="py-6">
          <h2 className="text-2xl font-semibold mb-4">Production Schedule</h2>
          {/* Calendar/Gantt chart components will go here */}
          <p>A project timeline or calendar will be displayed here.</p>
        </TabsContent>
        <TabsContent value="team" className="py-6">
          {projectId && <TeamManagementTab projectId={projectId} isOwner={isOwner} />}
        </TabsContent>
        <TabsContent value="settings" className="py-6">
          <h2 className="text-2xl font-semibold mb-4">Project Settings</h2>
          {/* Settings form will go here */}
          <p>Here the project owner will be able to edit project details.</p>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ProjectSpace;
