// deno-lint-ignore-file
import { createClient } from "npm:@supabase/supabase-js@2.25.0";
import { corsHeaders } from "../../_shared/cors.ts";

const safeErrMessage = (e: unknown) => (e instanceof Error ? e.message : String(e));

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    // Validate content-type
    const contentType = req.headers.get("content-type") ?? "";
    if (!contentType.includes("application/json")) {
      return new Response(
        JSON.stringify({ error: "Content-Type must be application/json" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate env
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
    const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
      return new Response(JSON.stringify({ error: "Server misconfiguration" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Parse body
    let body: any;
    try {
      body = await req.json();
    } catch (e) {
      return new Response(JSON.stringify({ error: "Invalid JSON format" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { name, description, room_type } = body ?? {};

    // Validate fields
    if (!name || typeof name !== "string" || name.length < 1 || name.length > 100) {
      return new Response(
        JSON.stringify({
          error: "The 'name' field must be a string between 1 and 100 characters.",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    if (description && (typeof description !== "string" || description.length > 1000)) {
      return new Response(
        JSON.stringify({
          error: "The 'description' field must be a string with a maximum length of 1000 characters.",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    if (!room_type || !["public", "private"].includes(room_type)) {
      return new Response(
        JSON.stringify({ error: "The 'room_type' must be either 'public' or 'private'." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate Authorization header
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace("Bearer ", "").trim();
    if (!token) {
      return new Response(JSON.stringify({ error: "Authorization header is missing or invalid" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create SERVICE_ROLE client to verify the user and perform the insert
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });

    // Verify user from incoming token
    const authRes = await supabase.auth.getUser(token);
    const authErr = (authRes as any).error ?? null;
    const user = (authRes as any).data?.user ?? null;
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: "User not authenticated" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Insert the room using service role (trusted). Select only safe fields to return.
    const insertRes = await supabase
      .from("discussion_rooms")
      .insert({
        name,
        description,
        room_type,
        created_by: user.id,
      })
      .select("id, name, description, room_type, created_by, created_at")
      .single();

    if ((insertRes as any).error) {
      const err = (insertRes as any).error;
      console.error("Insert error:", err);
      return new Response(JSON.stringify({ error: err.message ?? "Insert failed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const inserted = (insertRes as any).data;

    return new Response(JSON.stringify({ room: inserted }), {
      status: 201,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Function error:", err);
    return new Response(JSON.stringify({ error: safeErrMessage(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});