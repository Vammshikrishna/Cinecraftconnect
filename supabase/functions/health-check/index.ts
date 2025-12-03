// deno-lint-ignore-file
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  const checks: Record<string, unknown> = {
    timestamp: new Date().toISOString(),
    status: 'healthy',
    checks: {}
  };

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !supabaseKey) {
    const errBody = {
      status: 'unhealthy',
      error: 'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY'
    };
    return new Response(JSON.stringify(errBody), {
      status: 503,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } });
    const checksObj = checks.checks as Record<string, unknown>;

    // Database check
    try {
      const dbStart = Date.now();
      const dbRes = await supabase.from('profiles').select('id').limit(1);
      const dbError = (dbRes as Record<string, unknown>).error as Record<string, unknown> | null;
      checksObj.database = {
        status: dbError ? 'unhealthy' : 'healthy',
        responseTime: Date.now() - dbStart,
        error: dbError?.message ?? null
      };
      if (dbError) checks.status = 'unhealthy';
    } catch (err) {
      checksObj.database = {
        status: 'unhealthy',
        error: err instanceof Error ? err.message : String(err)
      };
      checks.status = 'unhealthy';
    }

    // Storage check
    try {
      const storageStart = Date.now();
      const storageRes = await supabase.storage.listBuckets();
      const storageError = (storageRes as Record<string, unknown>).error as Record<string, unknown> | null;
      const storageData = (storageRes as Record<string, unknown>).data as unknown[] | null;
      checksObj.storage = {
        status: storageError ? 'unhealthy' : 'healthy',
        responseTime: Date.now() - storageStart,
        buckets: Array.isArray(storageData) ? storageData.length : null,
        error: storageError?.message ?? null
      };
      if (storageError) checks.status = 'unhealthy';
    } catch (err) {
      checksObj.storage = {
        status: 'unhealthy',
        error: err instanceof Error ? err.message : String(err)
      };
      checks.status = 'unhealthy';
    }

    // Background jobs check
    try {
      const pendingRes = await supabase
        .from('background_jobs')
        .select('id', { count: 'exact', head: false })
        .eq('status', 'pending');
      const pendingError = (pendingRes as Record<string, unknown>).error as Record<string, unknown> | null;
      const pendingData = (pendingRes as Record<string, unknown>).data as unknown[] | null;
      const pendingCount = typeof (pendingRes as Record<string, unknown>).count === 'number'
        ? (pendingRes as Record<string, unknown>).count
        : Array.isArray(pendingData) ? pendingData.length : null;

      const failedRes = await supabase
        .from('background_jobs')
        .select('id', { count: 'exact', head: false })
        .eq('status', 'failed');
      const failedError = (failedRes as Record<string, unknown>).error as Record<string, unknown> | null;
      const failedData = (failedRes as Record<string, unknown>).data as unknown[] | null;
      const failedCount = typeof (failedRes as Record<string, unknown>).count === 'number'
        ? (failedRes as Record<string, unknown>).count
        : Array.isArray(failedData) ? failedData.length : null;

      if (pendingError || failedError) {
        checksObj.backgroundJobs = {
          status: 'unhealthy',
          error: pendingError?.message ?? failedError?.message ?? null
        };
        checks.status = 'unhealthy';
      } else {
        checksObj.backgroundJobs = {
          status: 'healthy',
          pendingCount,
          failedCount
        };
        if ((failedCount as number ?? 0) > 10) (checksObj.backgroundJobs as Record<string, unknown>).status = 'warning';
      }
    } catch (err) {
      checksObj.backgroundJobs = {
        status: 'unhealthy',
        error: err instanceof Error ? err.message : String(err)
      };
      checks.status = 'unhealthy';
    }

    checks.responseTime = Date.now() - startTime;

    return new Response(JSON.stringify(checks), {
      status: checks.status === 'healthy' ? 200 : 503,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({
      status: 'unhealthy',
      error: err instanceof Error ? err.message : String(err),
      timestamp: new Date().toISOString()
    }), {
      status: 503,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
