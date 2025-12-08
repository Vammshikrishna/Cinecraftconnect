// deno-lint-ignore-file
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

interface BackgroundJob {
  id: string;
  job_type: string;
  payload: Record<string, unknown>;
  attempts: number;
  max_attempts: number | null;
}

const errMessage = (e: unknown) =>
  e instanceof Error ? e.message : typeof e === "string" ? e : JSON.stringify(e);

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    return new Response(
      JSON.stringify({ error: "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const token = authHeader.replace("Bearer ", "").trim();
  if (!token) {
    return new Response(JSON.stringify({ error: "Unauthorized - empty token" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  try {
    const authRes = await supabase.auth.getUser(token);
    if (authRes.error || !authRes.data?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized - invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const CLAIM_LIMIT = 10;

    const rpcRes = await supabase.rpc("claim_background_jobs", { in_limit: CLAIM_LIMIT });
    
    if (rpcRes.error) {
      console.error("Error claiming jobs:", rpcRes.error);
      return new Response(JSON.stringify({ error: rpcRes.error.message ?? "Error claiming jobs" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let jobs = rpcRes.data as BackgroundJob[] | null;

    if (!Array.isArray(jobs)) {
      if (jobs) {
        jobs = [jobs as unknown as BackgroundJob];
      } else {
        return new Response(JSON.stringify({ processed: 0, results: [] }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const results: Array<{ id: string; status: string; error?: string }> = [];

    for (const job of jobs) {
      const jobId = job.id;
      const jobType = job.job_type;
      const payload = job.payload ?? {};
      const attempts = typeof job.attempts === "number" ? job.attempts : 0;
      const maxAttempts = job.max_attempts ?? 3;

      console.log(`Processing job ${jobId} type=${jobType} attempts=${attempts}`);

      try {
        switch (jobType) {
          case "send_notification":
            await processNotificationJob(supabase, payload);
            break;
          case "generate_analytics":
            await processAnalyticsJob(supabase, payload);
            break;
          case "cleanup_data":
            await processCleanupJob(supabase, payload);
            break;
          default:
            console.warn(`Unknown job type: ${jobType}`);
        }

        const upd = await supabase
          .from("background_jobs")
          .update({ status: "completed", completed_at: new Date().toISOString() })
          .eq("id", jobId);

        if (upd.error) {
          console.error("Error marking job completed:", upd.error);
          results.push({ id: jobId, status: "error_updating", error: upd.error.message });
        } else {
          results.push({ id: jobId, status: "completed" });
        }
      } catch (e) {
        const message = errMessage(e);
        console.error(`Error processing job ${jobId}:`, message);

        const newAttempts = attempts + 1;
        const newStatus = newAttempts >= maxAttempts ? "failed" : "pending";

        await supabase
          .from("background_jobs")
          .update({
            status: newStatus,
            attempts: newAttempts,
            error_message: message,
          })
          .eq("id", jobId);

        results.push({ id: jobId, status: "failed", error: message });
      }
    }

    return new Response(JSON.stringify({ processed: results.length, results }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Processor error:", e);
    return new Response(JSON.stringify({ error: errMessage(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

// deno-lint-ignore no-explicit-any
async function processNotificationJob(supabase: SupabaseClient<any>, payload: Record<string, unknown>) {
  const userId = payload?.user_id;
  const notificationData = (payload?.notification_data ?? {}) as Record<string, unknown>;
  if (!userId) throw new Error("Missing user_id in payload");

  const res = await supabase.from("notifications").insert({
    user_id: userId,
    ...notificationData,
    created_at: new Date().toISOString(),
  });

  if (res.error) throw res.error;
}

// deno-lint-ignore no-explicit-any
async function processAnalyticsJob(supabase: SupabaseClient<any>, payload: Record<string, unknown>) {
  const date = (payload?.date as string) ?? new Date().toISOString().split("T")[0];
  const res = await supabase.rpc("calculate_daily_engagement_score", { target_date: date });
  if (res.error) throw res.error;
}

// deno-lint-ignore no-explicit-any
async function processCleanupJob(supabase: SupabaseClient<any>, payload: Record<string, unknown>) {
  const daysOld = typeof payload?.days_old === "number" ? payload.days_old : 30;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - daysOld);
  const res = await supabase
    .from("rate_limits")
    .delete()
    .lt("created_at", cutoff.toISOString());
  if (res.error) throw res.error;
}
