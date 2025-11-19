
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
      .from(tableName)
      .select('*')
      .eq(filterColumn, filterValue);

    if (error) {
      console.error(`Error fetching ${tableName}:`, error);
      setError(error);
    } else {
      setData(data as T[]);
    }
  }, [tableName, filterColumn, filterValue]);

  useEffect(() => {
    fetchData();

    const channel = supabase
      .channel(`realtime-${tableName}-${filterValue}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: tableName, filter: `${filterColumn}=eq.${filterValue}` },
        (payload) => {
            console.log('Change received!', payload);
            fetchData(); // Refetch data on any change
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [tableName, filterColumn, filterValue, fetchData]);

  return { data, error, setData };
};
