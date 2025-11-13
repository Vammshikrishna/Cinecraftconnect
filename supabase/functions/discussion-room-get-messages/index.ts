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

    const url = new URL(req.url);
    const room_id = url.searchParams.get("room_id");
    const page = parseInt(url.searchParams.get("page") || "1", 10);
    const per_page = parseInt(url.searchParams.get("per_page") || "50", 10);
    const rangeStart = (page - 1) * per_page;
    const rangeEnd = page * per_page - 1;

    if (!room_id) {
        return new Response(JSON.stringify({ error: "room_id is required" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    const { data: room, error: roomError } = await supabase
      .from('discussion_rooms')
      .select('room_type, room_members(user_id)')
      .eq('id', room_id)
      .single();

    if (roomError) {
      return new Response(JSON.stringify({ error: 'Room not found' }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (room.room_type === 'private') {
      const isMember = room.room_members.some(member => member.user_id === user.id);
      if (!isMember) {
        return new Response(JSON.stringify({ error: 'You do not have permission to view messages in this room.' }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const { data, error, count } = await supabase
      .from('messages')
      .select('*, profiles(*)', { count: 'exact' })
      .eq('room_id', room_id)
      .order('created_at', { ascending: false })
      .range(rangeStart, rangeEnd);

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({
        data: data.reverse(), // Reverse to show newest messages at the bottom
        meta: {
          page,
          per_page,
          total_pages: Math.ceil((count || 0) / per_page),
          total_entries: count || 0,
        }
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      },
    );

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
