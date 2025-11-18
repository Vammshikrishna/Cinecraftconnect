
import { supabase } from '@/integrations/supabase/client';
import { useEffect, useState } from 'react';

export const useRealtimeData = <T extends { [key: string]: any }>(table: string, filterColumn: string, filterValue: string) => {
    const [data, setData] = useState<T[]>([]);
    const [error, setError] = useState<any>(null);

    useEffect(() => {
        if (!filterValue) {
            setData([]);
            return;
        }

        const fetchData = async () => {
            const { data, error } = await supabase
                .from(table)
                .select('*')
                .eq(filterColumn, filterValue);

            if (error) {
                console.error('Error fetching data:', error)
                setError(error);
            } else {
                setData(data as T[]);
            }
        };

        fetchData();

        const channel = supabase.channel(`${table}-${filterColumn}-${filterValue}`);

        const subscription = channel.on(
                'postgres_changes',
                { event: '*', schema: 'public', table, filter: `${filterColumn}=eq.${filterValue}` },
                (payload) => {
                    if (payload.eventType === 'INSERT') {
                        setData((currentData) => [payload.new as T, ...currentData]);
                    } else if (payload.eventType === 'UPDATE') {
                        setData((currentData) =>
                            currentData.map((item) =>
                                item.id === payload.new.id ? { ...item, ...payload.new } : item
                            )
                        );
                    } else if (payload.eventType === 'DELETE') {
                        setData((currentData) =>
                            currentData.filter((item) => item.id !== payload.old.id)
                        );
                    }
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [table, filterColumn, filterValue]);

    return { data, error };
};
