// deno-lint-ignore-file
import { createClient } from "npm:@supabase/supabase-js@2.25.0";
import { corsHeaders } from "../_shared/cors.ts";

const errMessage = (e: unknown) => (e instanceof Error ? e.message : String(e));

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // 1) Parse JSON body
  let body: any;
  try {
    body = await req.json();
  } catch (e) {
    return new Response(JSON.stringify({ error: "Invalid JSON format" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // 2) Validate inputs
  const { action_type, max_requests = 60, window_minutes = 60 } = body ?? {};

  if (!action_type || typeof action_type !== "string") {
    return new Response(
      JSON.stringify({ error: "The field action_type is required and must be a string." }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  if (typeof max_requests !== "number" || max_requests <= 0 || max_requests > 5000) {
    return new Response(
      JSON.stringify({ error: "The field max_requests must be a number between 1 and 5000." }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  if (typeof window_minutes !== "number" || window_minutes <= 0 || window_minutes > 1440) {
    return new Response(
      JSON.stringify({ error: "The field window_minutes must be a number between 1 and 1440." }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    // 3) Validate env
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
      return new Response(
        JSON.stringify({ error: "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 4) Init supabase client (server-side)
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });

    // 5) Verify bearer token (optional depending on function access control)
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const token = authHeader.replace("Bearer ", "").trim();
    if (!token) {
      return new Response(JSON.stringify({ error: "Unauthorized - empty token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // safe destructure of getUser
    const authRes = await supabase.auth.getUser(token);
    const authError = (authRes as any).error ?? null;
    const user = (authRes as any).data?.user ?? null;
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 6) Call the rate-limit RPC (assumes check_rate_limit exists)
    const rpcRes = await supabase.rpc("check_rate_limit", {
      _user_id: user.id,
      _action_type: action_type,
      _max_requests: max_requests,
      _window_minutes: window_minutes,
    });

    const rpcError = (rpcRes as any).error ?? null;
    const rpcData = (rpcRes as any).data ?? null;

    if (rpcError) {
      console.error("Rate limit check error:", rpcError);
      return new Response(JSON.stringify({ error: rpcError.message ?? "Rate limit error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!rpcData) {
      const retryAfterSeconds = window_minutes * 60;
      return new Response(
        JSON.stringify({
          allowed: false,
          message: "Rate limit exceeded",
          retry_after: retryAfterSeconds,
        }),
        {
          status: 429,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
            "Retry-After": String(retryAfterSeconds),
          },
        }
      );
    }

    // Allowed
    return new Response(JSON.stringify({ allowed: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Error in rate-limit-check:", e);
    return new Response(JSON.stringify({ error: errMessage(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});