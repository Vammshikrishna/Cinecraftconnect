import { corsHeaders } from "./cors.ts";

/**
 * Sliding window rate limit checker using Deno KV.
 * Decides whether a request is allowed and provides appropriate X-RateLimit headers.
 */
export async function handleRateLimit(
  req: Request,
  action: string,
  limit = 60,
  windowMs = 60000 // 1 minute default
): Promise<{
  allowed: boolean;
  headers: Record<string, string>;
  response?: Response;
}> {
  // 1. Resolve identifier (User ID from authorization or fallback to IP address)
  const authHeader = req.headers.get("authorization");
  let identifier = "anonymous";
  if (authHeader) {
    identifier = authHeader.replace("Bearer ", "").trim().slice(-30);
  } else {
    identifier = req.headers.get("cf-connecting-ip") || req.headers.get("x-forwarded-for") || "global";
  }

  const key = ["rate-limit", action, identifier];

  try {
    // Open native Deno Key-Value store
    const kv = await Deno.openKv();
    const now = Date.now();
    const windowStart = now - windowMs;

    // Retrieve active timestamps
    const entry = await kv.get<number[]>(key);
    const timestamps = entry.value || [];

    // Filter out expired entries
    const activeTimestamps = timestamps.filter((ts) => ts > windowStart);
    const currentCount = activeTimestamps.length;
    const remaining = Math.max(0, limit - currentCount);

    // Calculate reset and retry indicators
    const oldestTs = activeTimestamps[0] || now;
    const resetTime = Math.ceil((oldestTs + windowMs) / 1000);

    const headers = {
      "X-RateLimit-Limit": String(limit),
      "X-RateLimit-Remaining": String(remaining),
      "X-RateLimit-Reset": String(resetTime),
    };

    if (currentCount >= limit) {
      const retryAfter = Math.ceil((oldestTs + windowMs - now) / 1000);
      return {
        allowed: false,
        headers: {
          ...headers,
          "Retry-After": String(retryAfter),
        },
        response: new Response(
          JSON.stringify({ error: "Too many requests. Please try again later." }),
          {
            status: 429,
            headers: {
              ...corsHeaders,
              ...headers,
              "Content-Type": "application/json",
              "Retry-After": String(retryAfter),
            },
          }
        ),
      };
    }

    // Record request and update DB
    activeTimestamps.push(now);
    await kv.set(key, activeTimestamps, { expireIn: windowMs });

    return {
      allowed: true,
      headers,
    };
  } catch (err) {
    console.error("Deno KV Rate Limiter Error:", err);
    // Fail open if KV is unavailable so we do not block legitimate requests
    return {
      allowed: true,
      headers: {
        "X-RateLimit-Limit": String(limit),
        "X-RateLimit-Remaining": String(limit),
      },
    };
  }
}
