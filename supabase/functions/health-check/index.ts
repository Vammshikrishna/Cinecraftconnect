import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  const checks: any = {
    timestamp: new Date().toISOString(),
    status: 'healthy',
    checks: {}
  };

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Database check
    try {
      const dbStart = Date.now();
      const { error } = await supabase.from('profiles').select('id').limit(1);
      checks.checks.database = {
        status: error ? 'unhealthy' : 'healthy',
        responseTime: Date.now() - dbStart,
        error: error?.message
      };
    } catch (error) {
      checks.checks.database = {
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
      checks.status = 'unhealthy';
    }

    // Storage check
    try {
      const storageStart = Date.now();
      const { data, error } = await supabase.storage.listBuckets();
      checks.checks.storage = {
        status: error ? 'unhealthy' : 'healthy',
        responseTime: Date.now() - storageStart,
        buckets: data?.length || 0,
        error: error?.message
      };
    } catch (error) {
      checks.checks.storage = {
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }

    // Background jobs check
    try {
      const { data: pendingJobs, error } = await supabase
        .from('background_jobs')
        .select('id', { count: 'exact' })
        .eq('status', 'pending');
      
      const { data: failedJobs } = await supabase
        .from('background_jobs')
        .select('id', { count: 'exact' })
        .eq('status', 'failed');

      checks.checks.backgroundJobs = {
        status: 'healthy',
        pendingCount: pendingJobs?.length || 0,
        failedCount: failedJobs?.length || 0
      };

      if ((failedJobs?.length || 0) > 10) {
        checks.checks.backgroundJobs.status = 'warning';
      }
    } catch (error) {
      checks.checks.backgroundJobs = {
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }

    checks.responseTime = Date.now() - startTime;

    return new Response(JSON.stringify(checks), {
      status: checks.status === 'healthy' ? 200 : 503,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }), {
      status: 503,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
