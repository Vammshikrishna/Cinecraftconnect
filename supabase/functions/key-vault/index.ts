// Key vault for the encrypted-chat PIN backup.
//   POST { action: "setup",  proof }  -> registers the check value for the signed-in person, returns { pepper }
//   POST { action: "unlock", proof }  -> checks one PIN try; on success returns { pepper }
//        wrong try   -> 401 { error: "WRONG_PIN", attemptsLeft }
//        too many    -> 429 { error: "LOCKED", retryAfterSeconds }   (10 wrong tries = 1 hour)
//        no backup   -> 404 { error: "NO_VAULT" }
//
// "proof" is a value the app derives from the PIN (it is not the PIN, and not the key that encrypts the backup).
// The pepper is derived from KEY_VAULT_SECRET, an Edge Function secret that is NOT stored in the database, so a copy of
// the database alone cannot be used to open backups.
//
// Required secrets: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, KEY_VAULT_SECRET (at least 32 random characters).
// Deploy: supabase functions deploy key-vault   (after SQL part_cs)
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const MAX_FAILS = 10;
const LOCK_SECONDS = 3600;
const PROOF_RE = /^[A-Za-z0-9+/]{43}=$/; // base64 of 32 bytes

const toB64 = (buf: ArrayBuffer) => {
  let s = "";
  for (const b of new Uint8Array(buf)) s += String.fromCharCode(b);
  return btoa(s);
};

const hmac = async (secret: string, message: string): Promise<ArrayBuffer> => {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "METHOD_NOT_ALLOWED" }, 405);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const master = Deno.env.get("KEY_VAULT_SECRET");
    if (!supabaseUrl || !serviceKey || !master || master.length < 32) {
      console.error("[key-vault] not configured: set KEY_VAULT_SECRET (32+ characters)");
      return json({ error: "NOT_CONFIGURED" }, 503);
    }

    const bearer = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "").trim();
    if (!bearer) return json({ error: "UNAUTHORIZED" }, 401);
    const admin = createClient(supabaseUrl, serviceKey);
    const { data: userData, error: authErr } = await admin.auth.getUser(bearer);
    if (authErr || !userData?.user) return json({ error: "UNAUTHORIZED" }, 401);
    const userId = userData.user.id;

    const body = await req.json().catch(() => ({}));
    const action = String(body.action || "");
    const proof = String(body.proof || "");
    if (!["setup", "unlock"].includes(action) || !PROOF_RE.test(proof)) return json({ error: "BAD_REQUEST" }, 400);

    // The check value is keyed with the server secret, so the stored value cannot be used to test PIN guesses offline.
    const verifier = toB64(await hmac(master, `verify|${userId}|${proof}`));
    const pepper = toB64(await hmac(master, `pepper|${userId}`));

    if (action === "setup") {
      const { error } = await admin.rpc("key_vault_setup", { p_user: userId, p_verifier: verifier });
      if (error) {
        console.error("[key-vault] setup failed:", error.message);
        return json({ error: "UNAVAILABLE" }, 500);
      }
      return json({ pepper });
    }

    const { data, error } = await admin.rpc("key_vault_try", {
      p_user: userId,
      p_verifier: verifier,
      p_max_fails: MAX_FAILS,
      p_lock_seconds: LOCK_SECONDS,
    });
    if (error || !data) {
      console.error("[key-vault] try failed:", error?.message);
      return json({ error: "UNAVAILABLE" }, 500);
    }
    switch (data.status) {
      case "ok":
        return json({ pepper });
      case "locked":
        return json({ error: "LOCKED", retryAfterSeconds: data.retry_after ?? LOCK_SECONDS }, 429);
      case "wrong":
        if (data.attempts_left === 0) return json({ error: "LOCKED", retryAfterSeconds: data.retry_after ?? LOCK_SECONDS }, 429);
        return json({ error: "WRONG_PIN", attemptsLeft: data.attempts_left }, 401);
      case "none":
        return json({ error: "NO_VAULT" }, 404);
      default:
        return json({ error: "UNAVAILABLE" }, 500);
    }
  } catch (e) {
    console.error("[key-vault] error:", e);
    return json({ error: "UNAVAILABLE" }, 500);
  }
});
