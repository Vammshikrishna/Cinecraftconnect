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
  description: string | null;
  status: string | null;
  start_date: string | null;
  end_date: string | null;
  location: string | null;
  genre: string[] | null;
  required_roles: string[] | null;
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
      setLoading(true);
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .eq('creator_id', targetUserId)
        .order('created_at', { ascending: false });

      if (!error && data) {
        setProjects(data as Project[]);
      }
      setLoading(false);
    };

    fetchProjects();

    const channel = supabase
      .channel(`user-projects-${targetUserId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'projects',
          filter: `creator_id=eq.${targetUserId}`
        },
        () => {
          fetchProjects();
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
        {[...Array(2)].map((_, i) => (
            <Card key={i} className="bg-gray-900 border-gray-800 rounded-lg">
                <CardHeader className="p-4">
                    <Skeleton className="h-5 w-3/5" />
                </CardHeader>
                <CardContent className="p-4 -mt-4">
                    <Skeleton className="h-4 w-full mb-3" />
                    <Skeleton className="h-4 w-4/5" />
                </CardContent>
            </Card>
        ))}
      </div>
    );
  }

  if (projects.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        This user hasn't posted any projects yet.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {projects.map((project) => (
        <Card key={project.id} className="bg-gray-900 border-gray-800 rounded-lg">
          <CardHeader className="p-4">
            <div className="flex items-start justify-between">
              <CardTitle className="text-lg font-semibold">{project.title}</CardTitle>
              {project.status && (
                <Badge className="text-xs" variant="outline">{project.status}</Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="p-4 -mt-4">
            {project.description && (
              <p className="text-sm text-gray-400 mb-4">{project.description}</p>
            )}
            <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-gray-500">
              {project.location && (
                <div className="flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5" />
                  {project.location}
                </div>
              )}
              {project.start_date && (
                <div className="flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5" />
                  {new Date(project.start_date).toLocaleDateString()}
                </div>
              )}
            </div>
            {project.genre && project.genre.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-4">
                {project.genre.map((g, idx) => (
                  <Badge key={idx} variant="secondary" className="text-xs font-normal">
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
