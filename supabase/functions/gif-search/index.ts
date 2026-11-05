// GIF search for the post composer (GIPHY). The key never leaves the server.
//   body: { "q": "celebrate", "limit": 24 }   (empty q = trending)
//   -> { items: [{ id, title, url, preview, width, height }] }
// Needs a signed-in user and the secret GIPHY_API_KEY:  supabase secrets set GIPHY_API_KEY=...
// Without the key it answers 501 { error: "not_configured" } and the apps show "GIFs are not set up yet".
// Deploy: supabase functions deploy gif-search
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { handleRateLimit } from "../_shared/rateLimit.ts";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const cache = new Map<string, { at: number; body: unknown }>();
const CACHE_MS = 5 * 60 * 1000;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Use POST" }, 405);

  const key = Deno.env.get("GIPHY_API_KEY");
  if (!key) return json({ error: "not_configured" }, 501);

  const auth = req.headers.get("Authorization");
  if (!auth) return json({ error: "Sign in first" }, 401);
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: auth } } });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return json({ error: "Sign in first" }, 401);

  const rl = await handleRateLimit(req, "gif-search", 40, 60_000);
  if (!rl.allowed && rl.response) return rl.response;

  let body: any = {};
  try { body = await req.json(); } catch { /* empty */ }
  const q = typeof body.q === "string" ? body.q.replace(/\s+/g, " ").trim().slice(0, 60) : "";
  const limit = Math.min(Math.max(parseInt(body.limit, 10) || 24, 1), 30);

  const cacheKey = `${q}|${limit}`;
  const hit = cache.get(cacheKey);
  if (hit && Date.now() - hit.at < CACHE_MS) return json(hit.body);

  const endpoint = q ? "search" : "trending";
  const url = `https://api.giphy.com/v1/gifs/${endpoint}?api_key=${encodeURIComponent(key)}&limit=${limit}&rating=pg-13&bundle=messaging_non_clips${q ? `&q=${encodeURIComponent(q)}` : ""}`;
  try {
    const res = await fetch(url);
    if (!res.ok) return json({ error: "failed" }, 502);
    const data = await res.json();
    const items = (data.data || []).map((g: any) => ({
      id: g.id,
      title: g.title || "GIF",
      url: g.images?.downsized_medium?.url || g.images?.original?.url,
      preview: g.images?.fixed_width_small?.url || g.images?.fixed_width?.url,
      width: Number(g.images?.downsized_medium?.width || g.images?.original?.width) || 0,
      height: Number(g.images?.downsized_medium?.height || g.images?.original?.height) || 0,
    })).filter((g: any) => g.url && g.preview);
    const out = { items };
    if (cache.size > 100) cache.delete(cache.keys().next().value as string);
    cache.set(cacheKey, { at: Date.now(), body: out });
    return json(out);
  } catch {
    return json({ error: "failed" }, 502);
  }
});
