import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

// ── Types ──────────────────────────────────────────────────────────────────

export interface CallSheetEntry {
  id: string;
  date: string;
  call_time: string | null;
  location: string | null;
  director: string | null;
  director_phone: string | null;
  producer: string | null;
  producer_phone: string | null;
  notes: string | null;
  created_at: string;
}

export interface NewCallSheet {
  date: string;
  call_time?: string | null;
  location?: string | null;
  director?: string | null;
  director_phone?: string | null;
  producer?: string | null;
  producer_phone?: string | null;
  notes?: string | null;
}

// ── Fetch helper ───────────────────────────────────────────────────────────

const CALL_SHEETS_STALE_TIME = 1000 * 60 * 10; // 10 minutes

const fetchCallSheets = async (projectId: string): Promise<CallSheetEntry[]> => {
  const { data, error } = await supabase
    .from('call_sheets' as any)
    .select('*')
    .eq('project_id', projectId)
    .order('date', { ascending: false });

  if (error) throw error;
  return (data ?? []) as unknown as CallSheetEntry[];
};

// ── Hook ───────────────────────────────────────────────────────────────────

export const useProjectCallSheets = (projectId: string) => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const queryKey = ['project-call-sheets', projectId] as const;

  // ── Read ────────────────────────────────────────────────────────────────
  const query = useQuery({
    queryKey,
    queryFn: () => fetchCallSheets(projectId),
    staleTime: CALL_SHEETS_STALE_TIME,
    enabled: Boolean(projectId),
  });

  // ── Realtime — in-memory patch (no REST re-fetch) ───────────────────────
  useEffect(() => {
    if (!projectId) return;

    const channel = supabase
      .channel(`project-call-sheets-rt:${projectId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'call_sheets',
          filter: `project_id=eq.${projectId}`,
        },
        (payload: any) => {
          queryClient.setQueryData<CallSheetEntry[]>(queryKey, (prev = []) => {
            if (payload.eventType === 'INSERT') {
              const entry = payload.new as CallSheetEntry;
              if (prev.some((s) => s.id === entry.id)) return prev;
              // Maintain descending date order
              return [entry, ...prev];
            }
            if (payload.eventType === 'UPDATE') {
              const updated = payload.new as CallSheetEntry;
              return prev.map((s) => (s.id === updated.id ? { ...s, ...updated } : s));
            }
            if (payload.eventType === 'DELETE') {
              const deletedId = payload.old?.id;
              return deletedId ? prev.filter((s) => s.id !== deletedId) : prev;
            }
            return prev;
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, queryClient]);

  // ── Create call sheet ───────────────────────────────────────────────────
  const createCallSheet = useMutation({
    mutationFn: async (sheet: NewCallSheet) => {
      const { data, error } = await supabase
        .from('call_sheets' as any)
        .insert([{ project_id: projectId, ...sheet }])
        .select()
        .single();

      if (error) throw error;
      return data as unknown as CallSheetEntry;
    },
    onMutate: async (sheet) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<CallSheetEntry[]>(queryKey);

      const optimistic: CallSheetEntry = {
        id: `optimistic-${Date.now()}`,
        created_at: new Date().toISOString(),
        call_time: null,
        location: null,
        director: null,
        director_phone: null,
        producer: null,
        producer_phone: null,
        notes: null,
        ...sheet,
      };

      queryClient.setQueryData<CallSheetEntry[]>(queryKey, (prev = []) => [
        optimistic,
        ...prev,
      ]);

      return { previous };
    },
    onError: (_err, _sheet, context) => {
      if (context?.previous !== undefined) queryClient.setQueryData(queryKey, context.previous);
      toast({ title: 'Error', description: 'Could not create call sheet', variant: 'destructive' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast({ title: 'Success', description: 'Call sheet created' });
    },
  });

  // ── Delete call sheet ───────────────────────────────────────────────────
  const deleteCallSheet = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('call_sheets' as any)
        .delete()
        .eq('id', id);

      if (error) throw error;
      return id;
    },
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<CallSheetEntry[]>(queryKey);
      queryClient.setQueryData<CallSheetEntry[]>(queryKey, (prev = []) =>
        prev.filter((s) => s.id !== id)
      );
      return { previous };
    },
    onError: (_err, _id, context) => {
      if (context?.previous !== undefined) queryClient.setQueryData(queryKey, context.previous);
      toast({ title: 'Error', description: 'Failed to delete call sheet', variant: 'destructive' });
    },
    onSuccess: () => toast({ title: 'Success', description: 'Call sheet deleted' }),
  });

  return {
    callSheets: query.data ?? [],
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error,
    createCallSheet,
    deleteCallSheet,
  };
};
