// deno-lint-ignore-file
import { createClient } from "npm:@supabase/supabase-js@2.81.1";
import { corsHeaders } from "../_shared/cors.ts";

if (!Deno.env.get("SUPABASE_URL") || !Deno.env.get("SUPABASE_ANON_KEY")) {
  console.error("Missing SUPABASE_URL or SUPABASE_ANON_KEY environment variables");
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const auth = req.headers.get("Authorization");
    if (!auth) {
      return new Response(JSON.stringify({ error: "Authorization header is missing" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 401,
      });
    }

    const body = await req.json().catch(() => ({}));
    const { room_id } = body as { room_id?: string };

    if (!room_id) {
      return new Response(JSON.stringify({ error: "Room ID is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      return new Response(JSON.stringify({ error: "Server misconfiguration" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: auth } },
    });

    const userRes = await supabase.auth.getUser();
    const user = (userRes.data as any)?.user ?? null;
    if (userRes.error || !user) {
      return new Response(JSON.stringify({ error: userRes.error?.message || "User not authenticated" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check existing membership with a safe query
    const existingRes = await supabase
      .from("room_members")
      .select("user_id")
      .eq("room_id", room_id)
      .eq("user_id", user.id)
      .maybeSingle(); // returns null data if not found without an error

    if (existingRes.error) {
      return new Response(JSON.stringify({ error: existingRes.error.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (existingRes.data) {
      return new Response(JSON.stringify({ message: "User is already a member of this room" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Insert new membership and return the created row
    const insertRes = await supabase
      .from("room_members")
      .insert({ room_id, user_id: user.id })
      .select()
      .single();

    if (insertRes.error) {
      return new Response(JSON.stringify({ error: insertRes.error.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify(insertRes.data ?? {}), {
      status: 201,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});