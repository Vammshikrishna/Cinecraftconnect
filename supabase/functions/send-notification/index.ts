import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface NotificationPayload {
  user_id: string;
  trigger_user_id?: string;
  type: 'new_message' | 'new_follower' | 'project_invite' | 'system_announcement' | 'generic';
  title: string;
  message: string;
  action_url?: string;
  priority?: 'high' | 'medium' | 'low';
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405, headers: corsHeaders });
  }

  try {
    const payload: NotificationPayload = await req.json();

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const notificationToInsert = {
      user_id: payload.user_id,
      trigger_user_id: payload.trigger_user_id,
      type: payload.type,
      title: payload.title,
      message: payload.message,
      action_url: payload.action_url || constructActionUrl(payload),
      priority: payload.priority || 'medium',
    };

    const { error } = await supabase.from('notifications').insert(notificationToInsert);

    if (error) {
      console.error('Error inserting notification:', error);
      return new Response(JSON.stringify({ error: error.message }), { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    return new Response(JSON.stringify({ success: true, message: 'Notification sent.' }), { 
      status: 200, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('Error in send-notification:', message);
    return new Response(JSON.stringify({ error: message }), { 
      status: 500, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });
  }
});

function constructActionUrl(payload: NotificationPayload): string | undefined {
  switch (payload.type) {
    case 'new_message':
      return `/messages/${payload.trigger_user_id}`;
    case 'new_follower':
      return `/profile/${payload.trigger_user_id}`;
    case 'project_invite':
      return payload.action_url || '/projects';
    case 'system_announcement':
      return payload.action_url || '/announcements';
    default:
      return '/';
  }
}
