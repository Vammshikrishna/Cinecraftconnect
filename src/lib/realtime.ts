
import { supabase } from '@/integrations/supabase/client';
import { useEffect, useState } from 'react';

export const useRealtimeData = <T extends { [key: string]: any }>(table: string, roomId: string) => {
    const [data, setData] = useState<T[]>([]);
    const [error, setError] = useState<any>(null);

    useEffect(() => {
        const fetchData = async () => {
            const { data, error } = await supabase
                .from(table)
                .select('*')
                .eq('room_id', roomId);

            if (error) {
                setError(error);
            } else {
                setData(data as T[]);
            }
        };

        fetchData();

        const subscription = supabase
            .channel(`${table}:${roomId}`)
            .on('postgres_changes', { event: '*', schema: 'public', table, filter: `room_id=eq.${roomId}` }, (payload) => {
                if (payload.new) {
                    setData((currentData) => [...currentData, payload.new as T]);
                }
            })
            .subscribe();

        return () => {
            supabase.removeChannel(subscription);
        };
    }, [table, roomId]);

    return { data, error };
};
