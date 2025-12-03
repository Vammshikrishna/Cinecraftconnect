// deno-lint-ignore-file
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
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
    const user = (authRes as Record<string, unknown>).data as Record<string, unknown> | null;
    const authErr = (authRes as Record<string, unknown>).error as unknown;
    if (authErr || !user?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized - invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const CLAIM_LIMIT = 10;

    const rpcRes = await supabase.rpc("claim_background_jobs", { in_limit: CLAIM_LIMIT });
    const rpcError = (rpcRes as Record<string, unknown>).error as Record<string, unknown> | null;
    let jobs = (rpcRes as Record<string, unknown>).data as BackgroundJob[] | null;

    if (rpcError) {
      console.error("Error claiming jobs:", rpcError);
      return new Response(JSON.stringify({ error: (rpcError.message as string) ?? "Error claiming jobs" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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

        const updError = (upd as Record<string, unknown>).error as Record<string, unknown> | null;
        if (updError) {
          console.error("Error marking job completed:", updError);
          results.push({ id: jobId, status: "error_updating", error: updError.message as string });
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

async function processNotificationJob(supabase: ReturnType<typeof createClient>, payload: Record<string, unknown>) {
  const userId = payload?.user_id;
  const notificationData = (payload?.notification_data ?? {}) as Record<string, unknown>;
  if (!userId) throw new Error("Missing user_id in payload");

  const res = await supabase.from("notifications").insert({
    user_id: userId,
    ...notificationData,
    created_at: new Date().toISOString(),
  });

  const error = (res as Record<string, unknown>).error;
  if (error) throw error;
}

async function processAnalyticsJob(supabase: ReturnType<typeof createClient>, payload: Record<string, unknown>) {
  const date = (payload?.date as string) ?? new Date().toISOString().split("T")[0];
  const res = await supabase.rpc("calculate_daily_engagement_score", { target_date: date });
  const error = (res as Record<string, unknown>).error;
  if (error) throw error;
}

async function processCleanupJob(supabase: ReturnType<typeof createClient>, payload: Record<string, unknown>) {
  const daysOld = typeof payload?.days_old === "number" ? payload.days_old : 30;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - daysOld);
  const res = await supabase
    .from("rate_limits")
    .delete()
    .lt("created_at", cutoff.toISOString());
  const error = (res as Record<string, unknown>).error;
  if (error) throw error;
}
