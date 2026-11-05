// Link previews for posts: fetches a web page on the server and returns its title, description and image.
//   body: { "url": "https://example.com/article" }  ->  { url, title, description, image, site }
// Needs a signed-in user. Deploy: supabase functions deploy link-preview
//
// Safety (this is a server fetching addresses chosen by users):
//  * only http/https, no credentials in the address, no localhost / private networks / IP literals / odd ports
//  * the host name is resolved and every resulting address must be public; redirects are followed by hand (max 3)
//    and each hop is checked again
//  * 4 second timeout, at most 512 KB of HTML is read, only text/html is parsed
//  * results are cached for 30 minutes; 20 requests a minute per person
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { handleRateLimit } from "../_shared/rateLimit.ts";

const MAX_BYTES = 512 * 1024;
const TIMEOUT_MS = 4000;
const CACHE_MS = 30 * 60 * 1000;
const CACHE_MAX = 300;
const cache = new Map<string, { at: number; body: string }>();

const json = (body: unknown, status = 200) =>
  new Response(typeof body === "string" ? body : JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const isPrivateV4 = (a: number, b: number, c: number): boolean =>
  a === 0 || a === 10 || a === 127 || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) ||
  (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 192 && b === 0 && c === 0) ||
  (a === 198 && (b === 18 || b === 19)) || a >= 224;

