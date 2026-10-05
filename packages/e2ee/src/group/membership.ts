import { getSupabaseClient } from '@cinecraft/api';
import { advanceGroupEpoch } from './mls';
import { importPublicKey, encryptWithPublicKey } from '../e2ee';

/**
 * Rotates the group epoch key when a member joins or is evicted from a ProjectSpace or Room.
 */
export const rotateGroupEpochForMembershipChange = async (
  targetType: 'project_space' | 'room',
  groupId: string,
  currentEpoch: number = 1
): Promise<boolean> => {
  try {
    const supabase = getSupabaseClient();

    // 1. Advance to new epoch
    const newGroupState = await advanceGroupEpoch(targetType, groupId, currentEpoch);

    // 2. Fetch active member IDs
    let memberIds: string[] = [];
    if (targetType === 'project_space') {
      const { data: members } = await supabase
        .from('project_space_members')
        .select('user_id')
        .eq('project_space_id', groupId);
      memberIds = members?.map((m: any) => m.user_id) || [];
    } else {
      const { data: members } = await supabase
        .from('room_members')
        .select('user_id')
        .eq('room_id', groupId);
      memberIds = members?.map((m: any) => m.user_id) || [];
    }

    if (memberIds.length === 0) return true;

    // 3. Fetch public keys of remaining active members
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, public_key')
      .in('id', memberIds);

    // 4. Encrypt new epoch key for active members
    const insertRows = [];
    for (const p of (profiles || [])) {
      if (p.public_key) {
        try {
          const importedPub = await importPublicKey(p.public_key);
          const encryptedKey = await encryptWithPublicKey(newGroupState.epochKey, importedPub);
          insertRows.push({
            target_type: targetType,
            target_id: groupId,
            user_id: p.id,
            encrypted_symmetric_key: encryptedKey,
            epoch: newGroupState.epoch,
            updated_at: new Date().toISOString(),
          });
        } catch (e) {
          console.error(`[Membership Rotation] Key encryption failed for ${p.id}:`, e);
        }
      }
    }

    if (insertRows.length > 0) {
      await (supabase as any)
        .from('group_keys')
        .upsert(insertRows, { onConflict: 'target_type,target_id,user_id' });
    }

    return true;
  } catch (err) {
    console.error('[Membership Rotation Error]:', err);
    return false;
  }
};
