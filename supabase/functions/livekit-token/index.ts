import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { AccessToken } from "https://esm.sh/livekit-server-sdk@2.1.2?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.8";
import { corsHeaders } from "../_shared/cors.ts";
import { handleRateLimit } from "../_shared/rateLimit.ts";

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // Warm-up from the app: start the function early, make no token, and do not count against the rate limit
  if (req.method === "POST") {
    const peek = await req.clone().json().catch(() => null);
    if (peek && peek.warm === true) {
      return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
  }

  // Apply rate limiting: Limit token generation to 30 calls per minute
  const rateLimit = await handleRateLimit(req, "livekit-token", 30, 60000);
  if (!rateLimit.allowed) {
    return rateLimit.response!;
  }

  try {
    // 1. Mandatory Supabase Authentication Check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "UNAUTHORIZED", message: "Missing or invalid authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const jwtToken = authHeader.replace("Bearer ", "").trim();
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error("Server configuration missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
      return new Response(
        JSON.stringify({ error: "SERVER_CONFIG_ERROR", message: "Authentication service misconfigured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Authenticate the user via Supabase Auth
    const authClient = createClient(supabaseUrl, supabaseAnonKey || supabaseServiceKey);
    const { data: userData, error: authError } = await authClient.auth.getUser(jwtToken);

    if (authError || !userData?.user) {
      return new Response(
        JSON.stringify({ error: "UNAUTHORIZED", message: "Invalid or expired authentication session" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const authenticatedUser = userData.user;
    const adminSupabase = createClient(supabaseUrl, supabaseServiceKey);

    // 2. Parse Request Parameters
    const reqBody = await req.json().catch(() => ({}));
    let { roomName, participantName, roomType, roomId, callId } = reqBody;

    if (!roomName) {
      return new Response(
        JSON.stringify({ error: "BAD_REQUEST", message: "Missing roomName parameter" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // The token is minted for roomName, so roomName decides what is checked. A roomType / roomId sent by the client
    // is no longer trusted on its own: it could point at a room the user belongs to while the token is for another room.
    // Formats: CineCraft_project_<projectId>_<suffix>, CineCraft_discussion_<roomId>_<suffix>, CineCraft_direct_<dmId>_<suffix>
    const nameMatch = String(roomName).match(/^CineCraft_(project|discussion|direct)_([a-zA-Z0-9-]+)/);
    // What verify_call_room_membership is asked about: the whole room name (it strips the prefix itself and, for
    // direct rooms, reads every id in it).
    let verifyRoomId: string = roomName;
    {
      if (nameMatch) {
        roomType = nameMatch[1];
        roomId = nameMatch[2];
      } else {
        // A plain id with no CineCraft_ prefix (older join path). It must be the room itself.
        if (roomId && roomId !== roomName) {
          return new Response(
            JSON.stringify({ error: "BAD_REQUEST", message: "roomId must match roomName" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        roomId = roomName;
        // Treating it as a direct chat made every discussion or project call fail the membership check,
        // so work out what it really is.
        if (!roomType) {
          const { data: byName } = await adminSupabase
            .from("calls").select("room_type").eq("daily_room_name", roomName).limit(1).maybeSingle();
          if (byName?.room_type) {
            roomType = byName.room_type;
          } else if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(roomId)) {
            const { data: dr } = await adminSupabase.from("discussion_rooms").select("id").eq("id", roomId).maybeSingle();
            if (dr) {
              roomType = "discussion";
            } else {
              const { data: ps } = await adminSupabase.from("project_spaces").select("id").or(`id.eq.${roomId},project_id.eq.${roomId}`).limit(1).maybeSingle();
              const { data: pj } = ps ? { data: null } : await adminSupabase.from("projects").select("id").eq("id", roomId).maybeSingle();
              roomType = ps || pj ? "project" : "direct";
            }
          } else {
            roomType = "direct";
          }
        }
      }
    }

    // 3. Server-Side Membership & Access Authorization Check
    // The profile picture lookup does not depend on the access check, so both run at the same time.
    // (a query builder only sends its request when awaited, so wrap it to start now)
    const avatarLookup = Promise.resolve(adminSupabase.from("profiles").select("avatar_url").eq("id", authenticatedUser.id).maybeSingle());
    if (!["project", "discussion", "direct"].includes(String(roomType))) {
      return new Response(
        JSON.stringify({ error: "BAD_REQUEST", message: "Unknown room type" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const { data: isAuthorized, error: authRpcErr } = await adminSupabase.rpc(
      "verify_call_room_membership",
      {
        p_user_id: authenticatedUser.id,
        p_room_type: roomType,
        p_room_id: verifyRoomId,
      }
    );

    if (authRpcErr) {
      console.warn("verify_call_room_membership RPC notice:", authRpcErr);
    }

    // Anything other than a clear "yes" (including an error) refuses the token.
    if (isAuthorized !== true) {
      console.warn(`[livekit-token] Unauthorized access attempt by ${authenticatedUser.id} for ${roomType} ${roomId}`);
      return new Response(
        JSON.stringify({
          error: "FORBIDDEN",
          message: "You are not an authorized member of this project, discussion room, or direct conversation",
        }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 4. Validate Call Status (Prevent Joining Cancelled / Expired / Ended Calls)
    const { data: callState, error: stateErr } = await adminSupabase.rpc(
      "reconcile_call_state",
      {
        p_call_id: callId || null,
        p_room_type: roomType,
        p_room_id: roomId,
        p_connection_id: roomName,
      }
    );

    if (!stateErr && callState?.is_valid) {
      const inactiveStatuses = ["ended", "cancelled", "declined", "expired", "failed"];
      if (inactiveStatuses.includes(callState.status)) {
        console.warn(`[livekit-token] Rejected join attempt for inactive call ${callState.call_id} (status: ${callState.status})`);
        return new Response(
          JSON.stringify({
            error: "CALL_INACTIVE",
            status: callState.status,
            message: `This call has already ${callState.status} and cannot be joined.`,
          }),
          { status: 410, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // 4b. Audio spaces: decide this user's role from the database (never from the client) and grant accordingly.
    //     Normal calls are unchanged: everyone can publish and subscribe.
    let space: { mode: string; speakingMode: string; role: string; callId: string } | null = null;
    const { data: callRow } = await adminSupabase
      .from("calls")
      .select("id, call_mode, speaking_mode, started_by, status")
      .eq("daily_room_name", roomName)
      .in("status", ["active", "ringing", "initiating"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (callRow?.call_mode === "audio_space") {
      const { data: partRow } = await adminSupabase
        .from("call_participants")
        .select("role, status")
        .eq("call_id", callRow.id)
        .eq("user_id", authenticatedUser.id)
        .maybeSingle();

      // Someone the host removed from this space cannot get a new token for it.
      if (partRow?.status === "removed") {
        return new Response(
          JSON.stringify({ error: "REMOVED", message: "The host removed you from this space." }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      let role: string = callRow.started_by === authenticatedUser.id ? "host" : partRow?.role || "listener";
      if (!partRow) {
        await adminSupabase.from("call_participants").upsert(
          { call_id: callRow.id, user_id: authenticatedUser.id, status: "joined", joined_at: new Date().toISOString(), role },
          { onConflict: "call_id,user_id" },
        );
      }
      space = { mode: "audio_space", speakingMode: callRow.speaking_mode, role, callId: callRow.id };
    }

    // 5. Mint Secure LiveKit JWT with Strict Identity
    const apiKey = Deno.env.get("LIVEKIT_API_KEY");
    const apiSecret = Deno.env.get("LIVEKIT_API_SECRET");

    if (!apiKey || !apiSecret) {
      console.error("LIVEKIT_API_KEY or LIVEKIT_API_SECRET is not set");
      return new Response(
        JSON.stringify({ error: "SERVER_CONFIG_ERROR", message: "LiveKit server keys missing" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // The profile picture travels with the participant (LiveKit metadata) so every client can show it instantly,
    // instead of each one having to look it up in the database (which was slow and could silently fail under RLS).
    const { data: avatarRow } = await avatarLookup;
    const avatarUrl: string | undefined = avatarRow?.avatar_url || undefined;

    // Identity is strictly bound to the authenticated user ID
    const at = new AccessToken(apiKey, apiSecret, {
      identity: authenticatedUser.id,
      name: participantName || authenticatedUser.user_metadata?.full_name || authenticatedUser.email?.split("@")[0] || "Member",
    });

    if (space) {
      const onStage = ["host", "cohost", "speaker"].includes(space.role);
      // Open-mic spaces let everyone unmute; request-mode spaces only let people on stage publish audio.
      const canSpeak = onStage || space.speakingMode === "open";
      at.metadata = JSON.stringify({ role: space.role, avatar: avatarUrl });
      at.addGrant({
        roomJoin: true,
        room: roomName,
        canPublish: canSpeak,
        canSubscribe: true,
        // Data channel carries reactions; listeners need it. They can also set their own attributes (raised hand).
        canPublishData: true,
        canUpdateOwnMetadata: true,
        // Audio spaces are voice only: even speakers may not publish camera or screen share.
        // LiveKit TrackSource.MICROPHONE = 2. The SDK converts the enum to its JWT string itself and throws on a raw string.
        canPublishSources: [2] as any,
      });
    } else {
      at.metadata = JSON.stringify({ avatar: avatarUrl });
      at.addGrant({
        roomJoin: true,
        room: roomName,
        canPublish: true,
        canSubscribe: true,
        canPublishData: true,
      });
    }

    const token = await at.toJwt();

    return new Response(
      JSON.stringify({
        token,
        userId: authenticatedUser.id,
        roomName,
        space,
      }),
      {
        headers: { ...corsHeaders, ...rateLimit.headers, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (err: any) {
    console.error("Error generating LiveKit token:", err);
    return new Response(
      JSON.stringify({ error: "INTERNAL_ERROR", message: err.message }),
      {
        headers: { ...corsHeaders, ...rateLimit.headers, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
