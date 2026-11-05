import { supabase } from '@/integrations/supabase/client';

/**
 * Trust & Risk Engine
 * Predicts and calculates trust scores for users, creators, and marketplace entities.
 */
export class TrustEngine {
  
  /**
   * Calculates the trust score for a user based on history, reports, and activity.
   */
  static async calculateUserTrust(userId: string): Promise<number> {
    let baseScore = 100;

    // 1. Check for valid reports (negative impact)
    const { count: reportCount } = await (supabase as any)
      .from('content_reports')
      .select('*', { count: 'exact', head: true })
      .eq('target_id', userId)
      .eq('status', 'resolved')
      .eq('resolution', 'violation_confirmed');
    
    if (reportCount) baseScore -= (reportCount * 10);

    // 2. Check for account age (positive impact)
    // profiles has no created_at column (the sign-up date lives in auth.users, which the browser cannot read), so asking for it
    // would make the whole query fail. The age bonus only applies when a row carries a created_at.
    const { data: profile } = await supabase.from('profiles').select('id, is_verified').eq('id', userId).single();
    if (profile) {
      const createdAt = (profile as any).created_at ? new Date((profile as any).created_at).getTime() : Date.now();
      const ageInDays = (Date.now() - createdAt) / (1000 * 60 * 60 * 24);
      baseScore += Math.min(20, Math.floor(ageInDays / 30) * 2); // +2 points per month, max 20
      
      if (profile.is_verified) baseScore += 25; // Massive boost for verified pros
    }

    // 3. Ensure bounds
    return Math.max(0, Math.min(150, baseScore));
  }

  /**
   * Identifies risk level for a transaction or listing.
   */
  static async evaluateRisk(_entityId: string, _type: 'listing' | 'job' | 'comment'): Promise<{
    score: number;
    level: 'low' | 'medium' | 'high' | 'critical';
    flags: string[];
  }> {
    // Placeholder for fraud detection logic
    // In production, this would use relationship graph analysis (IP/Device/Payment linking)
    return {
      score: 15,
      level: 'low',
      flags: []
    };
  }

  /**
   * Works out a user's trust score and returns it. It does NOT write it: profiles.trust_score is a protected column
   * (trigger protect_profile_privileged_columns, parts A / CZ resets any write from a signed-in client), so a direct
   * update would silently do nothing. Saving the score needs a server-side function; none exists yet.
   */
  static async syncTrustScore(userId: string) {
    return this.calculateUserTrust(userId);
  }
}
