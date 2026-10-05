import { createClient } from '@supabase/supabase-js'
import { Database } from './database.types'
import { secureStorageEngine } from '@/lib/auth/secureStorage';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL?.trim() || '';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim() || '';

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.warn('⚠️ Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. Please provide them in your .env file.');
}

type CleanDatabase = Omit<Database, '__InternalSupabase'>;

export const supabase = createClient<CleanDatabase>(SUPABASE_URL, SUPABASE_ANON_KEY, {
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
        return;
    }
    originalError.apply(console, args);
};
