import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Calendar, MapPin } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

interface Project {
  id: string;
  title: string;
  description?: string;
  status?: string;
  start_date?: string;
  end_date?: string;
  location?: string;
  genre?: string[];
  required_roles?: string[];
  created_at: string;
}

interface UserProjectsProps {
  userId?: string;
}

export const UserProjects = ({ userId }: UserProjectsProps) => {
  const { user } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const targetUserId = userId || user?.id;

  useEffect(() => {
    if (!targetUserId) return;

    const fetchProjects = async () => {
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .eq('creator_id', targetUserId)
        .order('created_at', { ascending: false });

      if (!error && data) {
        setProjects(data);
      }
      setLoading(false);
    };

    fetchProjects();

    // Real-time subscription
    const channel = supabase
      .channel('user-projects')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'projects',
          filter: `creator_id=eq.${targetUserId}`
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setProjects(prev => [payload.new as Project, ...prev]);
          } else if (payload.eventType === 'UPDATE') {
            setProjects(prev => prev.map(p => p.id === payload.new.id ? payload.new as Project : p));
          } else if (payload.eventType === 'DELETE') {
            setProjects(prev => prev.filter(p => p.id !== payload.old.id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [targetUserId]);

  if (loading) {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <Skeleton key={i} className="h-32 w-full" />
        ))}
      </div>
    );
  }

  if (projects.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        No projects yet
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {projects.map((project) => (
        <Card key={project.id}>
          <CardHeader>
            <div className="flex items-start justify-between">
              <CardTitle className="text-lg">{project.title}</CardTitle>
              {project.status && (
                <Badge variant="outline">{project.status}</Badge>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {project.description && (
              <p className="text-sm text-muted-foreground mb-3">{project.description}</p>
            )}
            <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
              {project.location && (
                <div className="flex items-center gap-1">
                  <MapPin className="h-4 w-4" />
                  {project.location}
                </div>
              )}
              {project.start_date && (
                <div className="flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  {new Date(project.start_date).toLocaleDateString()}
                </div>
              )}
            </div>
            {project.genre && project.genre.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-3">
                {project.genre.map((g, idx) => (
                  <Badge key={idx} variant="secondary" className="text-xs">
                    {g}
                  </Badge>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
};
