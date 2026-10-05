import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

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

    // Remove the user's uploaded files (paths are prefixed with the user id by the upload helpers).
    for (const bucket of ["post-media", "portfolios", "support"]) {
      try {
        const { data: folders } = await supabase.storage.from(bucket).list("", { limit: 1000 });
        for (const f of folders ?? []) {
          const { data: files } = await supabase.storage.from(bucket).list(`${f.name}/${user.id}`, { limit: 1000 });
          const paths = (files ?? []).filter((x) => x.id).map((x) => `${f.name}/${user.id}/${x.name}`);
          if (paths.length) await supabase.storage.from(bucket).remove(paths);
        }
      } catch (e) {
        console.warn(`storage cleanup skipped for ${bucket}:`, e);
      }
    }

    // Deleting the auth user cascades to profiles and every table that references it with ON DELETE CASCADE.
    const { error: delError } = await supabase.auth.admin.deleteUser(user.id);
    if (delError) return json({ error: delError.message }, 500);

    return json({ success: true });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
