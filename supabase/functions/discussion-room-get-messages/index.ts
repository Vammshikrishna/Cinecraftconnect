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

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      console.error("Missing SUPABASE_URL or SUPABASE_ANON_KEY");
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

    const url = new URL(req.url);
    const room_id = url.searchParams.get("room_id");
    const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10));
    const per_page = Math.max(1, parseInt(url.searchParams.get("per_page") || "50", 10));
    const rangeStart = (page - 1) * per_page;
    const rangeEnd = page * per_page - 1;

    if (!room_id) {
      return new Response(JSON.stringify({ error: "room_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const roomRes = await supabase
      .from("discussion_rooms")
      .select("room_type, room_members(user_id)")
      .eq("id", room_id)
      .single();

    if (roomRes.error) {
      // Distinguish not found vs other errors if needed
      return new Response(JSON.stringify({ error: roomRes.error.message || "Failed to fetch room" }), {
        status: roomRes.error.message?.toLowerCase().includes("null") ? 404 : 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const room = roomRes.data as { room_type: string; room_members?: { user_id: string }[] };

    if (room.room_type === "private") {
      const members = Array.isArray(room.room_members) ? room.room_members : [];
      const isMember = members.some((m) => String(m.user_id) === String(user.id));
      if (!isMember) {
        return new Response(
          JSON.stringify({ error: "You do not have permission to view messages in this room." }),
          {
            status: 403,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
    }

    const messagesRes = await supabase
      .from("messages")
      .select("*, profiles(*)", { count: "exact" })
      .eq("room_id", room_id)
      .order("created_at", { ascending: false })
      .range(rangeStart, rangeEnd);

    if (messagesRes.error) {
      return new Response(JSON.stringify({ error: messagesRes.error.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const messages = Array.isArray(messagesRes.data) ? messagesRes.data.slice() : [];
    // We ordered descending to get newest first from DB, then reverse to put newest at bottom (oldest first)
    messages.reverse();

    const totalCount = typeof messagesRes.count === "number" ? messagesRes.count : 0;

    return new Response(
      JSON.stringify({
        data: messages,
        meta: {
          page,
          per_page,
          total_pages: Math.max(1, Math.ceil(totalCount / per_page)),
          total_entries: totalCount,
        },
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});