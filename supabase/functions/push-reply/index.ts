import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

serve(async (req) => {
    try {
        let body;
        try {
            body = JSON.parse(await req.text());
        } catch (_e) {
            return json({ error: "Invalid JSON" }, 400);
        }

        const { conversationId, content, action, actionUrl } = body;
        if (!conversationId) return json({ error: "Missing conversationId" }, 400);

        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        const supabase = createClient(supabaseUrl, supabaseKey);

        // Identify the caller from their own access token. A client-supplied senderId is never trusted.
        const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
        const { data: authData, error: authError } = await supabase.auth.getUser(token);
        const userId = authData?.user?.id;
        if (authError || !userId) return json({ error: "Unauthorized" }, 401);

        if (action === "read") {
            // Only mark messages that were sent TO the caller.
            await supabase.from("direct_messages").update({ is_read: true })
                .eq("sender_id", conversationId).eq("receiver_id", userId).is("is_read", false);
            return json({ success: true, message: "Marked as read" });
        }

        if (action === "reply") {
            if (!content || typeof content !== "string") return json({ error: "Missing content" }, 400);

            if (actionUrl && actionUrl.includes("/discussion-rooms/")) {
                const { data: member } = await supabase.from("room_members").select("user_id")
                    .eq("room_id", conversationId).eq("user_id", userId).maybeSingle();
                if (!member) return json({ error: "Forbidden" }, 403);

                const { error } = await supabase.from("room_messages").insert({
                    user_id: userId, room_id: conversationId, content,
                });
                if (error) return json({ success: false, error: error.message }, 500);
                return json({ success: true });
            }

            if (actionUrl && actionUrl.includes("/projects/")) {
                const { data: member } = await supabase.from("project_space_members").select("user_id")
                    .eq("project_space_id", conversationId).eq("user_id", userId).maybeSingle();
                if (!member) return json({ error: "Forbidden" }, 403);

                const { error } = await supabase.from("project_space_messages").insert({
                    user_id: userId, project_space_id: conversationId, content,
                });
                if (error) return json({ success: false, error: error.message }, 500);
                return json({ success: true });
            }

            // Direct message: conversationId is the other participant's user id.
            if (conversationId === userId) return json({ error: "Invalid recipient" }, 400);
            const channelId = [userId, conversationId].sort().join("-");
            const { error } = await supabase.from("direct_messages").insert({
                sender_id: userId, receiver_id: conversationId, channel_id: channelId, content,
            });
            if (error) return json({ success: false, error: error.message }, 500);
            return json({ success: true });
        }

        return json({ error: "Invalid action" }, 400);
    } catch (error: any) {
        return json({ error: error.message }, 500);
    }
});
