import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { initializeApp, cert, getApps } from "npm:firebase-admin@12.1.0/app";
import { getMessaging } from "npm:firebase-admin@12.1.0/messaging";

serve(async (req) => {
  try {
    const { record, type, table, schema } = await req.json();

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
        senderName: "System"
    };

    if (table === "direct_messages" && type === "INSERT") {
        if (record.receiver_id) targetUserIds.push(record.receiver_id);
        payload.type = "conversation";
        payload.title = "New Message";
        payload.body = record.content || "Sent an attachment";
        payload.conversationId = record.sender_id;
        payload.id = record.id;
        payload.actionUrl = `/messages/${record.sender_id}`;
        payload.senderId = record.sender_id;
        
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
    } else if (table === "room_messages" && type === "INSERT") {
        const { data: members } = await supabase
            .from("room_members")
            .select("user_id")
            .eq("room_id", record.room_id)
            .neq("user_id", record.user_id);
            
        if (members) targetUserIds = members.map(m => m.user_id);
        
        payload.type = "conversation";
        payload.body = record.content || "Sent an attachment";
        payload.conversationId = record.room_id;
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
        if (senderRes.data?.avatar_url) payload.avatarUrl = senderRes.data.avatar_url;
        payload.title = `${roomName}: ${senderName}`;

    } else if (table === "project_space_messages" && type === "INSERT") {
        const { data: members } = await supabase
            .from("project_space_members")
            .select("user_id")
            .eq("project_space_id", record.project_space_id)
            .neq("user_id", record.user_id);
            
        if (members) targetUserIds = members.map(m => m.user_id);

        payload.type = "conversation";
        payload.body = record.content || "Sent an attachment";
        payload.conversationId = record.project_space_id;
        payload.id = record.id;
        payload.senderId = record.user_id;

        const [senderRes, spaceRes] = await Promise.all([
            supabase.from("profiles").select("full_name, avatar_url").eq("id", record.user_id).single(),
            supabase.from("project_spaces").select("name, project_id").eq("id", record.project_space_id).single()
        ]);

        const senderName = senderRes.data?.full_name || "Someone";
        const spaceName = spaceRes.data?.name || "Project";
        const projectId = spaceRes.data?.project_id;
        
        payload.actionUrl = projectId ? `/projects/${projectId}/space` : `/projects`;
        payload.senderName = senderName;
        if (senderRes.data?.avatar_url) payload.avatarUrl = senderRes.data.avatar_url;
        payload.title = `${spaceName}: ${senderName}`;

    } else if (table === "notifications" && type === "INSERT") {
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
                if (sender.avatar_url) payload.avatarUrl = sender.avatar_url;
            }
        } else {
            payload.senderName = "System";
        }

    } else if (table === "post_likes" && type === "INSERT") {
        // Find the author of the post that was liked
        const { data: post } = await supabase
            .from("posts")
            .select("author_id, content")
            .eq("id", record.post_id)
            .single();
            
        if (post && post.author_id !== record.user_id) {
            targetUserIds = [post.author_id];
            payload.type = "social";
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
        // Find the author of the post that was commented on
        const { data: post } = await supabase
            .from("posts")
            .select("author_id")
            .eq("id", record.post_id)
            .single();
            
        if (post && post.author_id !== record.user_id) {
            targetUserIds = [post.author_id];
            payload.type = "social";
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
        // Ignore other tables for now
        return new Response(JSON.stringify({ message: "Ignored" }), { status: 200 });
    }

    // --- E2EE Detection & Group Key Prefetch ---
    let isEncrypted = false;
    let encryptedContent = "";
    let perUserEncryptedKeys: Record<string, string> = {};

    if (record.content && (record.content.includes("__e2ee") || record.content.includes("__e2ee_group"))) {
        isEncrypted = true;
        encryptedContent = record.content;
        payload.body = "\u{1F512} Encrypted message"; // 🔒 fallback for lock screen
    }

    // For group/room encrypted messages, fetch each target user's encrypted symmetric key
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
        return new Response(JSON.stringify({ error: "No target users" }), { status: 400 });
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
        console.warn("Failed to read user_push_tokens table, falling back to profiles.push_token:", e);
    }

    // 2. Fallback: Read push_token from profiles table if no tokens found yet
    if (userTokens.length === 0) {
        try {
            const { data: profiles } = await supabase
                .from("profiles")
                .select("id, push_token")
                .in("id", targetUserIds);

            if (profiles) {
                userTokens = profiles
                    .filter(p => p.push_token !== null && p.push_token !== undefined && p.push_token !== "")
                    .map(p => ({ userId: p.id, token: p.push_token }));
            }
        } catch (e) {
            console.error("Failed to read fallback profiles.push_token:", e);
        }
    }

    if (userTokens.length === 0) {
        return new Response(JSON.stringify({ message: "No active push tokens found" }), { status: 200 });
    }

    const projectId = Deno.env.get("FIREBASE_PROJECT_ID");
    const clientEmail = Deno.env.get("FIREBASE_CLIENT_EMAIL");
    let privateKey = Deno.env.get("FIREBASE_PRIVATE_KEY");
    
    if (!projectId || !clientEmail || !privateKey) {
        console.warn("FIREBASE credentials are not set. Skipping push delivery.");
        return new Response(JSON.stringify({ message: "FIREBASE credentials missing, delivery skipped" }), { status: 200 });
    }

    let app;
    if (!getApps().length) {
        try {
            // Handle escaped newlines in private key
            privateKey = privateKey.replace(/\\n/g, '\n');
            // Remove any surrounding quotes if they exist
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
            return new Response(JSON.stringify({ error: "Invalid FIREBASE credentials" }), { status: 500 });
        }
    } else {
        app = getApps()[0];
    }

    const messaging = getMessaging(app);

    const responses = await Promise.all(userTokens.map(async ({ userId, token }) => {
        // Sanitize payload to ensure all values are string-only (FCM requirement for data keys)
        const sanitizedData: Record<string, string> = {};
        for (const [key, value] of Object.entries(payload)) {
            if (value !== null && value !== undefined) {
                sanitizedData[key] = String(value);
            } else {
                sanitizedData[key] = "";
            }
        }
        // Inject title, body, and conversationId into data for Android FCMService.java to read!
        sanitizedData["title"] = String(payload.title);
        sanitizedData["body"] = String(payload.body);
        sanitizedData["conversationId"] = String(payload.conversationId || payload.id);
        sanitizedData["targetUserId"] = String(userId); // The user receiving the push (and sending the reply)
        sanitizedData["actionUrl"] = String(payload.actionUrl || `/messages/${payload.conversationId || payload.id}`);
        if (payload.avatarUrl) sanitizedData["avatarUrl"] = String(payload.avatarUrl);

        // Include E2EE data for native decryption
        if (isEncrypted) {
            sanitizedData["isEncrypted"] = "true";
            sanitizedData["encryptedContent"] = encryptedContent;

            // Include this specific user's encrypted symmetric key (if available)
            const userEncKey = perUserEncryptedKeys[userId];
            if (userEncKey) {
                sanitizedData["encryptedSymmetricKey"] = userEncKey;
            }
        }

        const message = {
            token: token,
            data: sanitizedData,
            apns: {
                payload: {
                    aps: {
                        alert: {
                            title: String(payload.title),
                            body: String(payload.body),
                        },
                        sound: "default",
                        badge: 1,
                        "mutable-content": 1,
                        threadId: payload.conversationId || payload.id
                    }
                }
            },
            android: {
                priority: "high" as const,
            }
        };

        try {
            const responseId = await messaging.send(message);
            return { success: true, messageId: responseId };
        } catch (error: any) {
            const errorCode = error.code || "unknown";
            // Dead Token Cleanup: If FCM reports the token is no longer valid (e.g. app uninstalled)
            if (errorCode === 'messaging/invalid-registration-token' || errorCode === 'messaging/registration-token-not-registered') {
                console.log(`[DEAD TOKEN CLEANUP] Removing invalid token: ${token}`);
                // Delete from both fallback and primary storage
                await Promise.all([
                    supabase.from("user_push_tokens").delete().eq("token", token),
                    supabase.from("profiles").update({ push_token: null }).eq("push_token", token)
                ]);
            }
            return { success: false, error: errorCode, message: error.message };
        }
    }));

    return new Response(JSON.stringify({ success: true, responses }), { status: 200 });

  } catch (error) {
    console.error(error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
});
