import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Database } from '@cinecraft/types';
import { getStorageService } from '@cinecraft/storage';

export type CleanDatabase = Omit<Database, '__InternalSupabase'>;

let clientInstance: SupabaseClient<CleanDatabase> | null = null;

export const initializeSupabase = (
  supabaseUrl: string,
  supabaseAnonKey: string,
  options?: {
    customStorage?: any;
    detectSessionInUrl?: boolean;
  }
): SupabaseClient<CleanDatabase> => {
  const storageEngine = options?.customStorage || {
    getItem: async (key: string) => getStorageService().getItem(key),
    setItem: async (key: string, value: string) => getStorageService().setItem(key, value),
    removeItem: async (key: string) => getStorageService().removeItem(key),
  };

  clientInstance = createClient<CleanDatabase>(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: options?.detectSessionInUrl ?? true,
      storage: storageEngine,
    },
    realtime: {
      params: {
        eventsPerSecond: 10,
      },
    },
    global: {
      headers: {
        'x-client-info': 'cinecraft-connect',
      },
    },
  });

  (globalThis as any).supabase = clientInstance;
  return clientInstance;
};

export const getSupabaseClient = (): SupabaseClient<CleanDatabase> => {
  if (!clientInstance) {
    const globalSupabase = (globalThis as any).supabase;
    if (globalSupabase) {
      clientInstance = globalSupabase;
      return clientInstance as SupabaseClient<CleanDatabase>;
    }
    throw new Error('Supabase client has not been initialized. Call initializeSupabase first.');
  }
  return clientInstance as SupabaseClient<CleanDatabase>;
};

export * from '@supabase/supabase-js';
