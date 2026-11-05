import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { initializeApp, cert, getApps } from "npm:firebase-admin@12.1.0/app";
import { getMessaging } from "npm:firebase-admin@12.1.0/messaging";
import { handleRateLimit } from "../_shared/rateLimit.ts";

function isEncryptedContent(content: string | null): boolean {
    if (!content) return false;
    if (
        content.includes("__e2ee") ||
        content.includes("__e2ee_group") ||
        content.includes("__e2ee_dm") ||
        content.includes("__e2ee_thread")
    ) {
        return true;
    }
    if (content.startsWith("{")) {
        try {
            const json = JSON.parse(content);
            if (json.version === 2 || json.type === "group" || json.type === "dm" || json.ciphertext) {
                return true;
            }
        } catch {
            // Ignore non-JSON
        }
    }
    return false;
}

function formatNotificationMessage(content: string | null): string {
    if (!content) {
        return "Sent an attachment";
    }

    if (isEncryptedContent(content)) {
        return "Sent you a message";
    }

    if (content.includes("_SHARE::")) {
        const shareType = content.split("_SHARE::")[0].toLowerCase();
        const labels: Record<string, string> = {
            post: "Shared a post",
            marketplace: "Shared a marketplace listing",
            announcement: "Shared an announcement",
            vendor: "Shared a vendor profile",
            project: "Shared a project",
            discussion: "Shared a discussion room",
            job: "Shared a job",
            craft: "Shared a craft",
            profile: "Shared a profile"
        };
        return labels[shareType] || `Shared a ${shareType}`;
    }

    const lower = content.toLowerCase();
    if (lower.startsWith("![") && lower.includes("](")) {
        return "Photo";
    }

    return content;
}

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const reqBody = await req.json();
        const { record, type, table, schema } = reqBody;

        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        const supabase = createClient(supabaseUrl, supabaseKey);

        let targetUserIds: string[] = [];
        let payload = {
            title: "New Update",
            body: "You have a new activity.",
            type: "social",
            id: String(Date.now()),
            senderId: "system",
            actionUrl: "/",
            conversationId: "",
            senderName: "System",
            avatarUrl: undefined as string | undefined
        };

        let isEncrypted = false;
        let encryptedContent = "";
        let perUserEncryptedKeys: Record<string, string> = {};

        // Two kinds of caller reach this function:
        //  1. the database webhook (table / record in the body), which must send the shared secret;
        //  2. a signed-in app ringing people for a call (recipientIds in the body), which must be a real user
        //     and may only ring people who belong to the same room.
        const isFastPath = Array.isArray(reqBody.recipientIds) && reqBody.recipientIds.length > 0;
        const reply = (body: unknown, status: number) =>
            new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

        let callerUserId: string | null = null;
        if (isFastPath) {
            const bearer = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "").trim();
            const { data: callerData, error: callerErr } = bearer
                ? await supabase.auth.getUser(bearer)
                : ({ data: null, error: new Error("no token") } as any);
            if (callerErr || !callerData?.user) return reply({ error: "UNAUTHORIZED" }, 401);
            callerUserId = callerData.user.id as string;
            const rl = await handleRateLimit(req, "push-delivery", 120, 60000);
            if (!rl.allowed) return rl.response!;
        } else {
            const expected = Deno.env.get("PUSH_WEBHOOK_SECRET");
            if (expected) {
                const got = req.headers.get("x-webhook-secret") || "";
                let diff = got.length ^ expected.length;
                for (let i = 0; i < Math.min(got.length, expected.length); i++) diff |= got.charCodeAt(i) ^ expected.charCodeAt(i);
                if (diff !== 0) return reply({ error: "UNAUTHORIZED" }, 401);
            } else {
                console.warn("[push-delivery] PUSH_WEBHOOK_SECRET is not set: database webhook calls are NOT authenticated yet.");
            }
        }

        // DIRECT FAST-PATH FOR INSTANT 0-LATENCY CALL FCM PUSH & MULTI-DEVICE SYNC
        if (isFastPath && callerUserId) {
            const reqType = String(reqBody.type || "incoming_call");
            if (!["incoming_call", "call_answered", "call_cancelled"].includes(reqType)) {
                return reply({ error: "BAD_REQUEST", message: "Unsupported push type" }, 400);
            }
            const roomIdStr = String(reqBody.roomId || "").slice(0, 300);
            const roomTypeStr = String(reqBody.roomType || "");
            let recipients: string[] = Array.from(new Set((reqBody.recipientIds as unknown[]).map(String)))
                .filter((id) => uuidRe.test(id))
                .slice(0, 100);
            if (recipients.length === 0) return reply({ error: "BAD_REQUEST", message: "No valid recipients" }, 400);

            let resolvedRoomType = roomTypeStr;
            let resolvedRoomRef = roomIdStr;

            if (reqType === "call_answered") {
                // Multi-device sync: the answering user may only tell their own other devices.
                recipients = recipients.filter((id) => id === callerUserId);
            } else if (reqType === "call_cancelled") {
                // The cancel notice carries no room type, so find the call this person started or is part of.
                const { data: callRows } = await supabase
                    .from("calls")
                    .select("room_type, daily_room_name, started_by, created_at")
                    .or(`daily_room_name.eq.${roomIdStr.replace(/[^A-Za-z0-9_-]/g, "")},room_id.eq.${uuidRe.test(roomIdStr) ? roomIdStr : "00000000-0000-0000-0000-000000000000"}`)
                    .order("created_at", { ascending: false })
                    .limit(1);
                const callRow = callRows?.[0];
                if (!callRow || callRow.started_by !== callerUserId) {
                    return reply({ error: "FORBIDDEN", message: "Only the person who started the call can cancel it" }, 403);
                }
                resolvedRoomType = callRow.room_type;
                resolvedRoomRef = callRow.daily_room_name || roomIdStr;
            } else {
                if (!["project", "discussion", "direct"].includes(roomTypeStr) || !roomIdStr) {
                    return reply({ error: "BAD_REQUEST", message: "Missing room" }, 400);
                }
                const { data: callerOk } = await supabase.rpc("verify_call_room_membership", {
                    p_user_id: callerUserId, p_room_type: roomTypeStr, p_room_id: roomIdStr,
                });
                if (callerOk !== true) return reply({ error: "FORBIDDEN", message: "You are not part of this room" }, 403);
            }

            if (reqType !== "call_answered") {
                // Only people who belong to the same room can be rung.
                const checks = await Promise.all(recipients.map(async (id) => {
                    if (id === callerUserId) return null;
                    const { data: ok } = await supabase.rpc("verify_call_room_membership", {
                        p_user_id: id, p_room_type: resolvedRoomType, p_room_id: resolvedRoomRef,
                    });
                    return ok === true ? id : null;
                }));
                recipients = checks.filter((id): id is string => !!id);
            }
            if (recipients.length === 0) return reply({ error: "FORBIDDEN", message: "No one in this room to notify" }, 403);

            // Name and picture come from the caller's profile, never from the request.
            const { data: callerProfile } = await supabase
                .from("profiles").select("full_name, avatar_url").eq("id", callerUserId).maybeSingle();
            const callerName = String(callerProfile?.full_name || "Someone").slice(0, 80);

            // Links stay inside the app.
            let safeActionUrl = String(reqBody.actionUrl || "/");
            if (!safeActionUrl.startsWith("/") || safeActionUrl.startsWith("//")) safeActionUrl = "/";

            targetUserIds = recipients;
            payload.type = reqType;
            payload.title = reqType === "call_answered" ? "Call Answered" : callerName;
            payload.body = `${callerName} is calling you...`;
            payload.id = roomIdStr || String(Date.now());
            payload.conversationId = roomIdStr;
            payload.senderId = callerUserId;
            payload.actionUrl = safeActionUrl;
            payload.senderName = callerName;
            if (typeof reqBody.callId === "string" && uuidRe.test(reqBody.callId)) (payload as any).callId = reqBody.callId;
            if (roomIdStr) (payload as any).roomId = roomIdStr;
            if (callerProfile?.avatar_url) payload.avatarUrl = callerProfile.avatar_url;
            // what the ringing screen on the phone needs to show and to join the right room
            if (resolvedRoomType) (payload as any).roomType = resolvedRoomType;
            if (reqBody.roomName) (payload as any).roomName = String(reqBody.roomName).slice(0, 120);
            if (typeof reqBody.isVideo === "boolean") (payload as any).isVideo = reqBody.isVideo;
        } else if (table === "notifications" && type === "INSERT") {
            // Check if this is a message notification loop from our own insertions
            if (record.type === "new_message") {
                console.log("Ignored message notification loop to prevent duplicate FCM push.");
                return new Response(JSON.stringify({ success: true, message: "Ignored message notification loop" }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
            }

            // Suppress duplicate call push from DB webhook (since calls are dispatched directly via fast-path)
            if (record.type === "call_started" || record.type === "call_invite" || record.type === "incoming_call") {
                console.log("Ignored call notification from notifications table (handled by direct fast-path)");
                return new Response(JSON.stringify({ success: true, message: "Ignored call DB webhook (handled by fast-path)" }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
            }

            // Handle central 'notifications' table for all other app events (likes, follows, system, etc)
            targetUserIds = [record.user_id];
            payload.type = record.type || "social";
            payload.title = record.title || "New Notification";
            payload.body = record.message || "You have a new update.";
            payload.id = record.id;
            payload.actionUrl = record.action_url || "/";
            payload.senderId = record.trigger_user_id || "system";

            // If it's a conversation routed through notifications, it needs the conversationId
            if (payload.type === "conversation") {
                payload.conversationId = record.related_id || record.trigger_user_id;
            }

            // Fetch trigger user name for the Android lock screen
            if (record.trigger_user_id) {
                const { data: sender } = await supabase
                    .from("profiles")
                    .select("full_name, avatar_url")
                    .eq("id", record.trigger_user_id)
                    .single();
                if (sender) {
                    payload.senderName = sender.full_name;
                    const isCall = record.type === "call_invite" || record.type === "call_started" || record.type === "incoming_call";
                    payload.title = isCall ? sender.full_name : (record.title || "New Notification");
                    payload.body = isCall ? `${sender.full_name} is calling you...` : (record.message || "You have a new update.");
                    if (sender.avatar_url) payload.avatarUrl = sender.avatar_url;
                }
            } else {
                payload.senderName = "System";
            }

        } else if (table === "direct_messages" && type === "INSERT") {
            if (record.attachment_type === "call_event" || (typeof record.content === "string" && (record.content.includes("Video call started") || record.content.includes("Call ended")))) {
                return new Response(JSON.stringify({ success: true, message: "Skipped call system event push" }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
            }
            if (record.receiver_id) targetUserIds.push(record.receiver_id);
            payload.type = "dm";
            payload.title = "New Message";
            payload.body = formatNotificationMessage(record.content);
            payload.conversationId = record.sender_id;
            payload.id = record.id;
            payload.actionUrl = `/messages/${record.sender_id}`;
            payload.senderId = record.sender_id;
            (payload as any).partnerId = record.sender_id;
            if (record.channel_id) (payload as any).channelId = record.channel_id;

            // Fetch sender name and avatar
            const { data: sender } = await supabase
                .from("profiles")
                .select("full_name, avatar_url")
                .eq("id", record.sender_id)
                .single();
            if (sender) {
                payload.senderName = sender.full_name;
                payload.title = sender.full_name;
                if (sender.avatar_url) payload.avatarUrl = sender.avatar_url;
            }

            // Detect encryption early
            if (isEncryptedContent(record.content)) {
                isEncrypted = true;
                encryptedContent = record.content;
                payload.body = "Sent you a message";
            }

            // Move database notification generation here
            const notificationToInsert = {
                user_id: record.receiver_id,
                trigger_user_id: record.sender_id,
                type: 'new_message',
                title: payload.title,
                message: payload.body,
                action_url: payload.actionUrl,
                related_id: record.id,
                related_type: 'direct_message',
                priority: 'high',
                is_read: false,
                metadata: isEncrypted ? { encrypted_content: record.content } : null
            };

            const { error: insertErr } = await supabase
                .from('notifications')
                .insert(notificationToInsert);
            if (insertErr) {
                console.error("Failed to insert DM notification row:", insertErr);
            }

            // The receiver muted this chat (conversation_prefs, part GE): keep the in-app row but send no push.
            // If the table does not exist yet the query errors and the push goes out as before.
            try {
                const { data: pref, error: prefErr } = await supabase
                    .from("conversation_prefs")
                    .select("muted")
                    .eq("user_id", record.receiver_id)
                    .eq("partner_id", record.sender_id)
                    .maybeSingle();
                if (!prefErr && pref?.muted) {
                    return new Response(JSON.stringify({ success: true, message: "Skipped push: chat muted by receiver" }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
                }
            } catch (e) {
                console.warn("Mute check failed, sending push:", e);
            }

        } else if (table === "room_messages" && type === "INSERT") {
            if (record.media_type === "call_event" || record.attachment_type === "call_event" || (typeof record.content === "string" && (record.content.includes("Video call started") || record.content.includes("Call ended")))) {
                return new Response(JSON.stringify({ success: true, message: "Skipped call system event push" }), { status: 200 });
            }
            const { data: members } = await supabase
                .from("room_members")
                .select("user_id")
                .eq("room_id", record.room_id)
                .neq("user_id", record.user_id);

            if (members) targetUserIds = members.map(m => m.user_id);

            payload.type = "room";
            payload.body = formatNotificationMessage(record.content);
            payload.conversationId = record.room_id;
            (payload as any).roomId = record.room_id;
            payload.id = record.id;
            payload.actionUrl = `/discussion-rooms/${record.room_id}`;
            payload.senderId = record.user_id;

            const [senderRes, roomRes] = await Promise.all([
                supabase.from("profiles").select("full_name, avatar_url").eq("id", record.user_id).single(),
                supabase.from("discussion_rooms").select("title").eq("id", record.room_id).single()
            ]);

            const senderName = senderRes.data?.full_name || "Someone";
            const roomName = roomRes.data?.title || "Room";

            payload.senderName = senderName;
            (payload as any).roomTitle = roomName;
            if (senderRes.data?.avatar_url) payload.avatarUrl = senderRes.data.avatar_url;
            payload.title = `${roomName}: ${senderName}`;

            // Detect encryption early
            if (isEncryptedContent(record.content)) {
                isEncrypted = true;
                encryptedContent = record.content;
                payload.body = "Sent you a message";
            }

            // Move database notification generation here (insert for each target member)
            const notificationsToInsert = targetUserIds.map(memberId => ({
                user_id: memberId,
                trigger_user_id: record.user_id,
                type: 'new_message',
                title: `${senderName} in ${roomName}`,
                message: payload.body,
                action_url: payload.actionUrl,
                related_id: record.id,
                related_type: 'room_message',
                priority: 'medium',
                is_read: false,
                metadata: isEncrypted ? { encrypted_content: record.content } : null
            }));

            if (notificationsToInsert.length > 0) {
                const { error: insertErr } = await supabase
                    .from('notifications')
                    .insert(notificationsToInsert);
                if (insertErr) {
                    console.error("Failed to insert Room Message notification rows:", insertErr);
                }
            }

        } else if (table === "project_space_messages" && type === "INSERT") {
            if (record.attachment_type === "call_event" || record.media_type === "call_event" || (typeof record.content === "string" && (record.content.includes("Video call started") || record.content.includes("Call ended")))) {
                return new Response(JSON.stringify({ success: true, message: "Skipped call system event push" }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
            }
            const { data: members } = await supabase
                .from("project_space_members")
                .select("user_id")
                .eq("project_space_id", record.project_space_id)
                .neq("user_id", record.user_id);

            if (members) targetUserIds = members.map(m => m.user_id);

            payload.type = "project";
            payload.body = formatNotificationMessage(record.content);
            payload.conversationId = record.project_space_id;
            (payload as any).spaceId = record.project_space_id;
            payload.id = record.id;
            payload.senderId = record.user_id;

            const [senderRes, spaceRes] = await Promise.all([
                supabase.from("profiles").select("full_name, avatar_url").eq("id", record.user_id).single(),
                supabase.from("project_spaces").select("name, project_id").eq("id", record.project_space_id).single()
            ]);

            const senderName = senderRes.data?.full_name || "Someone";
            const spaceName = spaceRes.data?.name || "Project";
            const projectId = spaceRes.data?.project_id;
            if (projectId) (payload as any).projectId = projectId;

            payload.actionUrl = projectId ? `/projects/${projectId}/space` : `/projects`;
            payload.senderName = senderName;
            if (senderRes.data?.avatar_url) payload.avatarUrl = senderRes.data.avatar_url;
            payload.title = `${spaceName}: ${senderName}`;

            // Detect encryption early
            if (isEncryptedContent(record.content)) {
                isEncrypted = true;
                encryptedContent = record.content;
                payload.body = "Sent you a message";
            }

            // Move database notification generation here (insert for each target member)
            const notificationsToInsert = targetUserIds.map(memberId => ({
                user_id: memberId,
                trigger_user_id: record.user_id,
                type: 'new_message',
                title: `${senderName} in ${spaceName}`,
                message: payload.body,
                action_url: payload.actionUrl,
                related_id: record.id,
                related_type: 'project_space_message',
                priority: 'medium',
                is_read: false,
                metadata: isEncrypted ? { encrypted_content: record.content } : null
            }));

            if (notificationsToInsert.length > 0) {
                const { error: insertErr } = await supabase
                    .from('notifications')
                    .insert(notificationsToInsert);
                if (insertErr) {
                    console.error("Failed to insert Project Space Message notification rows:", insertErr);
                }
            }

        } else if (table === "post_likes" && type === "INSERT") {
            const { data: post } = await supabase
                .from("posts")
                .select("author_id, content")
                .eq("id", record.post_id)
                .single();

            if (post && post.author_id !== record.user_id) {
                targetUserIds = [post.author_id];
                payload.type = "like";
                payload.id = record.id;
                payload.actionUrl = `/post/${record.post_id}`;
                payload.senderId = record.user_id;

                const { data: sender } = await supabase
                    .from("profiles")
                    .select("full_name, avatar_url")
                    .eq("id", record.user_id)
                    .single();

                const senderName = sender?.full_name || "Someone";
                payload.senderName = senderName;
                if (sender?.avatar_url) payload.avatarUrl = sender.avatar_url;
                payload.title = `${senderName} liked your post`;
                payload.body = post.content ? `"${post.content.substring(0, 30)}..."` : "Check out your post's new likes!";
            }

        } else if (table === "post_comments" && type === "INSERT") {
            const { data: post } = await supabase
                .from("posts")
                .select("author_id")
                .eq("id", record.post_id)
                .single();

            if (post && post.author_id !== record.user_id) {
                targetUserIds = [post.author_id];
                payload.type = "comment";
                payload.id = record.id;
                payload.actionUrl = `/post/${record.post_id}`;
                payload.senderId = record.user_id;

                const { data: sender } = await supabase
                    .from("profiles")
                    .select("full_name, avatar_url")
                    .eq("id", record.user_id)
                    .single();

                const senderName = sender?.full_name || "Someone";
                payload.senderName = senderName;
                if (sender?.avatar_url) payload.avatarUrl = sender.avatar_url;
                payload.title = `${senderName} commented on your post`;
                payload.body = record.content || "View their comment.";
            }

        } else {
            return new Response(JSON.stringify({ message: "Ignored" }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        // --- Group Key Prefetch (only for group message types) ---
        if (isEncrypted && targetUserIds.length > 0) {
            if (table === "room_messages" || table === "project_space_messages") {
                const targetId = table === "room_messages" ? record.room_id : record.project_space_id;
                const targetType = table === "room_messages" ? "room" : "project_space";

                try {
                    const { data: groupKeys } = await supabase
                        .from("group_keys")
                        .select("user_id, encrypted_symmetric_key")
                        .eq("target_type", targetType)
                        .eq("target_id", targetId)
                        .in("user_id", targetUserIds);

                    if (groupKeys) {
                        for (const gk of groupKeys) {
                            perUserEncryptedKeys[gk.user_id] = gk.encrypted_symmetric_key;
                        }
                    }
                } catch (e) {
                    console.warn("Failed to fetch group keys for E2EE push:", e);
                }
            }
        }

        if (targetUserIds.length === 0) {
            return new Response(JSON.stringify({ error: "No target users" }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        let userTokens: { userId: string, token: string }[] = [];

        // 1. Try reading from user_push_tokens first
        try {
            const { data: tokens, error } = await supabase
                .from("user_push_tokens")
                .select("user_id, token")
                .in("user_id", targetUserIds)
                .eq("active", true);

            if (tokens && tokens.length > 0) {
                userTokens = tokens.map(t => ({ userId: t.user_id, token: t.token }));
            }
        } catch (e) {
            console.warn("Failed to read user_push_tokens table, push notifications unavailable:", e);
        }

        if (userTokens.length === 0) {
            return new Response(JSON.stringify({ message: "No active push tokens found" }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        const projectId = Deno.env.get("FIREBASE_PROJECT_ID");
        const clientEmail = Deno.env.get("FIREBASE_CLIENT_EMAIL");
        let privateKey = Deno.env.get("FIREBASE_PRIVATE_KEY");

        if (!projectId || !clientEmail || !privateKey) {
            console.warn("FIREBASE credentials are not set. Skipping push delivery.");
            return new Response(JSON.stringify({ message: "FIREBASE credentials missing, delivery skipped" }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        let app;
        if (!getApps().length) {
            try {
                privateKey = privateKey.replace(/\\n/g, '\n');
                if (privateKey.startsWith('"') && privateKey.endsWith('"')) {
                    privateKey = privateKey.substring(1, privateKey.length - 1);
                }

                const serviceAccount = {
                    projectId,
                    clientEmail,
                    privateKey,
                };

                app = initializeApp({
                    credential: cert(serviceAccount)
                });
            } catch (e) {
                console.error("Failed to initialize Firebase app with provided credentials.", e);
                return new Response(JSON.stringify({ error: "Invalid FIREBASE credentials" }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
            }
        } else {
            app = getApps()[0];
        }

        const messaging = getMessaging(app);

        const responses = await Promise.all(userTokens.map(async ({ userId, token }) => {
            const sanitizedData: Record<string, string> = {};
            for (const [key, value] of Object.entries(payload)) {
                if (value !== null && value !== undefined) {
                    sanitizedData[key] = String(value);
                } else {
                    sanitizedData[key] = "";
                }
            }
            sanitizedData["title"] = String(payload.title);
            sanitizedData["body"] = String(payload.body);
            sanitizedData["conversationId"] = String(payload.conversationId || payload.id);
            sanitizedData["targetUserId"] = String(userId);
            sanitizedData["sentAt"] = String(Date.now());
            if ((payload as any).callId) sanitizedData["callId"] = String((payload as any).callId);
            if ((payload as any).roomId) sanitizedData["roomId"] = String((payload as any).roomId);
            if ((payload as any).roomType) sanitizedData["roomType"] = String((payload as any).roomType);
            if ((payload as any).roomName) sanitizedData["roomName"] = String((payload as any).roomName);
            if ((payload as any).isVideo !== undefined) sanitizedData["isVideo"] = String((payload as any).isVideo);
            if ((payload as any).spaceId) sanitizedData["spaceId"] = String((payload as any).spaceId);
            if ((payload as any).projectId) sanitizedData["projectId"] = String((payload as any).projectId);
            if ((payload as any).senderId) sanitizedData["senderId"] = String((payload as any).senderId);
            if ((payload as any).partnerId) sanitizedData["partnerId"] = String((payload as any).partnerId);
            if ((payload as any).channelId) sanitizedData["channelId"] = String((payload as any).channelId);
            
            let callActionUrl = String(payload.actionUrl || `/messages/${payload.conversationId || payload.id}`);
            const pType = String(payload.type || '');
            if (pType === 'incoming_call' || pType === 'call_started' || pType === 'call_invite' || payload.autoJoinCall) {
                if (callActionUrl && !callActionUrl.includes('autoJoin=true')) {
                    callActionUrl += callActionUrl.includes('?') ? '&autoJoin=true' : '?autoJoin=true';
                }
            }
            sanitizedData["actionUrl"] = callActionUrl;
            if (payload.avatarUrl) sanitizedData["avatarUrl"] = String(payload.avatarUrl);

            // Include E2EE data for native decryption
            if (isEncrypted) {
                sanitizedData["isEncrypted"] = "true";
                sanitizedData["encryptedContent"] = encryptedContent;

                const userEncKey = perUserEncryptedKeys[userId];
                if (userEncKey) {
                    sanitizedData["encryptedSymmetricKey"] = userEncKey;
                }
            }

            // A hang-up notice only has to stop the ringing: no banner, no sound, nothing for the person to read.
            const isCancelNotice = String(payload.type || '') === 'call_cancelled';

            const message: any = {
                token: token,
                data: sanitizedData,
                android: {
                    priority: "high" as const,
                    ttl: 0,
                },
                apns: isCancelNotice ? {
                    headers: { "apns-priority": "5", "apns-push-type": "background" },
                    payload: { aps: { "content-available": 1 } }
                } : {
                    headers: {
                        "apns-priority": "10",
                    },
                    payload: {
                        aps: {
                            alert: {
                                title: String(payload.title),
                                body: String(payload.body),
                            },
                            sound: "default",
                            badge: 1,
                            "mutable-content": 1,
                            // Reply / mark-as-read buttons on iOS (registered in AppDelegate). Project spaces are end-to-end
                            // encrypted, so they only get "mark as read".
                            category: pType === 'dm' || pType === 'room' ? 'cc_message' : (pType === 'project' ? 'cc_message_readonly' : undefined),
                            threadId: payload.conversationId || payload.id
                        }
                    }
                }
            };

            try {
                const responseId = await messaging.send(message);
                return { success: true, messageId: responseId };
            } catch (error: any) {
                const errorCode = error.code || "unknown";
                if (errorCode === 'messaging/invalid-registration-token' || errorCode === 'messaging/registration-token-not-registered') {
                    console.log(`[DEAD TOKEN CLEANUP] Removing invalid token: ${token}`);
                    await supabase.from("user_push_tokens").delete().eq("token", token);
                }
                return { success: false, error: errorCode, message: error.message };
            }
        }));

        return new Response(JSON.stringify({ success: true, responses }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    } catch (error) {
        console.error(error);
        return new Response(JSON.stringify({ error: (error as any).message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
});
