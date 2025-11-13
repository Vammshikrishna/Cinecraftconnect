import { serve } from "jsr:@std/http";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const auth = req.headers.get("Authorization");
    if (!auth) {
      return new Response(
        JSON.stringify({ error: "Authorization header is missing" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 401 }
      );
    }

    const { name, description, room_type = 'public' } = await req.json();

    if (!name) {
      return new Response(JSON.stringify({ error: "Room name is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!['public', 'private'].includes(room_type)) {
        return new Response(JSON.stringify({ error: "Invalid room_type. Must be 'public' or 'private'." }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: auth } } }
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: userError?.message || 'User not authenticated' }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 401 }
      );
    }

    const { data: roomData, error: roomError } = await supabase
      .from('discussion_rooms')
      .insert({
        name,
        description,
        room_type,
        created_by: user.id,
      })
      .select()
      .single();

    if (roomError) {
      return new Response(JSON.stringify({ error: roomError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { error: memberError } = await supabase
      .from('room_members')
      .insert({
        room_id: roomData.id,
        user_id: user.id,
      });

    if (memberError) {
        console.error(`Failed to add creator as member for room ${roomData.id}:`, memberError.message);
        await supabase.from('discussion_rooms').delete().eq('id', roomData.id);
        return new Response(JSON.stringify({ error: 'Failed to create room: could not add creator as a member.' }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    const newRoomData = {
        ...roomData,
        room_members: [{ user_id: user.id }]
    };

    return new Response(JSON.stringify(newRoomData), {
      status: 201,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      },
    );
  }
});
