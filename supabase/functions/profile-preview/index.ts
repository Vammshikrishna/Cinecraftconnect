// Link previews for shared profiles: returns a tiny HTML page with Open Graph / Twitter tags (what WhatsApp, X, Slack
// and Google read) and sends real visitors on to the app. Public: deploy with --no-verify-jwt.
//   https://<project>.supabase.co/functions/v1/profile-preview?u=<username or id>
// It reads with the ANON key, so the database rules apply: private, banned and blocked profiles show a generic card.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const APP_ORIGIN = (Deno.env.get("APP_ORIGIN") || "https://cinecraftconnect.com").replace(/\/$/, "");

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

const page = (title: string, description: string, image: string | null, target: string) => `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8"><title>${esc(title)}</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="description" content="${esc(description)}">
<meta property="og:type" content="profile"><meta property="og:site_name" content="CineCraft Connect">
<meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${esc(target)}">${image ? `<meta property="og:image" content="${esc(image)}">` : ""}
<meta name="twitter:card" content="${image ? "summary_large_image" : "summary"}">
<meta name="twitter:title" content="${esc(title)}"><meta name="twitter:description" content="${esc(description)}">${image ? `<meta name="twitter:image" content="${esc(image)}">` : ""}
<meta http-equiv="refresh" content="0; url=${esc(target)}">
<link rel="canonical" href="${esc(target)}">
</head><body><p>Opening <a href="${esc(target)}">${esc(title)}</a>…</p><script>location.replace(${JSON.stringify(target)});</script></body></html>`;

serve(async (req) => {
  const headers = { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "public, max-age=300" };
  const identifier = (new URL(req.url).searchParams.get("u") || "").trim().replace(/^@/, "");
  const generic = () => new Response(page("CineCraft Connect", "Connect with filmmakers, crew and studios.", null, APP_ORIGIN), { headers });
  if (!identifier || identifier.length > 80) return generic();

  try {
    const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!);
    const { data: id } = await db.rpc("resolve_profile_id", { p_identifier: identifier });
    if (!id) return generic();
    const { data: access } = await db.rpc("get_profile_access", { p_user: id });
    if (!access || access.state !== "ok") return generic();   // private / unavailable profiles get no preview details

    const { data: p } = await db.from("profiles").select("username, full_name, craft, location, bio, avatar_url").eq("id", id).maybeSingle();
    if (!p) return generic();
    const { data: h } = await db.from("profile_highlights").select("showreel_title").eq("user_id", id).maybeSingle();

    const name = p.full_name || p.username || "CineCraft member";
    const title = `${name}${p.craft ? ` | ${p.craft}` : ""} on CineCraft Connect`;
    const parts = [p.craft, p.location].filter(Boolean).join(" · ");
    const bio = (p.bio || "").replace(/\s+/g, " ").slice(0, 160);
    const description = [parts, h?.showreel_title ? `Showreel: ${h.showreel_title}` : "", bio].filter(Boolean).join(" — ") || "View this profile on CineCraft Connect.";
    return new Response(page(title, description, p.avatar_url || null, `${APP_ORIGIN}/profile/${encodeURIComponent(p.username || id)}`), { headers });
  } catch (_e) {
    return generic();
  }
});
