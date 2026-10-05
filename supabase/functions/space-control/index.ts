// Host / co-host controls for audio spaces: invite to speak, move to listeners, mute, remove, change the speaking
// mode (open mic vs request-to-speak) and end the space.
//
// Permissions are enforced on the LiveKit server (updateParticipant), not just hidden in the UI, so a listener who
// has not been invited cannot publish audio however the client is modified.
//
// Required secrets: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, LIVEKIT_API_KEY, LIVEKIT_API_SECRET and LIVEKIT_URL
// (the project's LiveKit URL, e.g. https://xxxx.livekit.cloud — a wss:// URL is converted automatically).
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { RoomServiceClient } from "https://esm.sh/livekit-server-sdk@2.1.2?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.8";
import { corsHeaders } from "../_shared/cors.ts";
import { handleRateLimit } from "../_shared/rateLimit.ts";

const json = (body: unknown, status = 200, extra: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json", ...extra } });

// LiveKit TrackSource.MICROPHONE
const MICROPHONE = 2;

type Role = "host" | "cohost" | "speaker" | "listener";
const ACTIONS = ["promote", "demote", "cohost", "mute", "remove", "set_mode", "end"] as const;
type Action = typeof ACTIONS[number];

const permissionFor = (canPublish: boolean) => ({
  canSubscribe: true,
  canPublish,
  canPublishData: true,
  // keep letting the participant set their own attributes (raised hand)
  canUpdateMetadata: true,
  canPublishSources: canPublish ? [MICROPHONE] : [],
});

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const rateLimit = await handleRateLimit(req, "space-control", 60, 60000);
  if (!rateLimit.allowed) return rateLimit.response!;

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "UNAUTHORIZED" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const lkKey = Deno.env.get("LIVEKIT_API_KEY");
    const lkSecret = Deno.env.get("LIVEKIT_API_SECRET");
    const lkUrlRaw = Deno.env.get("LIVEKIT_URL");
    if (!supabaseUrl || !serviceKey || !lkKey || !lkSecret || !lkUrlRaw) {
      return json({ error: "SERVER_CONFIG_ERROR", message: "Space controls are not configured on the server (LIVEKIT_URL)." }, 500);
    }
    const lkHost = lkUrlRaw.replace(/^wss:/, "https:").replace(/^ws:/, "http:");

    const admin = createClient(supabaseUrl, serviceKey);
    const { data: userData, error: authErr } = await admin.auth.getUser(authHeader.replace("Bearer ", "").trim());
    if (authErr || !userData?.user) return json({ error: "UNAUTHORIZED" }, 401);
    const userId = userData.user.id;

    const body = await req.json().catch(() => ({}));
    const action = body.action as Action;
    const callId = body.callId as string | undefined;
    const targetUserId = body.targetUserId as string | undefined;
    const mode = body.mode as string | undefined;
    if (!ACTIONS.includes(action) || !callId) return json({ error: "BAD_REQUEST" }, 400);

    const { data: call } = await admin
      .from("calls")
      .select("id, daily_room_name, call_mode, speaking_mode, started_by, status")
      .eq("id", callId)
      .maybeSingle();
    if (!call || call.call_mode !== "audio_space" || !["active", "ringing", "initiating"].includes(call.status)) {
      return json({ error: "NOT_A_LIVE_SPACE" }, 404);
    }
    const room = call.daily_room_name as string;

    // Who is asking? Host = whoever started the space; co-hosts are recorded on call_participants.
    const { data: me } = await admin.from("call_participants").select("role").eq("call_id", callId).eq("user_id", userId).maybeSingle();
    const myRole: Role = call.started_by === userId ? "host" : ((me?.role as Role) || "listener");
    const isHost = myRole === "host";
    const isManager = isHost || myRole === "cohost";

    // A speaker may always step down on their own.
    const stepDown = action === "demote" && targetUserId === userId && myRole === "speaker";
    if (!isManager && !stepDown) return json({ error: "FORBIDDEN", message: "Only the host or a co-host can do that." }, 403);
    // Only the host can create co-hosts, change co-hosts, end the space.
    if ((action === "cohost" || action === "end") && !isHost) return json({ error: "FORBIDDEN", message: "Only the host can do that." }, 403);

    const svc = new RoomServiceClient(lkHost, lkKey, lkSecret);

    const targetRole = async (): Promise<Role> => {
      if (!targetUserId) return "listener";
      if (call.started_by === targetUserId) return "host";
      const { data } = await admin.from("call_participants").select("role").eq("call_id", callId).eq("user_id", targetUserId).maybeSingle();
      return ((data?.role as Role) || "listener");
    };
    // updateParticipant REPLACES the participant's metadata, so every rewrite must carry the picture along too.
    const metaFor = async (uid: string, role: Role) => {
      const { data } = await admin.from("profiles").select("avatar_url").eq("id", uid).maybeSingle();
      return JSON.stringify({ role, avatar: data?.avatar_url || undefined });
    };

    const setRole = async (uid: string, role: Role) => {
      await admin.from("call_participants").upsert(
        { call_id: callId, user_id: uid, role, status: "joined" },
        { onConflict: "call_id,user_id" },
      );
      try {
        await svc.updateParticipant(room, uid, await metaFor(uid, role), permissionFor(role !== "listener") as any);
      } catch (e) {
        // participant not connected right now: the DB role is applied the next time they get a token
        console.warn("[space-control] updateParticipant:", (e as Error).message);
      }
    };

    switch (action) {
      case "promote": {
        if (!targetUserId) return json({ error: "BAD_REQUEST" }, 400);
        if ((await targetRole()) === "listener") await setRole(targetUserId, "speaker");
        break;
      }
      case "demote": {
        if (!targetUserId) return json({ error: "BAD_REQUEST" }, 400);
        const tr = await targetRole();
        if (tr === "host") return json({ error: "FORBIDDEN", message: "The host cannot be moved off stage." }, 403);
        if (tr === "cohost" && !isHost) return json({ error: "FORBIDDEN", message: "Only the host can move a co-host." }, 403);
        // In open-mic spaces everyone may speak, so moving someone to listeners only changes their label.
        await setRole(targetUserId, "listener");
        if (call.speaking_mode === "open") {
          try {
            await svc.updateParticipant(room, targetUserId, await metaFor(targetUserId, "listener"), permissionFor(true) as any);
          } catch (_) { /* ignore */ }
        }
        break;
      }
      case "cohost": {
        if (!targetUserId) return json({ error: "BAD_REQUEST" }, 400);
        await setRole(targetUserId, "cohost");
        break;
      }
      case "mute": {
        if (!targetUserId) return json({ error: "BAD_REQUEST" }, 400);
        const p = await svc.getParticipant(room, targetUserId);
        for (const t of p.tracks || []) {
          // TrackType AUDIO = 0
          if (t.type === 0 && !t.muted) await svc.mutePublishedTrack(room, targetUserId, t.sid, true);
        }
        break;
      }
      case "remove": {
        if (!targetUserId) return json({ error: "BAD_REQUEST" }, 400);
        const tr = await targetRole();
        if (tr === "host" || (tr === "cohost" && !isHost)) return json({ error: "FORBIDDEN" }, 403);
        await svc.removeParticipant(room, targetUserId);
        await admin.from("call_participants").update({ status: "left", left_at: new Date().toISOString() }).eq("call_id", callId).eq("user_id", targetUserId);
        break;
      }
      case "set_mode": {
        const next = mode === "open" ? "open" : "request";
        await admin.from("calls").update({ speaking_mode: next }).eq("id", callId);
        await svc.updateRoomMetadata(room, JSON.stringify({ speaking_mode: next }));
        const { data: roles } = await admin.from("call_participants").select("user_id, role").eq("call_id", callId);
        const roleOf = new Map<string, Role>((roles || []).map((r: any) => [r.user_id, r.role]));
        const live = await svc.listParticipants(room);
        for (const p of live) {
          const r = p.identity === call.started_by ? "host" : roleOf.get(p.identity) || "listener";
          const onStage = r === "host" || r === "cohost" || r === "speaker";
          // open: everyone may publish. request: only people on stage keep the ability.
          await svc.updateParticipant(room, p.identity, await metaFor(p.identity, r as Role), permissionFor(next === "open" || onStage) as any);
        }
        break;
      }
      case "end": {
        await admin.from("calls").update({ status: "ended", ended_at: new Date().toISOString() }).eq("id", callId);
        try {
          await svc.deleteRoom(room);
        } catch (_) { /* room may already be gone */ }
        break;
      }
    }

    return json({ success: true }, 200, rateLimit.headers);
  } catch (err: any) {
    console.error("space-control error:", err);
    return json({ error: "INTERNAL_ERROR", message: err?.message }, 500);
  }
});