/** IPv6 text to its 16 bytes (handles "::" and an embedded dotted IPv4); null when it is not a valid address */
const parseIPv6 = (input: string): number[] | null => {
  let s = input.toLowerCase().split("%")[0];
  const v4 = s.match(/(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  let tail: number[] = [];
  if (v4) {
    tail = [v4[1], v4[2], v4[3], v4[4]].map(Number);
    if (tail.some((n) => n > 255)) return null;
    s = s.slice(0, s.length - v4[0].length) + "0:0";
  }
  const halves = s.split("::");
  if (halves.length > 2) return null;
  const groupsOf = (part: string) => (part === "" ? [] : part.split(":"));
  const head = groupsOf(halves[0]);
  const rest = halves.length === 2 ? groupsOf(halves[1]) : [];
  if (halves.length === 1 && head.length !== 8) return null;
  const fill = 8 - head.length - rest.length;
  if (fill < 0) return null;
  const groups = [...head, ...Array(fill).fill("0"), ...rest];
  if (groups.length !== 8) return null;
  const bytes: number[] = [];
  for (const g of groups) {
    if (!/^[0-9a-f]{1,4}$/.test(g)) return null;
    const v = parseInt(g, 16);
    bytes.push(v >> 8, v & 255);
  }
  if (v4) bytes.splice(12, 4, ...tail);
  return bytes;
};

const isPrivateIp = (ip: string): boolean => {
  if (ip.includes(":")) {
    const b = parseIPv6(ip);
    if (!b) return true;
    const first12Zero = b.slice(0, 12).every((x) => x === 0);
    const v4Part = () => isPrivateV4(b[12], b[13], b[14]);
    if (b.slice(0, 15).every((x) => x === 0)) return true; // :: and ::1
    if (first12Zero) return v4Part(); // IPv4-compatible
    if (b.slice(0, 10).every((x) => x === 0) && b[10] === 0xff && b[11] === 0xff) return v4Part(); // IPv4-mapped (::ffff:a.b.c.d and ::ffff:7f00:1)
    if (b[0] === 0x00 && b[1] === 0x64 && b[2] === 0xff && b[3] === 0x9b) return b.slice(4, 12).every((x) => x === 0) ? v4Part() : true; // NAT64
    if (b[0] === 0x20 && b[1] === 0x02) return isPrivateV4(b[2], b[3], b[4]); // 6to4
    if (b[0] === 0x20 && b[1] === 0x01 && b[2] === 0x00 && b[3] === 0x00) return true; // Teredo
    if (b[0] === 0x20 && b[1] === 0x01 && b[2] === 0x0d && b[3] === 0xb8) return true; // documentation
    if ((b[0] & 0xfe) === 0xfc) return true; // fc00::/7 unique local
    if (b[0] === 0xfe && (b[1] & 0xc0) === 0x80) return true; // fe80::/10 link local
    if (b[0] === 0xfe && (b[1] & 0xc0) === 0xc0) return true; // fec0::/10 site local
    if (b[0] === 0xff) return true; // multicast
    if (b[0] === 0x01 && b[1] === 0x00 && b.slice(2, 8).every((x) => x === 0)) return true; // 100::/64 discard
    return false;
  }
  const p = ip.split(".").map(Number);
  if (p.length !== 4 || p.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return true;
  return isPrivateV4(p[0], p[1], p[2]);
};

const resolveAll = async (host: string): Promise<string[]> => {
  const addresses: string[] = [];
  for (const type of ["A", "AAAA"] as const) {
    try { addresses.push(...(await Deno.resolveDns(host, type))); } catch { /* no records of this type */ }
  }
  return addresses;
};

/** throws when the address must not be fetched */
const assertPublic = async (raw: string): Promise<URL> => {
  const u = new URL(raw);
  if (u.protocol !== "https:" && u.protocol !== "http:") throw new Error("Only web links");
  if (u.username || u.password) throw new Error("Links with credentials are not allowed");
  if (u.port && u.port !== "80" && u.port !== "443") throw new Error("That port is not allowed");
  const host = u.hostname.toLowerCase();
  if (host === "localhost" || host.endsWith(".local") || host.endsWith(".internal") || host.endsWith(".localhost")) throw new Error("Not a public address");
  if (/^[\d.]+$/.test(host) || host.includes(":") || host.startsWith("[")) throw new Error("IP addresses are not allowed");
  const addresses = await resolveAll(host);
  if (addresses.length === 0) throw new Error("Could not find that site");
  if (addresses.some(isPrivateIp)) throw new Error("Not a public address");
  return u;
};

const decode = (s: string) =>
  s.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&#x27;/g, "'").replace(/\s+/g, " ").trim();

const meta = (html: string, keys: string[]): string => {
  for (const key of keys) {
    const re1 = new RegExp(`<meta[^>]+(?:property|name)=["']${key}["'][^>]*content=["']([^"']*)["']`, "i");
    const re2 = new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]*(?:property|name)=["']${key}["']`, "i");
    const m = re1.exec(html) || re2.exec(html);
    if (m && m[1].trim()) return decode(m[1]);
  }
  return "";
};

const readLimited = async (res: Response): Promise<string> => {
  const reader = res.body?.getReader();
  if (!reader) return "";
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (total < MAX_BYTES) {
    const { done, value } = await reader.read();
    if (done || !value) break;
    chunks.push(value);
    total += value.length;
  }
  try { await reader.cancel(); } catch { /* already closed */ }
  const all = new Uint8Array(total);
  let off = 0;
  for (const c of chunks) { all.set(c, off); off += c.length; }
  return new TextDecoder("utf-8", { fatal: false }).decode(all);
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Use POST" }, 405);

  const auth = req.headers.get("Authorization");
  if (!auth) return json({ error: "Sign in first" }, 401);
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: auth } } });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return json({ error: "Sign in first" }, 401);

  const rl = await handleRateLimit(req, "link-preview", 20, 60_000);
  if (!rl.allowed && rl.response) return rl.response;

  let body: any = {};
  try { body = await req.json(); } catch { /* empty */ }
  const requested = typeof body.url === "string" ? body.url.trim() : "";
  if (!requested || requested.length > 2048) return json({ error: "Send a url" }, 400);

  const hit = cache.get(requested);
  if (hit && Date.now() - hit.at < CACHE_MS) return json(hit.body);

  try {
    let current = requested;
    let res: Response | null = null;
    for (let hop = 0; hop < 4; hop++) {
      const u = await assertPublic(current);
      const ctl = new AbortController();
      const timer = setTimeout(() => ctl.abort(), TIMEOUT_MS);
      try {
        res = await fetch(u.toString(), {
          redirect: "manual",
          signal: ctl.signal,
          headers: { "User-Agent": "CineCraftConnectBot/1.0 (link preview)", Accept: "text/html,application/xhtml+xml" },
        });
      } finally {
        clearTimeout(timer);
      }
      // The name is resolved again after the request. If it now points at a private address (DNS rebinding),
      // the answer is thrown away instead of being returned to the user.
      if ((await resolveAll(u.hostname.toLowerCase())).some(isPrivateIp)) throw new Error("Not a public address");
      if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
        current = new URL(res.headers.get("location")!, u).toString();
        res = null;
        continue;
      }
      break;
    }
    if (!res || !res.ok) return json({ error: "No preview" });
    const type = res.headers.get("content-type") || "";
    if (!/text\/html|application\/xhtml/i.test(type)) return json({ error: "No preview" });

    const html = await readLimited(res);
    const finalUrl = new URL(current);
    const title = meta(html, ["og:title", "twitter:title"]) || decode((/<title[^>]*>([^<]*)<\/title>/i.exec(html) || [])[1] || "");
    if (!title) return json({ error: "No preview" });
    const description = meta(html, ["og:description", "twitter:description", "description"]);
    let image = meta(html, ["og:image", "og:image:url", "twitter:image"]);
    if (image) {
      try {
        const iu = new URL(image, finalUrl);
        image = iu.protocol === "https:" ? iu.toString() : "";
      } catch { image = ""; }
    }
    const out = JSON.stringify({
      url: requested,
      title: title.slice(0, 200),
      description: description.slice(0, 300),
      image: image || null,
      site: (meta(html, ["og:site_name"]) || finalUrl.hostname.replace(/^www\./, "")).slice(0, 100),
    });
    if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value as string);
    cache.set(requested, { at: Date.now(), body: out });
    return json(out);
  } catch {
    return json({ error: "No preview" });
  }
});
