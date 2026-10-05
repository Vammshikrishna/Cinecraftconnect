/**
 * CineCraft Connect Mobile Environment Configuration
 *
 * React Native bare builds have no access to VITE_ / EXPO_PUBLIC_ variables at runtime, so release builds read their
 * values from ./env.secrets.ts. That file is gitignored (copy env.secrets.example.ts and fill it in); nothing real
 * is committed to the repository.
 */
import { SECRETS } from './env.secrets';

export const ENV = {
  SUPABASE_URL: process.env.VITE_SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL || SECRETS.SUPABASE_URL,
  SUPABASE_ANON_KEY: process.env.VITE_SUPABASE_ANON_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || SECRETS.SUPABASE_ANON_KEY,
  LIVEKIT_URL: process.env.VITE_LIVEKIT_URL || process.env.EXPO_PUBLIC_LIVEKIT_URL || SECRETS.LIVEKIT_URL,
  TMDB_API_KEY: process.env.VITE_TMDB_API_KEY || process.env.EXPO_PUBLIC_TMDB_API_KEY || SECRETS.TMDB_API_KEY,
  GOOGLE_WEB_CLIENT_ID: process.env.VITE_GOOGLE_WEB_CLIENT_ID || process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || SECRETS.GOOGLE_WEB_CLIENT_ID,
};
