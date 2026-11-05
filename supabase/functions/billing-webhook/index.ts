// Receives a payment provider's webhooks: /billing-webhook?provider=razorpay
//
// What it does, in order, and why:
//   1. Refuses unless payments are switched on, so a stray call can never change anything while the app is in beta.
//   2. Reads the RAW body and lets the provider's adapter verify the signature. A wrong signature is a 400 and nothing is stored.
//   3. Stores the event once (provider + event id are unique). A replay of an event that was already applied is answered
//      "duplicate" and does nothing; an event that was stored but failed to apply is applied again on the provider's retry.
//   4. Hands the normalised event to billing_apply_event, the single database function that moves orders, the ledger
//      and subscriptions. It is safe to call twice.
//   5. Any failure after step 3 returns 500 so the provider retries; step 3 and 4 make the retry harmless.
//
// Required secrets: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, plus the provider's own (see _shared/billing/providers.ts).
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.8";
import { getProvider } from "../_shared/billing/providers.ts";
import { ProviderNotConfigured } from "../_shared/billing/adapter.ts";

const text = (body: string, status: number) => new Response(body, { status, headers: { "Content-Type": "text/plain" } });

serve(async (req) => {
  if (req.method !== "POST") return text("method not allowed", 405);

  const url = new URL(req.url);
  const provider = getProvider(url.searchParams.get("provider"));
  if (!provider) return text("unknown provider", 404);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) return text("server not configured", 500);
  const db = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

  // 1. payments must be on
  const { data: flag } = await db.from("platform_settings").select("value").eq("key", "payments_enabled").maybeSingle();
  if (!flag || flag.value !== true) return text("payments are not enabled", 503);

  // 2. verify and translate
  const raw = await req.text();
  let parsed;
  try {
    parsed = await provider.verifyAndParseWebhook(raw, req.headers);
  } catch (e) {
    if (e instanceof ProviderNotConfigured) return text("provider not configured", 503);
    return text("invalid webhook", 400);
  }

  // 3. store once. A replay of an event that was already APPLIED is answered "duplicate". An event that was stored but
  //    failed to apply (processed_at still empty) is applied again when the provider retries, otherwise it would be lost.
  const { data: stored, error: insertError } = await db
    .from("provider_events")
    .upsert(
      { provider: provider.id, event_id: parsed.eventId, event_type: parsed.eventType, payload: parsed.payload },
      { onConflict: "provider,event_id", ignoreDuplicates: true },
    )
    .select("id");
  if (insertError) return text("could not store the event", 500);
  let eventRowId: string | null = stored && stored.length > 0 ? stored[0].id : null;
  if (!eventRowId) {
    const { data: existing, error: lookupError } = await db
      .from("provider_events")
      .select("id, processed_at")
      .eq("provider", provider.id)
      .eq("event_id", parsed.eventId)
      .maybeSingle();
    if (lookupError || !existing) return text("could not look up the event", 500);
    if (existing.processed_at) return text("duplicate", 200);
    eventRowId = existing.id; // stored earlier but never applied: try again now
  }

  // 4. apply
  if (!parsed.event) {
    await db.from("provider_events").update({ result: "ignored", processed_at: new Date().toISOString() }).eq("id", eventRowId);
    return text("ignored", 200);
  }
  const { data: result, error: applyError } = await db.rpc("billing_apply_event", { p_event: parsed.event });
  if (applyError) {
    await db.from("provider_events").update({ result: `error: ${applyError.message}`.slice(0, 300) }).eq("id", eventRowId);
    return text("could not apply the event", 500); // the provider will retry
  }
  await db.from("provider_events").update({ result: String(result), processed_at: new Date().toISOString() }).eq("id", eventRowId);
  return text(String(result), 200);
});
