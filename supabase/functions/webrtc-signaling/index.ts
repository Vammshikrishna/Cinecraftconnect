import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SignalingMessage {
  type: 'offer' | 'answer' | 'ice-candidate' | 'join-room' | 'leave-room';
  roomId: string;
  userId: string;
  payload: any;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { type, roomId, userId, payload }: SignalingMessage = await req.json();

    // Verify user is a member of the room
    const { data: membership } = await supabase
      .from('room_members')
      .select('id')
      .eq('room_id', roomId)
      .eq('user_id', userId)
      .single();

    if (!membership) {
      return new Response(
        JSON.stringify({ error: 'Not authorized to access this room' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Handle different signaling message types
    switch (type) {
      case 'join-room':
        // Store signaling data in a temporary table or broadcast via realtime
        await supabase
          .from('room_messages')
          .insert({
            room_id: roomId,
            user_id: userId,
            content: `User joined the call`,
            message_type: 'system',
            priority: 'normal',
            visibility_role: 'all'
          });
        break;

      case 'offer':
      case 'answer':
      case 'ice-candidate':
        // In production, you'd use a proper WebRTC signaling server
        // For now, we'll use realtime channels to relay signaling data
        // This is a simplified implementation
        console.log(`Relaying ${type} for room ${roomId} from user ${userId}`);
        break;

      case 'leave-room':
        await supabase
          .from('room_messages')
          .insert({
            room_id: roomId,
            user_id: userId,
            content: `User left the call`,
            message_type: 'system',
            priority: 'normal',
            visibility_role: 'all'
          });
        break;
    }

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});