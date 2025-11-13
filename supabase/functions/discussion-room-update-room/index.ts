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
        status: 401,
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

    const url = new URL(req.url);
    const roomId = url.searchParams.get("id");
    if (!roomId) {
      return new Response(JSON.stringify({ error: "Room ID is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const contentType = req.headers.get("content-type") ?? "";
    if (!contentType.includes("application/json")) {
      return new Response(JSON.stringify({ error: "Content-Type must be application/json" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let body: any;
    try {
      body = await req.json();
    } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON format" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { name, description, room_type } = body ?? {};
    // Optionally validate fields (e.g., name length, room_type enum)
    if (name === undefined && description === undefined && room_type === undefined) {
      return new Response(JSON.stringify({ error: "No fields to update" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userRes = await supabase.auth.getUser();
    const user = (userRes.data as any)?.user ?? null;
    if (userRes.error || !user) {
      return new Response(JSON.stringify({ error: userRes.error?.message || "User not authenticated." }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Perform update, restricting to rows the authenticated user created
    const updateRes = await supabase
      .from("discussion_rooms")
      .update({ name, description, room_type })
      .eq("id", roomId)
      .eq("created_by", user.id)
      .select()
      .single();

    if (updateRes.error) {
      // Distinguish "not found / no permission" vs server errors if possible
      const msg = updateRes.error.message ?? "Failed to update room";
      const notFound = /No row/gi.test(msg) || /Not found/gi.test(msg) || /permission/gi.test(msg);
      return new Response(JSON.stringify({ error: msg }), {
        status: notFound ? 404 : 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify(updateRes.data ?? {}), {
      status: 200,
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