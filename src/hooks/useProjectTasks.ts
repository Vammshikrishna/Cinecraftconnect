import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

// ── Types ──────────────────────────────────────────────────────────────────

export interface ProjectTask {
  id: string;
  name: string;
  description: string | null;
  due_date: string | null;
  is_completed: boolean;
}

// ── Query factory ──────────────────────────────────────────────────────────

const TASKS_STALE_TIME = 1000 * 60 * 5; // 5 minutes

const fetchTasks = async (projectId: string): Promise<ProjectTask[]> => {
  const { data, error } = await supabase
    .from('tasks' as any)
    .select('*')
    .eq('project_space_id', projectId)
    .order('created_at', { ascending: true });

  if (error) throw error;

  return (data || []).map((item: any) => ({
    id: item.id,
    name: item.title || item.name || 'Untitled Task',
    description: item.description ?? null,
    due_date: item.due_date ?? null,
    is_completed:
      item.status === 'completed' ||
      item.status === 'done' ||
      item.is_completed === true,
  }));
};

// ── Hook ───────────────────────────────────────────────────────────────────

export const useProjectTasks = (projectId: string) => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const queryKey = ['project-tasks', projectId] as const;

  // ── Read ────────────────────────────────────────────────────────────────
  const query = useQuery({
    queryKey,
    queryFn: () => fetchTasks(projectId),
    staleTime: TASKS_STALE_TIME,
    enabled: Boolean(projectId),
  });

  // ── Realtime — in-memory patch (no REST re-fetch) ───────────────────────
  useEffect(() => {
    if (!projectId) return;

    const channel = supabase
      .channel(`project-tasks-rt:${projectId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tasks',
          filter: `project_space_id=eq.${projectId}`,
        },
        (payload: any) => {
          queryClient.setQueryData<ProjectTask[]>(queryKey, (prev = []) => {
            if (payload.eventType === 'INSERT') {
              const incoming = payload.new as any;
              const mapped: ProjectTask = {
                id: incoming.id,
                name: incoming.title || incoming.name || 'Untitled Task',
                description: incoming.description ?? null,
                due_date: incoming.due_date ?? null,
                is_completed:
                  incoming.status === 'completed' ||
                  incoming.status === 'done' ||
                  incoming.is_completed === true,
              };
              if (prev.some((t) => t.id === mapped.id)) return prev;
              return [...prev, mapped];
            }

            if (payload.eventType === 'UPDATE') {
              const updated = payload.new as any;
              return prev.map((t) =>
                t.id === updated.id
                  ? {
                      ...t,
                      name: updated.title || updated.name || t.name,
                      description: updated.description ?? t.description,
                      due_date: updated.due_date ?? t.due_date,
                      is_completed:
                        updated.status === 'completed' ||
                        updated.status === 'done' ||
                        updated.is_completed === true,
                    }
                  : t
              );
            }

            if (payload.eventType === 'DELETE') {
              const deletedId = payload.old?.id;
              return deletedId ? prev.filter((t) => t.id !== deletedId) : prev;
            }

            return prev;
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // queryKey is derived from projectId — listing projectId is sufficient
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, queryClient]);

  // ── Add task ────────────────────────────────────────────────────────────
  const addTask = useMutation({
    mutationFn: async (title: string) => {
      const { data, error } = await supabase
        .from('tasks' as any)
        .insert([
          {
            title,
            description: null,
            due_date: null,
            status: 'pending',
            project_space_id: projectId,
          },
        ])
        .select()
        .single();

      if (error) throw error;
      return data as any;
    },
    // Optimistic update — instantly append to the list
    onMutate: async (title) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<ProjectTask[]>(queryKey);

      const optimistic: ProjectTask = {
        id: `optimistic-${Date.now()}`,
        name: title,
        description: null,
        due_date: null,
        is_completed: false,
      };

      queryClient.setQueryData<ProjectTask[]>(queryKey, (prev = []) => [
        ...prev,
        optimistic,
      ]);

      return { previous };
    },
    onError: (_err, _title, context) => {
      if (context?.previous !== undefined) {
        queryClient.setQueryData(queryKey, context.previous);
      }
      toast({ title: 'Error', description: 'Could not add task', variant: 'destructive' });
    },
    onSuccess: () => {
      // Realtime will patch; invalidate as safety net
      queryClient.invalidateQueries({ queryKey });
      toast({ title: 'Task added', description: 'Your production task was saved.' });
    },
  });

  // ── Toggle completion ───────────────────────────────────────────────────
  const toggleTask = useMutation({
    mutationFn: async ({ id, currentStatus }: { id: string; currentStatus: boolean }) => {
      const { error } = await supabase
        .from('tasks' as any)
        .update({ status: currentStatus ? 'pending' : 'completed' })
        .eq('id', id);

      if (error) throw error;
      return { id, newStatus: !currentStatus };
    },
    onMutate: async ({ id, currentStatus }) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<ProjectTask[]>(queryKey);

      queryClient.setQueryData<ProjectTask[]>(queryKey, (prev = []) =>
        prev.map((t) => (t.id === id ? { ...t, is_completed: !currentStatus } : t))
      );

      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous !== undefined) {
        queryClient.setQueryData(queryKey, context.previous);
      }
      toast({ title: 'Error', description: 'Could not update task', variant: 'destructive' });
    },
  });

  return {
    tasks: query.data ?? [],
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error,
    addTask,
    toggleTask,
  };
};
