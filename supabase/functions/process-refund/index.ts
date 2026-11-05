// Sends an approved refund to the payment provider. Body: { "refund_id": "<uuid>" }
//
// Only a signed-in admin can call it, and only for a refund that has already been approved (a large refund needs its second
// approver first, enforced in the database, not here). Steps:
//   1. claim the refund (approved -> processing). A second click cannot send it twice;
//   2. ask the provider to refund, passing our refund id as the reference so a retry is harmless;
//   3. on success tell the database (billing_apply_event) so the ledger and the order are updated and the buyer is told;
//      if the provider only accepted it, the provider's webhook completes it later through the same event;
//   4. on failure mark the refund failed, so an admin can retry it.
//
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

  const rateLimit = await handleRateLimit(req, "process-refund", 30, 60000);
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
    const refundId = String(body.refund_id || "");
    if (!refundId) return json({ error: "BAD_REQUEST" }, 400);

    const db = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

    // 1. claim (this also checks the caller is an admin and that the refund is approved)
    const { data: claim, error: claimError } = await db.rpc("billing_claim_refund", { p_refund_id: refundId, p_actor: u.user.id });
    if (claimError || !claim) return json({ error: "CANNOT_SEND", message: claimError?.message ?? "Could not send this refund." }, 400);

    const provider = getProvider(String(claim.provider));
    if (!provider) {
      await db.rpc("billing_fail_refund", { p_refund_id: refundId, p_error: "Unknown provider" });
      return json({ error: "UNKNOWN_PROVIDER" }, 400);
    }

    // 2. ask the provider
    try {
      const result = await provider.refund({
        refundId,
        providerPaymentId: String(claim.provider_payment_id),
        amountMinor: Number(claim.amount_minor),
        currency: String(claim.currency),
        reason: String(claim.reason ?? ""),
      });

      // 3. done on our side if the provider already finished it
      if (result.status === "processed") {
        await db.rpc("billing_apply_event", {
          p_event: {
            type: "refund.processed",
            order_id: claim.order_id,
            refund_request_id: refundId,
            provider: claim.provider,
            provider_refund_id: result.providerRefundId,
            amount_minor: claim.amount_minor,
          },
        });
      } else {
        await db.from("refunds").update({ provider_refund_id: result.providerRefundId }).eq("id", refundId);
      }
      return json({ ok: true, status: result.status });
    } catch (e) {
      // 4. failed: an admin can retry
      const message = e instanceof ProviderNotConfigured ? "No payment provider is connected yet." : (e as Error).message;
      await db.rpc("billing_fail_refund", { p_refund_id: refundId, p_error: message });
      return json({ error: "PROVIDER_FAILED", message }, e instanceof ProviderNotConfigured ? 503 : 502);
    }
  } catch (_e) {
    return json({ error: "SERVER_ERROR" }, 500);
  }
});
