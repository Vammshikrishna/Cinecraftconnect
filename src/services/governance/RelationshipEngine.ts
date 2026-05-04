import { supabase } from '@/integrations/supabase/client';

/**
 * Relationship Intelligence Engine
 * Maps connections between users, devices, IPs, and entities to detect coordinated abuse.
 */
export class RelationshipEngine {
  
  /**
   * Tracks a login or action event for relationship mapping.
   */
  static async trackEvent(userId: string, metadata: { ip: string; device_id: string }) {
    await (supabase as any).from('gov_entity_relationships').insert({
      user_id: userId,
      ip_address: metadata.ip,
      device_id: metadata.device_id,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Finds all users linked to the same IP or Device.
   */
  static async getLinkedAccounts(userId: string): Promise<string[]> {
    // 1. Get current user's identifiers
    const { data: identifiers } = await (supabase as any)
      .from('gov_entity_relationships')
      .select('ip_address, device_id')
      .eq('user_id', userId);
    
    if (!identifiers || identifiers.length === 0) return [];

    const ips = identifiers.map((i: any) => i.ip_address);
    const devices = identifiers.map((i: any) => i.device_id);

    // 2. Find other users sharing these identifiers
    const { data: linked } = await (supabase as any)
      .from('gov_entity_relationships')
      .select('user_id')
      .neq('user_id', userId)
      .or(`ip_address.in.(${ips.join(',')}),device_id.in.(${devices.join(',')})`);
    
    return Array.from(new Set(linked?.map((l: any) => l.user_id) || []));
  }

  /**
   * Detects if a user is part of a known abuse cluster.
   */
  static async detectClusterAbuse(userId: string): Promise<boolean> {
    const linkedIds = await this.getLinkedAccounts(userId);
    if (linkedIds.length === 0) return false;

    // Check if any linked accounts are banned
    const { count } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .in('id', linkedIds)
      .eq('is_banned', true);
    
    return (count || 0) > 0;
  }
}
