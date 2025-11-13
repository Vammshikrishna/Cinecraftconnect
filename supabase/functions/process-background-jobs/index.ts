// deno-lint-ignore-file
import { createClient } from "npm:@supabase/supabase-js@2.25.0";
import { corsHeaders } from "../_shared/cors.ts";

interface BackgroundJob {
  id: string;
  job_type: string;
  payload: any;
  attempts: number;
  max_attempts: number | null;
  // other columns as needed
}

// Helper to safe-stringify errors
const errMessage = (e: unknown) =>
  e instanceof Error ? e.message : typeof e === "string" ? e : JSON.stringify(e);

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Validate environment
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    return new Response(
      JSON.stringify({ error: "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Basic auth guard (optional if this function is internal)
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
    // Verify token belongs to a valid user (safe destructuring)
    const authRes = await supabase.auth.getUser(token);
    const user = (authRes as any).data?.user ?? null;
    const authErr = (authRes as any).error ?? null;
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized - invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // How many jobs to claim in this run
    const CLAIM_LIMIT = 10;

    // Call RPC to claim jobs atomically
    const rpcRes = await supabase.rpc("claim_background_jobs", { in_limit: CLAIM_LIMIT });
    const rpcError = (rpcRes as any).error ?? null;
    const jobs = (rpcRes as any).data ?? [];

    if (rpcError) {
      console.error("Error claiming jobs:", rpcError);
      return new Response(JSON.stringify({ error: rpcError.message ?? "Error claiming jobs" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!Array.isArray(jobs)) {
      // If the RPC returned a single row, coerce to array
      if (jobs) {
        // wrap single object into array
        // @ts-ignore
        jobs = [jobs];
      } else {
        // no jobs claimed
        return new Response(JSON.stringify({ processed: 0, results: [] }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const results: any[] = [];

    for (const job of jobs) {
      // Defensive checks
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

        // Mark completed and set completed_at
        const upd = await supabase
          .from("background_jobs")
          .update({ status: "completed", completed_at: new Date().toISOString() })
          .eq("id", jobId);

        if ((upd as any).error) {
          console.error("Error marking job completed:", (upd as any).error);
          results.push({ id: jobId, status: "error_updating", error: (upd as any).error.message });
        } else {
          results.push({ id: jobId, status: "completed" });
        }
      } catch (e) {
        const message = errMessage(e);
        console.error(`Error processing job ${jobId}:`, message);

        // Increment attempts, decide new status
        const newAttempts = attempts + 1;
        const newStatus = newAttempts >= maxAttempts ? "failed" : "pending";

        const updErr = await supabase
          .from("background_jobs")
          .update({
            status: newStatus,
            attempts: newAttempts,
            error_message: message,
            // optionally set next scheduled_at or exponential backoff
          })
          .eq("id", jobId);

        if ((updErr as any).error) {
          console.error("Error updating failed job status:", (updErr as any).error);
        }

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

/* ---------- Job handlers ---------- */

async function processNotificationJob(supabase: any, payload: any) {
  const userId = payload?.user_id;
  const notificationData = payload?.notification_data ?? {};
  if (!userId) throw new Error("Missing user_id in payload");

  const res = await supabase.from("notifications").insert({
    user_id: userId,
    ...notificationData,
    created_at: new Date().toISOString(),
  });

  if ((res as any).error) throw (res as any).error;
}

async function processAnalyticsJob(supabase: any, payload: any) {
  const date = payload?.date ?? new Date().toISOString().split("T")[0];
  const res = await supabase.rpc("calculate_daily_engagement_score", { target_date: date });
  if ((res as any).error) throw (res as any).error;
}

async function processCleanupJob(supabase: any, payload: any) {
  const daysOld = typeof payload?.days_old === "number" ? payload.days_old : 30;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - daysOld);
  const res = await supabase
    .from("rate_limits")
    .delete()
    .lt("created_at", cutoff.toISOString());
  if ((res as any).error) throw (res as any).error;
}