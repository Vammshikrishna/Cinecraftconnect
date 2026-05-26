import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
    try {
        const bodyText = await req.text();
        let body;
        try {
            body = JSON.parse(bodyText);
        } catch (e) {
            // Android HTTP client might send urlencoded or raw string, but we expect JSON
            return new Response("Invalid JSON", { status: 400 });
        }

        const { conversationId, senderId, content, action, actionUrl } = body;

        if (!conversationId || !senderId) {
            return new Response("Missing conversationId or senderId", { status: 400 });
        }

        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        const supabase = createClient(supabaseUrl, supabaseKey);

        if (action === "read") {
            // Try updating direct_messages
            await supabase.from("direct_messages").update({ is_read: true }).eq("sender_id", conversationId).is("is_read", false);
            
            // Legacy messages
            await supabase.from("messages").update({ is_read: true }).eq("conversation_id", conversationId).is("is_read", false);

            return new Response(JSON.stringify({ success: true, message: "Marked as read" }), { status: 200 });
        }

        if (action === "reply") {
            if (!content) return new Response("Missing content", { status: 400 });

            if (actionUrl && actionUrl.includes("/discussion-rooms/")) {
                const { error: rmError } = await supabase.from("room_messages").insert({
                    user_id: senderId,
                    room_id: conversationId,
                    content: content
                });
                if (rmError) return new Response(JSON.stringify({ success: false, error: rmError.message }), { status: 500 });
                return new Response(JSON.stringify({ success: true }), { status: 200 });
            } 
            else if (actionUrl && actionUrl.includes("/projects/")) {
                const { error: psmError } = await supabase.from("project_space_messages").insert({
                    user_id: senderId,
                    project_space_id: conversationId,
                    content: content
                });
                if (psmError) return new Response(JSON.stringify({ success: false, error: psmError.message }), { status: 500 });
                return new Response(JSON.stringify({ success: true }), { status: 200 });
            } 
            else {
                // Must be DM
                const channelId = [senderId, conversationId].sort().join('-');
                const { error: dmError } = await supabase.from("direct_messages").insert({
                    sender_id: senderId,
                    receiver_id: conversationId,
                    channel_id: channelId,
                    content: content
                });
                
                if (dmError) {
                    // Fallback to legacy messages table just in case
                    const { error: mError } = await supabase.from("messages").insert({
                        sender_id: senderId,
                        conversation_id: conversationId,
                        content: content
                    });
                    if (mError) return new Response(JSON.stringify({ success: false, error: mError.message }), { status: 500 });
                }
                
                return new Response(JSON.stringify({ success: true }), { status: 200 });
            }
        }

        return new Response("Invalid action", { status: 400 });

    } catch (error: any) {
        return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }
});
