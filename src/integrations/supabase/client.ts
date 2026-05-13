import { createClient } from '@supabase/supabase-js'
import { Database } from './database.types'
import { secureStorageEngine } from '@/lib/auth/secureStorage';

// Use environment variables for Supabase configuration.
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Log error if environment variables are not set
if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.error('❌ Supabase environment variables are missing! Ensure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set in your .env file.');
}

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
        storage: secureStorageEngine,
    },
    realtime: {
        params: {
            eventsPerSecond: 10,
        },
    },
    global: {
        headers: {
            'x-client-info': 'reel-sphere-connect',
        },
    },
});

// Suppress WebSocket connection errors in console
const originalError = console.error;
console.error = (...args: any[]) => {
    if (
        typeof args[0] === 'string' &&
        (args[0].includes('WebSocket connection') || args[0].includes('wss://'))
    ) {
        // Silently ignore WebSocket errors - they're logged in Supabase dashboard
        return;
    }
    originalError.apply(console, args);
};
