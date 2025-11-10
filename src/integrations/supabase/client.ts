import { createClient } from '@supabase/supabase-js'
import { Database } from './database.types.ts' // Corrected import

const SUPABASE_URL = "https://hfkubpcdbjxhafulxhfv.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhma3VicGNkYmp4aGFmdWx4aGZ2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDQxODc4MjgsImV4cCI6MjA1OTc2MzgyOH0.2UkrXH3VPWPn0Y5XcenE0O0rbWvTFr7UrUJPEaLmu34";

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
