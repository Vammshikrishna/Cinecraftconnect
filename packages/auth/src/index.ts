import { getSupabaseClient, Session, User } from '@cinecraft/api';
import { Profile } from '@cinecraft/types';
import { LoginInput, RegisterInput, ProfileUpdateInput } from '@cinecraft/validation';
import { getSecureKeyStore } from '@cinecraft/storage';

export interface AuthState {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}

export class AuthService {
  static async getCurrentSession(): Promise<Session | null> {
    const supabase = getSupabaseClient();
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error || !session) return null;
    return session;
  }

  static async fetchProfile(userId: string): Promise<Profile | null> {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) {
      console.warn('[AuthService] Error fetching profile:', error.message);
      return null;
    }
    return data as Profile;
  }

  static async signIn(input: LoginInput) {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase.auth.signInWithPassword({
      email: input.email,
      password: input.password,
    });
    if (error) throw error;
    return data;
  }

  static async signUp(input: RegisterInput) {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase.auth.signUp({
      email: input.email,
      password: input.password,
      options: {
        data: {
          full_name: input.fullName,
          username: input.username,
          craft: input.craft || null,
        },
      },
    });
    if (error) throw error;
    return data;
  }

  static async signOut(): Promise<void> {
    const supabase = getSupabaseClient();
    await supabase.auth.signOut();
    // Clean local secure tokens if necessary
    try {
      await getSecureKeyStore().deleteKey('supabase_session');
    } catch {
      // Ignore
    }
  }

  static async updateProfile(userId: string, updates: ProfileUpdateInput): Promise<Profile> {
    const supabase = getSupabaseClient();
    const dbUpdates: any = {};
    if (updates.fullName !== undefined) dbUpdates.full_name = updates.fullName;
    if (updates.username !== undefined) dbUpdates.username = updates.username;
    if (updates.bio !== undefined) dbUpdates.bio = updates.bio;
    if (updates.craft !== undefined) dbUpdates.craft = updates.craft;
    if (updates.experience !== undefined) dbUpdates.experience = updates.experience;
    if (updates.location !== undefined) dbUpdates.location = updates.location;
    if (updates.website !== undefined) dbUpdates.website = updates.website;

    const { data, error } = await supabase
      .from('profiles')
      .update(dbUpdates)
      .eq('id', userId)
      .select()
      .single();

    if (error) throw error;
    return data as Profile;
  }
}
