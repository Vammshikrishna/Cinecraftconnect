// Place search for the "Add location" box, so the apps do not call OpenStreetMap's public Nominatim service directly
// (its usage policy asks for an identifying User-Agent, at most 1 request a second, and caching).
//   body: { "q": "mumbai" }                    -> search (up to 6 results)
//         { "lat": 19.07, "lon": 72.87 }       -> reverse (the place for a GPS position)
// Needs a signed-in user. Deploy: supabase functions deploy geocode
// Optional secret: GEOCODE_CONTACT (an e-mail or URL for the User-Agent, as Nominatim asks)
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { handleRateLimit } from "../_shared/rateLimit.ts";

const CONTACT = Deno.env.get("GEOCODE_CONTACT") || "https://cinecraftconnect.com";
const cache = new Map<string, { at: number; body: string }>();
const CACHE_MS = 10 * 60 * 1000;
const CACHE_MAX = 300;
let lastCall = 0; // one request a second to Nominatim, whatever the number of visitors

const json = (body: unknown, status = 200, extra: Record<string, string> = {}) =>
  new Response(typeof body === "string" ? body : JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json", ...extra },
  });

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Use POST" }, 405);

  const auth = req.headers.get("Authorization");
  if (!auth) return json({ error: "Sign in first" }, 401);
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: auth } } });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return json({ error: "Sign in first" }, 401);

  const rl = await handleRateLimit(req, "geocode", 30, 60_000);
  if (!rl.allowed && rl.response) return rl.response;

  let body: any = {};
  try { body = await req.json(); } catch { /* empty body */ }

  let url: string;
  if (typeof body.q === "string") {
    const q = body.q.replace(/\s+/g, " ").trim();
    if (q.length < 2 || q.length > 100) return json([]);
    url = `https://nominatim.openstreetmap.org/search?format=json&limit=6&addressdetails=1&q=${encodeURIComponent(q)}`;
  } else if (Number.isFinite(body.lat) && Number.isFinite(body.lon) && Math.abs(body.lat) <= 90 && Math.abs(body.lon) <= 180) {
    // rounded: the same neighbourhood shares one cached answer
    url = `https://nominatim.openstreetmap.org/reverse?format=json&addressdetails=1&lat=${body.lat.toFixed(3)}&lon=${body.lon.toFixed(3)}`;
  } else {
    return json({ error: "Send q, or lat and lon" }, 400);
  }

  const hit = cache.get(url);
  if (hit && Date.now() - hit.at < CACHE_MS) return json(hit.body, 200, { "X-Cache": "hit" });

  const wait = 1000 - (Date.now() - lastCall);
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastCall = Date.now();

  try {
    const res = await fetch(url, { headers: { "User-Agent": `CineCraftConnect/1.0 (${CONTACT})`, "Accept-Language": req.headers.get("Accept-Language") || "en" } });
    if (!res.ok) return json({ error: "The place service is busy. Try again in a moment." }, 502);
    const text = await res.text();
    if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value as string);
    cache.set(url, { at: Date.now(), body: text });
    return json(text);
  } catch {
    return json({ error: "Could not reach the place service." }, 502);
  }
});
