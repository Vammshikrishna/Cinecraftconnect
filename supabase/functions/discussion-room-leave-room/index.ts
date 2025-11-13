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

    // Get room creator to prevent creator from leaving
    const roomRes = await supabase
      .from("discussion_rooms")
      .select("created_by")
      .eq("id", room_id)
      .single();

    if (roomRes.error) {
      // If no rows found, return 404; otherwise return the error message
      const msg = roomRes.error.message ?? "Failed to fetch room";
      // PostgREST returns 404-like messages for not found; best effort to detect
      const notFound = /No row/gi.test(msg) || /Not found/gi.test(msg);
      return new Response(JSON.stringify({ error: msg }), {
        status: notFound ? 404 : 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const room = roomRes.data as { created_by?: string };

    if (String(room.created_by) === String(user.id)) {
      return new Response(JSON.stringify({ error: "The creator of a room cannot leave it." }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Perform delete; use returning to know how many rows deleted
    const delRes = await supabase
      .from("room_members")
      .delete()
      .eq("room_id", room_id)
      .eq("user_id", user.id)
      .select();

    if (delRes.error) {
      return new Response(JSON.stringify({ error: delRes.error.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const deletedRows = Array.isArray(delRes.data) ? delRes.data.length : 0;
    if (deletedRows === 0) {
      // Membership did not exist
      return new Response(JSON.stringify({ error: "Membership not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ message: "Successfully left the room" }), {
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