import { supabase } from '@/integrations/supabase/client';

export const fetchJoinRequests = async (roomId: string) => {
  // First, fetch the join requests for the given room
  const { data: requests, error: requestsError } = await supabase
    .from('room_join_requests')
    .select('id, created_at, status, user_id')
    .eq('room_id', roomId)
    .eq('status', 'pending');

  if (requestsError) {
    throw new Error(`Failed to fetch join requests: ${requestsError.message}`);
  }

  if (!requests || requests.length === 0) {
    return [];
  }

  // Next, extract the user IDs from the requests
  const userIds = requests.map(req => req.user_id);

  // Then, fetch the profiles for those user IDs
  const { data: profiles, error: profilesError } = await supabase
    .from('profiles')
    .select('id, username, avatar_url')
    .in('id', userIds);

  if (profilesError) {
    throw new Error(`Failed to fetch profiles for join requests: ${profilesError.message}`);
  }

  // Create a map of profiles by user ID for easy lookup
  const profilesById = profiles.reduce((acc, profile) => {
    acc[profile.id] = profile;
    return acc;
  }, {} as { [key: string]: { id: string; username: string; avatar_url: string; } });

  // Finally, combine the requests with their corresponding profiles
  const data = requests.map(req => ({
    ...req,
    profiles: profilesById[req.user_id] || null
  }));

  return data;
};

export const approveJoinRequest = async (requestId: number, userId: string, roomId: string) => {
  // Add user to room_members table
  const { error: memberError } = await supabase.from('room_members').insert({ room_id: roomId, user_id: userId });
  if (memberError) {
    throw new Error(`Failed to add user to room: ${memberError.message}`);
  }

  // Delete the join request
  const { error: requestError } = await supabase.from('room_join_requests').delete().eq('id', requestId);
  if (requestError) {
    // Note: In a production app, you might want to handle the case where the user was added but the request wasn't deleted.
    // This could involve a transaction or a cleanup job.
    throw new Error(`Failed to remove join request: ${requestError.message}`);
  }

  return { success: true };
};

export const denyJoinRequest = async (requestId: number) => {
  const { error } = await supabase.from('room_join_requests').delete().eq('id', requestId);
  if (error) {
    throw new Error(`Failed to deny join request: ${error.message}`);
  }
  return { success: true };
};
