import { createClient } from "npm:@supabase/supabase-js@2.80.0";
import { corsHeaders } from "../../_shared/cors.ts";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization") ?? "";

    if (!authHeader.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Authorization header must be in the format: Bearer <token>" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Use the anon key by default. To bypass RLS, replace with SUPABASE_SERVICE_ROLE_KEY (keep secret).
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: {
          headers: {
            Authorization: authHeader,
          },
        },
      }
    );

    const url = new URL(req.url);
    const roomId = url.searchParams.get("id");

    if (!roomId) {
      return new Response(JSON.stringify({ error: "Room ID is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return new Response(JSON.stringify({ error: "User not authenticated." }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { error } = await supabase
      .from("discussion_rooms")
      .delete()
      .match({ id: roomId, created_by: user.id });

    if (error) {
      console.error("delete-discussion-room-db-error", error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(null, {
      status: 204,
      headers: { ...corsHeaders, "Content-Length": "0" },
    });
  } catch (err) {
    console.error("delete-discussion-room-exception", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});