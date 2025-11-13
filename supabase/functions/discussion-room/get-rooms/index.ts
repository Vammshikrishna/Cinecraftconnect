// deno-lint-ignore-file
import { createClient } from "npm:@supabase/supabase-js@2.81.1";
import { corsHeaders } from "../../_shared/cors.ts";

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

    // Query A: public rooms (with members)
    const publicRes = await supabase
      .from("discussion_rooms")
      .select("*, room_members(user_id)")
      .eq("room_type", "public");

    if (publicRes.error) {
      return new Response(JSON.stringify({ error: publicRes.error.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Query B: private rooms where user is a member
    const privateRes = await supabase
      .from("discussion_rooms")
      .select("*, room_members(user_id)")
      .eq("room_type", "private")
      .in(
        "id",
        supabase
          .from("room_members")
          .select("room_id")
          .eq("user_id", user.id)
          .then(r => r.data?.map((m: any) => m.room_id) ?? [])
      );

    // Note: supabase-js does not allow nested promises in query builder.
    // So instead fetch room_ids separately:

    const memberRoomsRes = await supabase
      .from("room_members")
      .select("room_id")
      .eq("user_id", user.id);

    if (memberRoomsRes.error) {
      return new Response(JSON.stringify({ error: memberRoomsRes.error.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const memberRoomIds = (memberRoomsRes.data as any[] | null) ?? [];
    const roomIds = memberRoomIds.map(r => r.room_id);

    let privateRooms = { data: [], error: null as any };
    if (roomIds.length > 0) {
      privateRooms = await supabase
        .from("discussion_rooms")
        .select("*, room_members(user_id)")
        .in("id", roomIds)
        .eq("room_type", "private");
      if (privateRooms.error) {
        return new Response(JSON.stringify({ error: privateRooms.error.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const publicRooms = Array.isArray(publicRes.data) ? publicRes.data : [];
    const privateRoomsData = Array.isArray(privateRooms.data) ? privateRooms.data : [];

    // Merge and dedupe by id
    const combined = [...publicRooms, ...privateRoomsData];
    const dedupedMap = new Map<string, any>();
    for (const r of combined) {
      dedupedMap.set(String(r.id), r);
    }
    const result = Array.from(dedupedMap.values());

    return new Response(JSON.stringify(result), {
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