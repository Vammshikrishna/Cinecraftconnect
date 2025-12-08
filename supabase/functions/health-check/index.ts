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
      checksObj.database = {
        status: dbRes.error ? 'unhealthy' : 'healthy',
        responseTime: Date.now() - dbStart,
        error: dbRes.error?.message ?? null
      };
      if (dbRes.error) checks.status = 'unhealthy';
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
      checksObj.storage = {
        status: storageRes.error ? 'unhealthy' : 'healthy',
        responseTime: Date.now() - storageStart,
        buckets: Array.isArray(storageRes.data) ? storageRes.data.length : null,
        error: storageRes.error?.message ?? null
      };
      if (storageRes.error) checks.status = 'unhealthy';
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
      
      const pendingCount = pendingRes.count ?? (Array.isArray(pendingRes.data) ? pendingRes.data.length : null);

      const failedRes = await supabase
        .from('background_jobs')
        .select('id', { count: 'exact', head: false })
        .eq('status', 'failed');
      
      const failedCount = failedRes.count ?? (Array.isArray(failedRes.data) ? failedRes.data.length : null);

      if (pendingRes.error || failedRes.error) {
        checksObj.backgroundJobs = {
          status: 'unhealthy',
          error: pendingRes.error?.message ?? failedRes.error?.message ?? null
        };
        checks.status = 'unhealthy';
      } else {
        checksObj.backgroundJobs = {
          status: 'healthy',
          pendingCount,
          failedCount
        };
        if ((failedCount ?? 0) > 10) (checksObj.backgroundJobs as Record<string, unknown>).status = 'warning';
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
