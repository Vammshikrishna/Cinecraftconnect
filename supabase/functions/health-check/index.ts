// deno-lint-ignore-file
// Health check edge function
import { createClient } from "npm:@supabase/supabase-js@2.25.0";
import { corsHeaders } from "../_shared/cors.ts";

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  const checks: any = {
    timestamp: new Date().toISOString(),
    status: 'healthy',
    checks: {}
  };

  // Validate env
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

    // Database check
    try {
      const dbStart = Date.now();
      // Use a lightweight query - limit 1
      const dbRes = await supabase.from('profiles').select('id').limit(1);
      const dbError = (dbRes as any).error ?? null;
      checks.checks.database = {
        status: dbError ? 'unhealthy' : 'healthy',
        responseTime: Date.now() - dbStart,
        error: dbError?.message ?? null
      };
      if (dbError) checks.status = 'unhealthy';
    } catch (err) {
      checks.checks.database = {
        status: 'unhealthy',
        error: err instanceof Error ? err.message : String(err)
      };
      checks.status = 'unhealthy';
    }

    // Storage check - list buckets
    try {
      const storageStart = Date.now();
      const storageRes = await supabase.storage.listBuckets();
      const storageError = (storageRes as any).error ?? null;
      const storageData = (storageRes as any).data ?? null;
      checks.checks.storage = {
        status: storageError ? 'unhealthy' : 'healthy',
        responseTime: Date.now() - storageStart,
        buckets: Array.isArray(storageData) ? storageData.length : null,
        error: storageError?.message ?? null
      };
      if (storageError) checks.status = 'unhealthy';
    } catch (err) {
      checks.checks.storage = {
        status: 'unhealthy',
        error: err instanceof Error ? err.message : String(err)
      };
      checks.status = 'unhealthy';
    }

    // Background jobs check - rely on count or data length depending on SDK
    try {
      // pending
      const pendingRes = await supabase
        .from('background_jobs')
        .select('id', { count: 'exact', head: false })
        .eq('status', 'pending');
      const pendingError = (pendingRes as any).error ?? null;
      const pendingData = (pendingRes as any).data ?? null;
      const pendingCount = typeof (pendingRes as any).count === 'number'
        ? (pendingRes as any).count
        : Array.isArray(pendingData) ? pendingData.length : null;

      // failed
      const failedRes = await supabase
        .from('background_jobs')
        .select('id', { count: 'exact', head: false })
        .eq('status', 'failed');
      const failedError = (failedRes as any).error ?? null;
      const failedData = (failedRes as any).data ?? null;
      const failedCount = typeof (failedRes as any).count === 'number'
        ? (failedRes as any).count
        : Array.isArray(failedData) ? failedData.length : null;

      if (pendingError || failedError) {
        checks.checks.backgroundJobs = {
          status: 'unhealthy',
          error: pendingError?.message ?? failedError?.message ?? null
        };
        checks.status = 'unhealthy';
      } else {
        checks.checks.backgroundJobs = {
          status: 'healthy',
          pendingCount,
          failedCount
        };
        if ((failedCount ?? 0) > 10) checks.checks.backgroundJobs.status = 'warning';
      }
    } catch (err) {
      checks.checks.backgroundJobs = {
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