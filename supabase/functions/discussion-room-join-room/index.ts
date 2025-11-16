// deno-lint-ignore-file
import { createClient } from "npm:@supabase/supabase-js@2.81.1";
import { corsHeaders } from "../_shared/cors.ts";

if (!Deno.env.get("SUPABASE_URL") || !Deno.env.get("SUPABASE_ANON_KEY")) {
  console.error("Missing SUPABASE_URL or SUPABASE_ANON_KEY environment variables");
}

Deno.serve(async (req: Request) => {
  const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const auth = req.headers.get("Authorization");
    if (!auth) {
      return new Response(JSON.stringify({ error: "Authorization header is missing" }), {
        headers: jsonHeaders,
        status: 401,
      });
    }

    const parts = auth.split(" ");
    if (parts.length !== 2 || parts[0] !== "Bearer") {
      return new Response(JSON.stringify({ error: "Invalid Authorization header format" }), {
        headers: jsonHeaders,
        status: 401,
      });
    }
    const token = parts[1];

    const body = await req.json().catch(() => ({}));
    const { room_id } = body as { room_id?: string };

    if (!room_id) {
      return new Response(JSON.stringify({ error: "Room ID is required" }), {
        status: 400,
        headers: jsonHeaders,
      });
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      return new Response(JSON.stringify({ error: "Server misconfiguration" }), {
        status: 500,
        headers: jsonHeaders,
      });
    }

    // Verify user via Supabase Auth REST endpoint
    const userResp = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!userResp.ok) {
      // If unauthorized or token invalid, return 401
      return new Response(JSON.stringify({ error: "User not authenticated" }), {
        status: 401,
        headers: jsonHeaders,
      });
    }

    const user = await userResp.json(); // shape: { id, email, ... }

    // Create a supabase client for DB operations (using anon key + Authorization header)
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    // Fetch room metadata
    const { data: room, error: roomError } = await supabase
      .from("discussion_rooms")
      .select("room_type, creator_id")
      .eq("id", room_id)
      .single();

    if (roomError) {
      return new Response(JSON.stringify({ error: roomError.message }), {
        status: 500,
        headers: jsonHeaders,
      });
    }

    if (!room) {
      return new Response(JSON.stringify({ error: "Room not found" }), {
        status: 404,
        headers: jsonHeaders,
      });
    }

    if (room.room_type === "private") {
      // Check for existing join request
      const { data: existingRequest, error: requestError } = await supabase
        .from("room_join_requests")
        .select("id")
        .eq("room_id", room_id)
        .eq("user_id", user.id)
        .maybeSingle();

      if (requestError) {
        return new Response(JSON.stringify({ error: requestError.message }), {
          status: 500,
          headers: jsonHeaders,
        });
      }

      if (existingRequest) {
        return new Response(JSON.stringify({ message: "Join request already sent" }), {
          status: 200,
          headers: jsonHeaders,
        });
      }

      // Create join request
      const { data: requestData, error: insertRequestError } = await supabase
        .from("room_join_requests")
        .insert({ room_id, user_id: user.id })
        .select()
        .single();

      if (insertRequestError) {
        return new Response(JSON.stringify({ error: insertRequestError.message }), {
          status: 500,
          headers: jsonHeaders,
        });
      }

      return new Response(JSON.stringify(requestData), {
        status: 202,
        headers: jsonHeaders,
      });
    } else {
      // Public room: add member directly if not present
      const existingRes = await supabase
        .from("room_members")
        .select("user_id")
        .eq("room_id", room_id)
        .eq("user_id", user.id)
        .maybeSingle();

      if (existingRes.error) {
        return new Response(JSON.stringify({ error: existingRes.error.message }), {
          status: 500,
          headers: jsonHeaders,
        });
      }

      if (existingRes.data) {
        return new Response(JSON.stringify({ message: "User is already a member of this room" }), {
          status: 200,
          headers: jsonHeaders,
        });
      }

      const insertRes = await supabase
        .from("room_members")
        .insert({ room_id, user_id: user.id })
        .select()
        .single();

      if (insertRes.error) {
        return new Response(JSON.stringify({ error: insertRes.error.message }), {
          status: 500,
          headers: jsonHeaders,
        });
      }

      return new Response(JSON.stringify(insertRes.data ?? {}), {
        status: 201,
        headers: jsonHeaders,
      });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});