import { serve } from "jsr:@std/http";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../../_shared/cors.ts";

serve(async (req) => {
  // Handle pre-flight OPTIONS request
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const auth = req.headers.get("Authorization");

    if (!auth) {
      return new Response(
        JSON.stringify({ error: "Authorization header is missing" }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 401,
        },
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: auth } } }
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: userError?.message || 'User not authenticated' }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 401
        }
      );
    }

    const { data, error } = await supabase
      .from('discussion_rooms')
      .select(`
        *,
        room_members ( user_id )
      `)
      .or(`room_type.eq.public,and(room_type.eq.private,room_members.user_id.eq.${user.id})`);

    if (error) {
      return new Response(
        JSON.stringify({ error: error.message }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 500
        }
      );
    }

    // The query above might return private rooms the user is not a member of (with an empty room_members list).
    // We filter them out here on the server.
    const filteredData = data ? data.filter(room => {
        if (room.room_type === 'public') {
            return true;
        }
        if (room.room_type === 'private' && room.room_members && room.room_members.length > 0) {
            return true;
        }
        return false;
    }) : [];

    return new Response(
      JSON.stringify(filteredData),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200
      }
    );

  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500
      }
    );
  }
});
