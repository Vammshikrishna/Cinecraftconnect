import { createClient } from '@supabase/supabase-js'
import { Database } from '@/types/supabase'

// Use environment variables for Supabase configuration. Fallback to local dev values if not set.
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "http://127.0.0.1:54321";
// This anon key matches the JWT secret: super-secret-jwt-token-with-at-least-32-characters-long
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";

// Log warning if environment variables are not set
if (!import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_ANON_KEY) {
    console.warn('⚠️ Supabase environment variables not set. Using local development values. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env.local for production.');
}

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY);
