import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

// ── Types ──────────────────────────────────────────────────────────────────

export interface BudgetItem {
  id: string;
  category: string;
  item_name: string;
  estimated_cost: number | null;
  actual_cost: number | null;
  notes: string | null;
}

export interface ScheduleItem {
  id: string;
  title: string;
  description: string | null;
  start_date: string;
  end_date: string | null;
  status: string | null;
  is_locked?: boolean;
  is_full_crew?: boolean;
  assignees?: { user_id: string }[];
}

export interface CrewAvailability {
  id: string;
  user_id: string;
  start_date: string;
  end_date: string;
  status: 'free' | 'tentative' | 'booked';
  notes?: string;
  source_type?: 'personal' | 'schedule';
  source_project_id?: string | null;
}

// ── Fetch helpers ──────────────────────────────────────────────────────────

const BUDGET_STALE_TIME = 1000 * 60 * 10; // 10 minutes

const fetchBudget = async (projectId: string): Promise<BudgetItem[]> => {
  const { data, error } = await supabase
    .from('budget_items' as any)
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return (data ?? []) as unknown as BudgetItem[];
};

const fetchSchedule = async (projectId: string): Promise<ScheduleItem[]> => {
  const { data, error } = await supabase
    .from('schedule_items' as any)
    .select('*, assignees:schedule_item_assignees(user_id)')
    .eq('project_id', projectId)
    .order('start_date', { ascending: true });

  if (error) throw error;
  return data as unknown as ScheduleItem[];
};

const fetchCrewAvailabilityForProject = async (projectId: string): Promise<CrewAvailability[]> => {
  // Get all members of the project
  const { data: members, error: membersError } = await supabase
    .from('project_space_members' as any)
    .select('user_id')
    .eq('project_space_id', projectId);
    
  if (membersError) return [];
  
  const userIds = members.map((m: any) => m.user_id);
  if (userIds.length === 0) return [];
  
  // Get availability for these members from the global view
  const { data, error } = await supabase
    .from('global_user_availability_view' as any)
    .select('*')
    .in('user_id', userIds);
    
  if (error) return [];
  return data as unknown as CrewAvailability[];
};

// ── Realtime helper ────────────────────────────────────────────────────────

function patchItems<T extends { id: string }>(
  prev: T[],
  payload: any
): T[] {
  if (payload.eventType === 'INSERT') {
    const item = payload.new as T;
    return prev.some((i) => i.id === item.id) ? prev : [...prev, item];
  }
  if (payload.eventType === 'UPDATE') {
    const updated = payload.new as T;
    return prev.map((i) => (i.id === updated.id ? { ...i, ...updated } : i));
  }
  if (payload.eventType === 'DELETE') {
    const deletedId = payload.old?.id;
    return deletedId ? prev.filter((i) => i.id !== deletedId) : prev;
  }
  return prev;
}

// ── Hook ───────────────────────────────────────────────────────────────────

