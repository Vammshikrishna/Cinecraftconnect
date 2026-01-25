import { createClient } from '@supabase/supabase-js'
import { Database } from './types'

// Use environment variables for Supabase configuration. Fallback to production values if not set.
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "https://zugtdutimulibaxwnlbs.supabase.co";
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp1Z3RkdXRpbXVsaWJheHdubGJzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU0NjA5MzQsImV4cCI6MjA4MTAzNjkzNH0.NRKEzG3QbbQ7r1R0kHVqS1YctfYUv7VbezcFZ3ti8ek";

// Log warning if environment variables are not set
if (!import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_ANON_KEY) {
    console.warn('⚠️ Supabase environment variables not set. Using local development values. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env.local for production.');
}

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
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
