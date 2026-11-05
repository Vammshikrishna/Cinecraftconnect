import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

// Buckets that older code stored under "<folder>/<user id>/..." paths. Used only if the owner lookup below is not installed.
const LEGACY_BUCKETS = ["post-media", "portfolios", "support"];

type StoredObject = { bucket_id: string; name: string };

// Permanently deletes the CALLER's own account (auth user + cascading rows + their storage objects).
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
    const { data: authData, error: authError } = await supabase.auth.getUser(token);
    const user = authData?.user;
    if (authError || !user) return json({ error: "Unauthorized" }, 401);

    // The caller must re-type their own email as a deliberate confirmation.
    const { confirmEmail } = await req.json().catch(() => ({ confirmEmail: "" }));
    if (!user.email || String(confirmEmail || "").trim().toLowerCase() !== user.email.toLowerCase()) {
      return json({ error: "Email confirmation does not match" }, 400);
    }

    // 0. Some accounts cannot simply be erased: staff (their audit trail must stay), and anyone with money or legal
    //    records on file. Say so clearly instead of failing half way through.
    const { data: roleRows } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
    if ((roleRows ?? []).some((r: any) => ["moderator", "admin", "super_admin"].includes(String(r.role)))) {
      return json({ error: "Staff accounts cannot delete themselves here. Ask a Super Admin to remove your staff role first." }, 409);
    }
    for (const [table, column, what] of [
      ["payouts", "seller_id", "payout records"],
      ["payout_holds", "seller_id", "a payout hold"],
      ["legal_requests", "target_user_id", "a legal request"],
    ] as const) {
      try {
        const { count } = await supabase.from(table).select("id", { count: "exact", head: true }).eq(column, user.id);
        if ((count ?? 0) > 0) {
          return json({ error: `This account has ${what} on file that we must keep. Please contact support to close it.` }, 409);
        }
      } catch (_) { /* table not present: nothing to check */ }
    }

    // 1. Find every file this user uploaded, in every bucket (part_cn adds list_user_storage_objects, which reads the
    //    storage owner). Nothing is deleted yet, so a failed account deletion below leaves the files alone.
    let objects: StoredObject[] = [];
    let ownerLookupWorked = false;
    try {
      const { data, error } = await supabase.rpc("list_user_storage_objects", { p_user: user.id });
      if (!error && Array.isArray(data)) {
        objects = data as StoredObject[];
        ownerLookupWorked = true;
      }
    } catch (e) {
      console.warn("owner lookup unavailable, using the folder search:", e);
    }
    if (!ownerLookupWorked) {
      for (const bucket of LEGACY_BUCKETS) {
        try {
          const { data: folders } = await supabase.storage.from(bucket).list("", { limit: 1000 });
          for (const f of folders ?? []) {
            const { data: files } = await supabase.storage.from(bucket).list(`${f.name}/${user.id}`, { limit: 1000 });
            for (const x of files ?? []) {
              if (x.id) objects.push({ bucket_id: bucket, name: `${f.name}/${user.id}/${x.name}` });
            }
          }
        } catch (e) {
          console.warn(`storage listing skipped for ${bucket}:`, e);
        }
      }
    }

    // 2. Delete the account. Deleting the auth user cascades to profiles and every table that references it with
    //    ON DELETE CASCADE. If this fails, nothing else has been touched.
    const { error: delError } = await supabase.auth.admin.deleteUser(user.id);
    if (delError) return json({ error: delError.message }, 500);

    // 3. The account is gone: now remove its files (best effort, in small batches per bucket).
    const byBucket = new Map<string, string[]>();
    for (const o of objects) {
      if (!o?.bucket_id || !o?.name) continue;
      byBucket.set(o.bucket_id, [...(byBucket.get(o.bucket_id) ?? []), o.name]);
    }
    let removed = 0;
    let failed = 0;
    for (const [bucket, names] of byBucket) {
      for (let i = 0; i < names.length; i += 100) {
        const batch = names.slice(i, i + 100);
        try {
          const { error } = await supabase.storage.from(bucket).remove(batch);
          if (error) failed += batch.length;
          else removed += batch.length;
        } catch (e) {
          failed += batch.length;
          console.warn(`storage cleanup failed for ${bucket}:`, e);
        }
      }
    }
    if (failed > 0) console.warn(`delete-account: ${failed} file(s) could not be removed after the account was deleted`);

    return json({ success: true, filesRemoved: removed });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
