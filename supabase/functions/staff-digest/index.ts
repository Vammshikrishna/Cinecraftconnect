// deno-lint-ignore-file
// Daily / weekly staff digest. Called by pg_cron (part_gi_6_schedule.sql) with { frequency: 'daily' | 'weekly' }.
// The repo had NO email provider, so this sends through Resend's HTTP API. Needs secrets:
//   STAFF_DIGEST_SECRET  shared with the database (app_settings key staff_digest_secret)
//   RESEND_API_KEY       a Resend API key (or change sendEmail() for another provider)
//   DIGEST_FROM          sender, e.g. "CineCraft <digest@yourdomain>" (the domain must be verified at the provider)
// Counts only: no names of members, no report or ticket text, no message content.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

const n = (v: unknown) => (typeof v === "number" ? v.toLocaleString("en-US") : "n/a");
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));

type Row = [string, unknown];
const section = (title: string, rows: Row[]) =>
  `<h3 style="margin:20px 0 6px;font-family:Georgia,serif;color:#c2410c">${esc(title)}</h3>` +
  `<table style="border-collapse:collapse;width:100%;font-family:Arial,sans-serif;font-size:14px">` +
  rows.map(([l, v]) => `<tr><td style="padding:4px 0;color:#444">${esc(l)}</td><td style="padding:4px 0;text-align:right;font-weight:bold">${n(v)}</td></tr>`).join("") +
  `</table>`;

/** which sections a person gets, by staff rank (1 moderator, 2 admin, 3 super admin) and the finance role */
export function buildSections(p: any, rank: number, finance: boolean): { title: string; rows: Row[] }[] {
  const out: { title: string; rows: Row[] }[] = [];
  const w = p.frequency === "daily" ? "today" : "this week";
  if (rank >= 3) {
    out.push({ title: "Platform", rows: [
      ["People on the platform", p.platform?.users_total], [`New ${w}`, p.platform?.users_new], [`Active ${w}`, p.platform?.users_active],
      [`Posts ${w}`, p.platform?.posts], ["Open incidents", p.platform?.incidents_open],
      ["Waiting for a second super admin", p.platform?.approvals_pending], ["Open Staff Watch alerts", p.platform?.staff_alerts_open],
    ] });
  }
  if (rank >= 2) {
    out.push({ title: "Support", rows: [["Open tickets", p.support?.tickets_open], ["SLA breaches", p.support?.sla_breaches], ["Oldest open ticket (hours)", p.support?.backlog_age_hours]] });
  }
  if (rank >= 1) {
    out.push({ title: "Trust and safety", rows: [["Open reports", p.trust?.reports_open], ["Escalations", p.trust?.escalations], ["Appeals open", p.trust?.appeals_open]] });
  }
  if (rank >= 2 || finance) {
    out.push({ title: "Finance", rows: [["Paying users", p.finance?.paying], ["Refunds waiting", p.finance?.refunds_pending]] });
  }
  return out;
}

export function renderEmail(p: any, name: string, rank: number, finance: boolean): string {
  const sections = buildSections(p, rank, finance);
  return `<div style="max-width:560px;margin:auto;padding:16px">` +
    `<h2 style="font-family:Georgia,serif;margin:0 0 4px">Your ${esc(p.frequency)} CineCraft digest</h2>` +
    `<p style="font-family:Arial,sans-serif;color:#666;font-size:13px;margin:0">Hello ${esc(name)}. Numbers only, no personal data.</p>` +
    sections.map((s) => section(s.title, s.rows)).join("") +
    `<p style="font-family:Arial,sans-serif;color:#888;font-size:12px;margin-top:24px">You get this because you opted in. Change it in Super admin &gt; Digests.</p></div>`;
}

async function sendEmail(to: string, subject: string, html: string): Promise<boolean> {
  const key = Deno.env.get("RESEND_API_KEY");
  const from = Deno.env.get("DIGEST_FROM");
  if (!key || !from) return false;
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to: [to], subject, html }),
  });
  return res.ok;
}

if (typeof Deno !== "undefined" && (Deno as any).serve) {
  Deno.serve(async (req: Request) => {
    if (req.method !== "POST") return json({ error: "POST only" }, 405);
    const secret = Deno.env.get("STAFF_DIGEST_SECRET");
    if (!secret || req.headers.get("x-digest-secret") !== secret) return json({ error: "Not allowed" }, 401);

    const url = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !serviceKey) return json({ error: "Missing project settings" }, 503);
    if (!Deno.env.get("RESEND_API_KEY") || !Deno.env.get("DIGEST_FROM")) return json({ error: "Email provider not configured (RESEND_API_KEY, DIGEST_FROM)" }, 503);

    let frequency = "daily";
    try { frequency = String((await req.json())?.frequency || "daily"); } catch { /* default */ }
    if (frequency !== "daily" && frequency !== "weekly") return json({ error: "Unknown frequency" }, 400);

    const db = createClient(url, serviceKey, { auth: { persistSession: false } });
    const { data, error } = await db.rpc("digest_payload", { p_frequency: frequency });
    if (error) return json({ error: "Could not build the digest" }, 500);

    const sent: string[] = [];
    for (const r of (data?.recipients || []) as any[]) {
      const ok = await sendEmail(r.email, `CineCraft ${frequency} digest`, renderEmail(data, r.name, r.rank, !!r.finance));
      if (ok) sent.push(r.user_id);
    }
    if (sent.length) await db.rpc("digest_mark_sent", { p_ids: sent });
    return json({ frequency, recipients: (data?.recipients || []).length, sent: sent.length });
  });
}
