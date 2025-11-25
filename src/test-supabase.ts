import { supabase } from './integrations/supabase/client';

// Test Supabase connection
export const testSupabaseConnection = async () => {
    try {
        console.log('Testing Supabase connection...');
        const { data, error } = await supabase.auth.getSession();
        console.log('Supabase connection test:', { data, error });
        return { success: !error, data, error };
    } catch (err) {
        console.error('Supabase connection failed:', err);
        return { success: false, error: err };
    }
};

// Call this on app load
testSupabaseConnection();
