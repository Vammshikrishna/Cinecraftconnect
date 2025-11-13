// deno-lint-ignore-file
import { createClient } from "npm:@supabase/supabase-js@2.80.0";
import { corsHeaders } from "../../_shared/cors.ts";

const safeErrMessage = (e: unknown) => (e instanceof Error ? e.message : String(e));

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const auth = req.headers.get("Authorization");
    if (!auth) {
      return new Response(JSON.stringify({ error: "Authorization header is missing" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
    const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
      return new Response(JSON.stringify({ error: "Server misconfiguration" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create server-side Supabase client using SERVICE_ROLE for trusted DB access.
    // We will still verify the incoming bearer token via auth.getUser below.
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });

    // Optionally verify the incoming token belongs to a valid user
    const token = auth.replace("Bearer ", "").trim();
    if (!token) {
      return new Response(JSON.stringify({ error: "Invalid Authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const authRes = await supabase.auth.getUser(token);
    const authErr = (authRes as any).error ?? null;
    const user = (authRes as any).data?.user ?? null;
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const url = new URL(req.url);
    const roomId = url.searchParams.get("id");
    if (!roomId) {
      return new Response(JSON.stringify({ error: "Room ID is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Select only the columns you need to avoid exposing sensitive data
    const { data: room, error } = await supabase
      .from("discussion_rooms")
      .select(`
        id,
        name,
        description,
        created_at,
        profiles ( id, username, avatar_url )
      `)
      .eq("id", roomId)
      .single();

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ room }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Function error:", err);
    return new Response(JSON.stringify({ error: safeErrMessage(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});