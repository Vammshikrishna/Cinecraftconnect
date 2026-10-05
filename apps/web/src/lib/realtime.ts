
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export const useRealtimeData = <T extends { id: any }>(
  tableName: string, 
  filterColumn: string, 
  filterValue: string
) => {
  const [data, setData] = useState<T[] | null>(null);
  const [error, setError] = useState<Error | null>(null);

  const fetchData = useCallback(async () => {
    const { data, error } = await supabase
      .from(tableName as any)
      .select('*')
      .eq(filterColumn, filterValue);

    if (error) {
      console.error(`Error fetching ${tableName}:`, error);
      setError(error);
    } else {
      setData(data as unknown as T[]);
    }
  }, [tableName, filterColumn, filterValue]);

  useEffect(() => {
    fetchData();

    const channel = supabase
      .channel(`realtime-${tableName}-${filterValue}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: tableName, filter: `${filterColumn}=eq.${filterValue}` },
        (payload: any) => {
          if (payload.eventType === 'INSERT') {
            const newItem = payload.new as T;
            setData((prev) => {
              if (!prev) return [newItem];
              if (prev.some((item) => item.id === newItem.id)) return prev;
              return [...prev, newItem];
            });
          } else if (payload.eventType === 'UPDATE') {
            const updatedItem = payload.new as T;
            setData((prev) => {
              if (!prev) return [updatedItem];
              return prev.map((item) => item.id === updatedItem.id ? { ...item, ...updatedItem } : item);
            });
          } else if (payload.eventType === 'DELETE') {
            const deletedId = payload.old?.id;
            if (deletedId) {
              setData((prev) => {
                if (!prev) return null;
                return prev.filter((item) => item.id !== deletedId);
              });
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [tableName, filterColumn, filterValue, fetchData]);

  return { data, error, setData };
};
