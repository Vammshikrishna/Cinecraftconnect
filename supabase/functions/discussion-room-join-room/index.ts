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
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 401,
        },
      );
    }

    const { room_id } = await req.json();

    if (!room_id) {
      return new Response(JSON.stringify({ error: "Room ID is required" }), {
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
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 401
        }
      );
    }

    // Check if the user is already a member of the room to avoid duplicate entries
    const { data: existingMember, error: existingMemberError } = await supabase
        .from('room_members')
        .select('user_id')
        .eq('room_id', room_id)
        .eq('user_id', user.id)
        .single();

    if (existingMemberError && existingMemberError.code !== 'PGRST116') { // 'PGRST116' means no rows found
        return new Response(JSON.stringify({ error: existingMemberError.message }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    if (existingMember) {
        return new Response(JSON.stringify({ message: "User is already a member of this room" }), {
            status: 200, // Or 200 if you want to indicate success without creation
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    // If not already a member, insert the new member
    const { data, error } = await supabase
      .from('room_members')
      .insert({ room_id, user_id: user.id })
      .select(); // Use .select() to get the inserted row back

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify(data ? data[0] : {}), {
      status: 201, // 201 for successful creation
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