export const useProjectBudget = (projectId: string) => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const budgetKey = ['project-budget', projectId] as const;
  const scheduleKey = ['project-schedule', projectId] as const;

  // ── Queries ─────────────────────────────────────────────────────────────
  const budgetQuery = useQuery({
    queryKey: budgetKey,
    queryFn: () => fetchBudget(projectId),
    staleTime: BUDGET_STALE_TIME,
    enabled: Boolean(projectId),
  });

  const scheduleQuery = useQuery({
    queryKey: scheduleKey,
    queryFn: () => fetchSchedule(projectId),
    staleTime: BUDGET_STALE_TIME,
    enabled: Boolean(projectId),
  });

  const availabilityQuery = useQuery({
    queryKey: ['crew-availability', projectId],
    queryFn: () => fetchCrewAvailabilityForProject(projectId),
    staleTime: BUDGET_STALE_TIME,
    enabled: Boolean(projectId),
  });

  // ── Realtime — in-memory patch (no REST re-fetch) ───────────────────────
  useEffect(() => {
    if (!projectId) return;

    const budgetChannel = supabase
      .channel(`project-budget-rt:${projectId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'budget_items', filter: `project_id=eq.${projectId}` },
        (payload: any) => {
          queryClient.setQueryData<BudgetItem[]>(budgetKey, (prev = []) =>
            patchItems(prev, payload)
          );
        }
      )
      .subscribe();

    const scheduleChannel = supabase
      .channel(`project-schedule-rt:${projectId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'schedule_items', filter: `project_id=eq.${projectId}` },
        (payload: any) => {
          queryClient.setQueryData<ScheduleItem[]>(scheduleKey, (prev = []) =>
            patchItems(prev, payload)
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(budgetChannel);
      supabase.removeChannel(scheduleChannel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, queryClient]);

  // ── Budget mutations ─────────────────────────────────────────────────────

  const addBudgetItem = useMutation({
    mutationFn: async (item: Omit<BudgetItem, 'id' | 'actual_cost' | 'notes'>) => {
      const { data, error } = await supabase
        .from('budget_items' as any)
        .insert([{ project_id: projectId, ...item, actual_cost: 0 }])
        .select()
        .single();
      if (error) throw error;
      return data as unknown as BudgetItem;
    },
    onMutate: async (item) => {
      await queryClient.cancelQueries({ queryKey: budgetKey });
      const previous = queryClient.getQueryData<BudgetItem[]>(budgetKey);
      const optimistic: BudgetItem = {
        id: `optimistic-${Date.now()}`,
        actual_cost: 0,
        notes: null,
        ...item,
      };
      queryClient.setQueryData<BudgetItem[]>(budgetKey, (prev = []) => [...prev, optimistic]);
      return { previous };
    },
    onError: (_err, _item, context) => {
      if (context?.previous !== undefined) queryClient.setQueryData(budgetKey, context.previous);
      toast({ title: 'Error', description: 'Could not add budget item', variant: 'destructive' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: budgetKey });
      toast({ title: 'Success', description: 'Budget allocation locked' });
    },
  });

  const updateBudgetItem = useMutation({
    mutationFn: async ({ id, ...patch }: Partial<BudgetItem> & { id: string }) => {
      const { error } = await supabase
        .from('budget_items' as any)
        .update(patch)
        .eq('id', id);
      if (error) throw error;
      return { id, ...patch };
    },
    onMutate: async (patch) => {
      await queryClient.cancelQueries({ queryKey: budgetKey });
      const previous = queryClient.getQueryData<BudgetItem[]>(budgetKey);
      queryClient.setQueryData<BudgetItem[]>(budgetKey, (prev = []) =>
        prev.map((i) => (i.id === patch.id ? { ...i, ...patch } : i))
      );
      return { previous };
    },
    onError: (_err, _patch, context) => {
      if (context?.previous !== undefined) queryClient.setQueryData(budgetKey, context.previous);
      toast({ title: 'Error', description: 'Could not update budget item', variant: 'destructive' });
    },
    onSuccess: () => toast({ title: 'Success', description: 'Budget item updated' }),
  });

  const deleteBudgetItem = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('budget_items' as any).delete().eq('id', id);
      if (error) throw error;
      return id;
    },
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: budgetKey });
      const previous = queryClient.getQueryData<BudgetItem[]>(budgetKey);
      queryClient.setQueryData<BudgetItem[]>(budgetKey, (prev = []) => prev.filter((i) => i.id !== id));
      return { previous };
    },
    onError: (_err, _id, context) => {
      if (context?.previous !== undefined) queryClient.setQueryData(budgetKey, context.previous);
      toast({ title: 'Error', description: 'Failed to delete item', variant: 'destructive' });
    },
    onSuccess: () => toast({ title: 'Success', description: 'Item deleted' }),
  });

  // ── Schedule mutations ───────────────────────────────────────────────────

  const addScheduleItem = useMutation({
    mutationFn: async (item: Omit<ScheduleItem, 'id' | 'assignees'> & { assignees?: string[] }) => {
      const { assignees, ...scheduleData } = item;
      
      const { data, error } = await supabase
        .from('schedule_items' as any)
        .insert([{ project_id: projectId, ...scheduleData }])
        .select()
        .single();
      if (error) throw error;
      
      if (assignees && assignees.length > 0) {
        const { error: assignError } = await supabase
          .from('schedule_item_assignees' as any)
          .insert(assignees.map(user_id => ({ schedule_item_id: (data as any).id, user_id })));
        if (assignError) throw assignError;
      }
      
      return { ...(data as any), assignees: assignees?.map(user_id => ({ user_id })) || [] } as unknown as ScheduleItem;
    },
    onMutate: async (item) => {
      await queryClient.cancelQueries({ queryKey: scheduleKey });
      const previous = queryClient.getQueryData<ScheduleItem[]>(scheduleKey);
      const optimistic: ScheduleItem = { 
        id: `optimistic-${Date.now()}`, 
        ...item, 
        assignees: item.assignees?.map(user_id => ({ user_id })) 
      } as unknown as ScheduleItem;
      queryClient.setQueryData<ScheduleItem[]>(scheduleKey, (prev = []) => [...prev, optimistic]);
      return { previous };
    },
    onError: (err: any, _item, context) => {
      if (context?.previous !== undefined) queryClient.setQueryData(scheduleKey, context.previous);
      toast({ title: 'Error', description: err.message || 'Could not add schedule item', variant: 'destructive' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: scheduleKey });
      toast({ title: 'Success', description: 'Schedule item added' });
    },
  });

  const updateScheduleItem = useMutation({
    mutationFn: async ({ id, assignees, ...patch }: Omit<Partial<ScheduleItem>, 'assignees'> & { id: string; assignees?: string[] }) => {
      const { error } = await supabase
        .from('schedule_items' as any)
        .update(patch)
        .eq('id', id);
      if (error) throw error;
      
      if (assignees !== undefined) {
        // Delete old
        await supabase.from('schedule_item_assignees' as any).delete().eq('schedule_item_id', id);
        // Insert new
        if (assignees.length > 0) {
           await supabase.from('schedule_item_assignees' as any).insert(
             assignees.map(user_id => ({ schedule_item_id: id, user_id }))
           );
        }
      }
      
      return { id, ...patch, assignees: assignees?.map(user_id => ({ user_id })) || [] };
    },
    onMutate: async (patch) => {
      await queryClient.cancelQueries({ queryKey: scheduleKey });
      const previous = queryClient.getQueryData<ScheduleItem[]>(scheduleKey);
      queryClient.setQueryData<ScheduleItem[]>(scheduleKey, (prev = []) =>
        prev.map((i) => (i.id === patch.id ? { 
          ...i, 
          ...patch, 
          assignees: patch.assignees ? patch.assignees.map(user_id => ({ user_id })) : i.assignees 
        } as unknown as ScheduleItem : i))
      );
      return { previous };
    },
    onError: (err: any, _patch, context) => {
      if (context?.previous !== undefined) queryClient.setQueryData(scheduleKey, context.previous);
      toast({ title: 'Error', description: err.message || 'Could not update schedule item', variant: 'destructive' });
    },
    onSuccess: () => toast({ title: 'Success', description: 'Schedule item updated' }),
  });

  const deleteScheduleItem = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('schedule_items' as any).delete().eq('id', id);
      if (error) throw error;
      return id;
    },
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: scheduleKey });
      const previous = queryClient.getQueryData<ScheduleItem[]>(scheduleKey);
      queryClient.setQueryData<ScheduleItem[]>(scheduleKey, (prev = []) => prev.filter((i) => i.id !== id));
      return { previous };
    },
    onError: (_err, _id, context) => {
      if (context?.previous !== undefined) queryClient.setQueryData(scheduleKey, context.previous);
      toast({ title: 'Error', description: 'Failed to delete schedule item', variant: 'destructive' });
    },
    onSuccess: () => toast({ title: 'Success', description: 'Item deleted' }),
  });

  return {
    budgetData: budgetQuery.data ?? [],
    scheduleData: scheduleQuery.data ?? [],
    crewAvailabilityData: availabilityQuery.data ?? [],
    isLoading: budgetQuery.isLoading || scheduleQuery.isLoading || availabilityQuery.isLoading,
    budgetError: budgetQuery.error,
    scheduleError: scheduleQuery.error,
    // Budget mutations
    addBudgetItem,
    updateBudgetItem,
    deleteBudgetItem,
    // Schedule mutations
    addScheduleItem,
    updateScheduleItem,
    deleteScheduleItem,
  };
};
