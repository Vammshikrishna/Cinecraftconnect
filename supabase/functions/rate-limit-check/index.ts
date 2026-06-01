// deno-lint-ignore-file
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

const errMessage = (e: unknown) => (e instanceof Error ? e.message : String(e));

// ---------------------------------------------------------------------------
// Upstash Redis REST helper — executes a pipeline of commands in one request.
// ---------------------------------------------------------------------------
interface RedisCommand {
  command: string[];
}

async function redisPipeline(
  redisUrl: string,
  redisToken: string,
  commands: RedisCommand[]
): Promise<unknown[]> {
  const res = await fetch(`${redisUrl}/pipeline`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${redisToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(commands.map((c) => c.command)),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Upstash pipeline failed (${res.status}): ${text}`);
  }

  const json = (await res.json()) as { result: unknown; error?: string }[];
  // Each element is { result, error }. Throw on first error.
  for (const item of json) {
    if (item.error) throw new Error(`Upstash command error: ${item.error}`);
  }
  return json.map((item) => item.result);
}

// ---------------------------------------------------------------------------
// Sliding-window rate limit using a sorted set per (userId, actionType).
//   Key  : rate:<userId>:<actionType>
//   Score: Unix timestamp in milliseconds (unique per request)
//   Member: <timestamp>-<random>
// ---------------------------------------------------------------------------
async function checkRateLimit(
  redisUrl: string,
  redisToken: string,
  userId: string,
  actionType: string,
  maxRequests: number,
  windowMs: number
): Promise<{ allowed: boolean; current: number; retryAfterMs: number }> {
  const key = `rate:${userId}:${actionType}`;
  const now = Date.now();
  const windowStart = now - windowMs;
  const member = `${now}-${Math.random().toString(36).slice(2)}`;
  const expireSeconds = Math.ceil(windowMs / 1000) + 60; // buffer

  const results = await redisPipeline(redisUrl, redisToken, [
    // 1. Remove members older than the window
    { command: ["ZREMRANGEBYSCORE", key, "-inf", String(windowStart)] },
    // 2. Add current request
    { command: ["ZADD", key, String(now), member] },
    // 3. Count members within window
    { command: ["ZCARD", key] },
    // 4. Refresh TTL so the key expires after inactivity
    { command: ["EXPIRE", key, String(expireSeconds)] },
  ]);

  const current = results[2] as number;
  const allowed = current <= maxRequests;

  // If not allowed, find how many ms until the oldest member leaves the window
  let retryAfterMs = 0;
  if (!allowed) {
    const oldest = await redisPipeline(redisUrl, redisToken, [
      { command: ["ZRANGE", key, "0", "0", "WITHSCORES"] },
    ]);
    const scores = oldest[0] as string[];
    if (scores && scores.length >= 2) {
      const oldestTs = parseInt(scores[1], 10);
      retryAfterMs = Math.max(0, oldestTs + windowMs - now);
    } else {
      retryAfterMs = windowMs;
    }
  }

  return { allowed, current, retryAfterMs };
}

// ---------------------------------------------------------------------------
// Edge Function entry point
// ---------------------------------------------------------------------------
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch (_e) {
    return new Response(JSON.stringify({ error: "Invalid JSON format" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

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
    // -----------------------------------------------------------------------
    // 1. Validate Upstash credentials
    // -----------------------------------------------------------------------
    const REDIS_URL = Deno.env.get("UPSTASH_REDIS_REST_URL");
    const REDIS_TOKEN = Deno.env.get("UPSTASH_REDIS_REST_TOKEN");
    if (!REDIS_URL || !REDIS_TOKEN) {
      console.error("Missing UPSTASH_REDIS_REST_URL or UPSTASH_REDIS_REST_TOKEN");
      return new Response(
        JSON.stringify({ error: "Rate limiter not configured" }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // -----------------------------------------------------------------------
    // 2. Authenticate the caller via Supabase JWT
    // -----------------------------------------------------------------------
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
      return new Response(
        JSON.stringify({ error: "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });

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

    const authRes = await supabase.auth.getUser(token);
    const authError = (authRes as Record<string, unknown>).error as unknown;
    const userData = (authRes as Record<string, unknown>).data as Record<string, unknown> | null;
    const user = userData?.user as Record<string, unknown> | null;
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // -----------------------------------------------------------------------
    // 3. Run sliding-window check via Upstash Redis
    // -----------------------------------------------------------------------
    const windowMs = (window_minutes as number) * 60 * 1000;
    const { allowed, current, retryAfterMs } = await checkRateLimit(
      REDIS_URL,
      REDIS_TOKEN,
      String(user.id),
      action_type,
      max_requests as number,
      windowMs
    );

    if (!allowed) {
      const retryAfterSeconds = Math.ceil(retryAfterMs / 1000);
      return new Response(
        JSON.stringify({
          allowed: false,
          message: "Rate limit exceeded",
          retry_after: retryAfterSeconds,
          current,
          limit: max_requests,
        }),
        {
          status: 429,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
            "Retry-After": String(retryAfterSeconds),
            "X-RateLimit-Limit": String(max_requests),
            "X-RateLimit-Remaining": "0",
          },
        }
      );
    }

    return new Response(
      JSON.stringify({
        allowed: true,
        current,
        limit: max_requests,
        remaining: Math.max(0, (max_requests as number) - current),
      }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
          "X-RateLimit-Limit": String(max_requests),
          "X-RateLimit-Remaining": String(Math.max(0, (max_requests as number) - current)),
        },
      }
    );
  } catch (e) {
    console.error("Error in rate-limit-check:", e);
    return new Response(JSON.stringify({ error: errMessage(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
