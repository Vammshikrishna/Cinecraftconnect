// deno-lint-ignore-file
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
        JSON.stringify({ error: "Authorization header must be in format: Bearer <token>" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "User not authenticated." }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if ((req.headers.get("content-type") || "").split(";")[0].trim() !== "application/json") {
      return new Response(
        JSON.stringify({ error: "Content-Type must be application/json" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let body: any;
    try {
      body = await req.json();
    } catch (err) {
      return new Response(
        JSON.stringify({ error: "Invalid JSON format" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { room_id } = body;

    if (!room_id || typeof room_id !== "string") {
      return new Response(
        JSON.stringify({ error: "The 'room_id' field is required and must be a string." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data, error: dbError } = await supabase
      .from("room_messages")
      .select("*")
      .eq("room_id", room_id)
      .order("created_at", { ascending: true });

    if (dbError) {
      console.error("db-error-fetch-room-messages", dbError);
      return new Response(
        JSON.stringify({ error: dbError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(JSON.stringify(data ?? []), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("delete-room-exception", err);
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});