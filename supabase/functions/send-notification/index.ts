
import { serve } from "jsr:@std/http";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Define the Notification type for the function
interface NotificationPayload {
  user_id: string;
  trigger_user_id?: string;
  type: 'new_message' | 'new_follower' | 'project_invite' | 'system_announcement' | 'generic';
  title: string;
  message: string;
  action_url?: string; // Optional: can be constructed in the function
  priority?: 'high' | 'medium' | 'low';
}

serve(async (req) => {
  // 1. Validate the request
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  const payload: NotificationPayload = await req.json();

  // 2. Create a Supabase client with the service role key
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  // 3. Construct the notification object
  const notificationToInsert = {
    user_id: payload.user_id,
    trigger_user_id: payload.trigger_user_id,
    type: payload.type,
    title: payload.title,
    message: payload.message,
    action_url: payload.action_url || constructActionUrl(payload),
    priority: payload.priority || 'medium',
  };

  // 4. Insert the notification into the database
  const { error } = await supabase.from('notifications').insert(notificationToInsert);

  if (error) {
    console.error('Error inserting notification:', error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }

  return new Response(JSON.stringify({ success: true, message: 'Notification sent.' }), { status: 200, headers: { 'Content-Type': 'application/json' } });
});

// Helper to construct action URLs based on notification type
function constructActionUrl(payload: NotificationPayload): string | undefined {
    switch (payload.type) {
        case 'new_message':
            // Assumes trigger_user_id is the sender's ID
            return `/messages/${payload.trigger_user_id}`;
        case 'new_follower':
            // Assumes trigger_user_id is the follower's ID
            return `/profile/${payload.trigger_user_id}`;
        case 'project_invite':
            // This would likely need more info, e.g., project ID in the payload
            return payload.action_url || '/projects'; // Fallback
        case 'system_announcement':
             return payload.action_url || '/announcements';
        default:
            return '/';
    }
}
