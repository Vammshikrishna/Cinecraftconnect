// Lets a subscriber stop their plan renewing, or take that back. Body: { "action": "cancel" | "resume" }
//
// The person keeps what they paid for until the end of the period. Order of work, and why:
//   1. find their paid subscription (never trusts an id from the app);
//   2. tell the provider first, so the provider and our records can never disagree in the dangerous direction
//      (we never show "cancelled" while the provider would still charge);
//   3. then record it (billing_set_cancel_flag), which also writes an audit line.
//
// Changing to a different plan is a new purchase from the Plans page; the provider decides how the old plan is credited.
// Required secrets: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY, plus the provider's own.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.8";
import { corsHeaders } from "../_shared/cors.ts";
import { handleRateLimit } from "../_shared/rateLimit.ts";
import { getProvider } from "../_shared/billing/providers.ts";
import { ProviderNotConfigured } from "../_shared/billing/adapter.ts";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "METHOD_NOT_ALLOWED" }, 405);

  const rateLimit = await handleRateLimit(req, "manage-subscription", 10, 60000);
  if (!rateLimit.allowed) return rateLimit.response!;

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "UNAUTHORIZED" }, 401);
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    if (!supabaseUrl || !serviceKey || !anonKey) return json({ error: "SERVER_CONFIG_ERROR" }, 500);

    const asUser = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } }, auth: { persistSession: false } });
    const { data: u, error: ue } = await asUser.auth.getUser();
    if (ue || !u.user) return json({ error: "UNAUTHORIZED" }, 401);

    const body = await req.json().catch(() => ({}));
    const cancel = body.action === "cancel";
    if (body.action !== "cancel" && body.action !== "resume") return json({ error: "BAD_REQUEST" }, 400);

    const db = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

    // 1. their paid subscription
    const { data: sub } = await db.rpc("billing_my_provider_subscription", { p_user: u.user.id });
    if (!sub) return json({ error: "NO_SUBSCRIPTION", message: "You do not have a paid plan to change." }, 404);
    const provider = getProvider(String(sub.provider));
    if (!provider) return json({ error: "UNKNOWN_PROVIDER" }, 400);

    // 2. the provider first
    try {
      await provider.setCancelAtPeriodEnd(String(sub.provider_subscription_id), cancel);
    } catch (e) {
      if (e instanceof ProviderNotConfigured) return json({ error: "PROVIDER_NOT_CONFIGURED", message: "Payments are not available yet." }, 503);
      return json({ error: "PROVIDER_FAILED", message: "The payment provider could not change this. Please try again." }, 502);
    }

    // 3. then our records
    const { error } = await db.rpc("billing_set_cancel_flag", { p_user: u.user.id, p_cancel: cancel });
    if (error) return json({ error: "SERVER_ERROR" }, 500);
    return json({ ok: true, cancel_at_period_end: cancel });
  } catch (_e) {
    return json({ error: "SERVER_ERROR" }, 500);
  }
});
