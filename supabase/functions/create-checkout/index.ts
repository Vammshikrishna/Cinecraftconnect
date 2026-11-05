// Starts a payment. Body, for a plan:     { "kind": "subscription", "plan_code": "creator_pro", "interval": "monthly", "provider": "razorpay" }
//                    for a product:  { "kind": "vendor_verification", "subject_id": "<vendor id>", "provider": "razorpay" }
//                                    { "kind": "marketplace_seller", "provider": "razorpay" }
//
// The app never sends a price. For a subscription the price comes from the plans table; for a sale the amount comes from
// the booking or quote on the server. This function:
//   1. checks the caller is signed in and that payments are switched on;
//   2. creates the order in the database (billing_create_order, which also refuses staff accounts);
//   3. asks the provider for a hosted checkout and returns its address.
// The order only becomes "paid" later, when the provider's webhook arrives (see billing-webhook).
//
// Required secrets: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY, SITE_URL, plus the provider's own.
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

  const rateLimit = await handleRateLimit(req, "create-checkout", 20, 60000);
  if (!rateLimit.allowed) return rateLimit.response!;

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "UNAUTHORIZED" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const siteUrl = Deno.env.get("SITE_URL") ?? "";
    if (!supabaseUrl || !serviceKey || !anonKey) return json({ error: "SERVER_CONFIG_ERROR" }, 500);

    const asUser = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } }, auth: { persistSession: false } });
    const { data: userData, error: userError } = await asUser.auth.getUser();
    if (userError || !userData.user) return json({ error: "UNAUTHORIZED" }, 401);
    const user = userData.user;

    const body = await req.json().catch(() => ({}));
    const kind = String(body.kind || "");
    const provider = getProvider(String(body.provider || ""));
    if (!provider) return json({ error: "UNKNOWN_PROVIDER" }, 400);
    const PRODUCT_KINDS = ["vendor_verification", "marketplace_seller"];
    if (kind !== "subscription" && !PRODUCT_KINDS.includes(kind)) {
      return json({ error: "UNSUPPORTED_KIND", message: "That cannot be bought yet." }, 400);
    }
    const interval = body.interval === "yearly" ? "yearly" : "monthly";

    const db = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

    // 2. the order, priced by the server
    const isProduct = PRODUCT_KINDS.includes(kind);
    const { data: orderId, error: orderError } = await db.rpc("billing_create_order", {
      p_kind: kind,
      p_buyer: user.id,
      p_seller: null,
      p_subject_id: isProduct && body.subject_id ? String(body.subject_id) : null,
      p_plan_code: isProduct ? null : String(body.plan_code || ""),
      p_interval: isProduct ? null : interval,
      p_product_code: isProduct ? kind : null,
    });
    if (orderError || !orderId) return json({ error: "ORDER_FAILED", message: orderError?.message ?? "Could not create the order." }, 400);

    const { data: order } = await db.from("orders").select("id, amount_minor, tax_minor, currency").eq("id", orderId).single();
    if (!order) return json({ error: "ORDER_FAILED" }, 500);

    // 3. the provider's hosted checkout
    const checkout = await provider.createCheckout({
      orderId: order.id,
      amountMinor: order.amount_minor + order.tax_minor,
      currency: order.currency,
      buyerId: user.id,
      buyerEmail: user.email ?? undefined,
      description: isProduct ? `CineCraft Connect ${kind.replace("_", " ")}` : `CineCraft Connect ${String(body.plan_code)} (${interval})`,
      returnUrl: isProduct ? `${siteUrl}${kind === "vendor_verification" ? "/vendors" : "/marketplace/hub"}?order=${order.id}` : `${siteUrl}/plans?order=${order.id}`,
      planCode: isProduct ? undefined : String(body.plan_code),
      interval: isProduct ? undefined : interval,
    });
    await db.from("orders").update({ provider: provider.id, provider_order_id: checkout.providerOrderId }).eq("id", order.id);

    return json({ orderId: order.id, checkoutUrl: checkout.checkoutUrl });
  } catch (e) {
    if (e instanceof ProviderNotConfigured) return json({ error: "PROVIDER_NOT_CONFIGURED", message: "Payments are not available yet." }, 503);
    return json({ error: "SERVER_ERROR" }, 500);
  }
});
