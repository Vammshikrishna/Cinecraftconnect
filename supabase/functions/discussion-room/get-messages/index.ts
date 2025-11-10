// deno-lint-ignore-file
import { serve } from "jsr:@std/http";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.80.0";
import { corsHeaders } from "../../_shared/cors.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return new Response(JSON.stringify({ error: "User not authenticated." }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (req.headers.get("content-type") !== "application/json") {
      return new Response(JSON.stringify({ error: "Content-Type must be application/json" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    let body;
    try {
      body = await req.json();
    } catch (error) {
      return new Response(JSON.stringify({ error: "Invalid JSON format" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { room_id } = body;

    if (!room_id || typeof room_id !== 'string') {
        return new Response(JSON.stringify({ error: "The 'room_id' field is required and must be a string." }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data, error: dbError } = await supabase // Renamed 'error' to 'dbError'
      .from('room_messages')
      .select('*')
      .eq('room_id', room_id)
      .order('created_at');

    if (dbError) { // Using the renamed variable
      return new Response(JSON.stringify({ error: dbError.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify(data), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});