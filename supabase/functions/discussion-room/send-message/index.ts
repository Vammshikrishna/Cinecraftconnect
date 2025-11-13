import { serve } from "jsr:@std/http";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../../_shared/cors.ts";

const MAX_CONTENT_LENGTH = 10000;

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

    let body;
    try {
      body = await req.json();
    } catch (_error) {
      return new Response(
        JSON.stringify({ error: "Invalid JSON format." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { room_id, content } = body;

    if (!room_id || typeof room_id !== 'string') {
      return new Response(
        JSON.stringify({ error: "The 'room_id' field is required and must be a string." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const trimmedContent = content ? String(content).trim() : '';
    if (!trimmedContent) {
      return new Response(
        JSON.stringify({ error: "Message content cannot be empty." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (trimmedContent.length > MAX_CONTENT_LENGTH) {
      return new Response(
        JSON.stringify({ error: `Message content exceeds maximum length of ${MAX_CONTENT_LENGTH} characters.` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: auth } } }
    );

    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data, error } = await supabase
      .from('messages')
      .insert([{ room_id, content: trimmedContent, user_id: user.id }])
      .select();

    if (error) {
      console.error(`Error inserting message for room ${room_id}:`, error);
      return new Response(
        JSON.stringify({ error: 'Failed to send message.', details: error.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    if (!data || data.length === 0) {
        console.error(`Insert succeeded but no data returned for room ${room_id}`);
        return new Response(
            JSON.stringify({ error: 'Failed to create message, no data returned.' }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }

    const { error: updateError } = await supabase
      .from('discussion_rooms')
      .update({ last_activity_at: new Date().toISOString() })
      .eq('id', room_id);

    if (updateError) {
      console.error(`Failed to update last_activity_at for room ${room_id}:`, updateError.message);
    }

    return new Response(JSON.stringify(data[0]), {
      status: 201,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
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