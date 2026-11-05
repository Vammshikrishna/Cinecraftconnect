import { supabase } from '@/integrations/supabase/client';

export const fetchJoinRequests = async (roomId: string) => {
  // First, fetch the join requests for the given room
  const { data: requests, error: requestsError } = await supabase
    .from('room_join_requests' as any)
    .select('id, created_at, status, user_id, message')
    .eq('room_id', roomId)
    .eq('status', 'pending');

  if (requestsError) {
    throw new Error(`Failed to fetch join requests: ${requestsError.message}`);
  }

  if (!requests || requests.length === 0) {
    return [];
  }

  // Next, extract the user IDs from the requests
  const userIds = (requests as any[]).map(req => req.user_id);

  // Then, fetch the profiles for those user IDs
  const { data: profiles, error: profilesError } = await supabase
    .from('profiles')
    .select('id, username, avatar_url')
    .in('id', userIds);

  if (profilesError) {
    throw new Error(`Failed to fetch profiles for join requests: ${profilesError.message}`);
  }

  // Create a map of profiles by user ID for easy lookup
  const profilesById = (profiles as any[]).reduce((acc, profile) => {
    acc[profile.id] = {
      id: profile.id,
      username: profile.username || '',
      avatar_url: profile.avatar_url || '',
    };
    return acc;
  }, {} as { [key: string]: { id: string; username: string; avatar_url: string; } });

  // Finally, combine the requests with their corresponding profiles
  const data = (requests as any[]).map(req => ({
    ...req,
    profiles: profilesById[req.user_id] || null
  }));

  return data;
};

/**
 * Approve: add the person to the room, then mark the request "approved" (the row stays as history and a database trigger tells the
 * requester). Deny: mark it "rejected" (the person may ask again later). Ids are uuids.
 */
export const approveJoinRequest = async (requestId: string | number, userId: string, roomId: string) => {
  const { error: memberError } = await supabase.from('room_members').insert({ room_id: roomId, user_id: userId });
  // 23505: they are already in the room (for example added by hand meanwhile): still close the request
  if (memberError && (memberError as any).code !== '23505') {
    throw new Error(`Failed to add user to room: ${memberError.message}`);
  }

  const { error: requestError } = await supabase.from('room_join_requests' as any).update({ status: 'approved' }).eq('id', requestId as any);
  if (requestError) {
    throw new Error(`The person was added, but the request could not be closed: ${requestError.message}`);
  }

  return { success: true };
};

export const denyJoinRequest = async (requestId: string | number) => {
  const { error } = await supabase.from('room_join_requests' as any).update({ status: 'rejected' }).eq('id', requestId as any);
  if (error) {
    throw new Error(`Failed to deny join request: ${error.message}`);
  }
  return { success: true };
};
