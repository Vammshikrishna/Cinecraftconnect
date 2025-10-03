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

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get pending jobs
    const { data: jobs, error: fetchError } = await supabase
      .from('background_jobs')
      .select('*')
      .eq('status', 'pending')
      .lt('attempts', 3)
      .lte('scheduled_at', new Date().toISOString())
      .order('created_at', { ascending: true })
      .limit(10);

    if (fetchError) {
      console.error('Error fetching jobs:', fetchError);
      return new Response(JSON.stringify({ error: fetchError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const results = [];

    for (const job of jobs || []) {
      console.log(`Processing job ${job.id} of type ${job.job_type}`);
      
      // Mark as processing
      await supabase
        .from('background_jobs')
        .update({ status: 'processing', started_at: new Date().toISOString() })
        .eq('id', job.id);

      try {
        // Process different job types
        switch (job.job_type) {
          case 'send_notification':
            await processNotificationJob(supabase, job);
            break;
          case 'generate_analytics':
            await processAnalyticsJob(supabase, job);
            break;
          case 'cleanup_data':
            await processCleanupJob(supabase, job);
            break;
          default:
            console.log(`Unknown job type: ${job.job_type}`);
        }

        // Mark as completed
        await supabase
          .from('background_jobs')
          .update({ 
            status: 'completed', 
            completed_at: new Date().toISOString() 
          })
          .eq('id', job.id);

        results.push({ id: job.id, status: 'completed' });
      } catch (error) {
        console.error(`Error processing job ${job.id}:`, error);
        
        // Update with error
        await supabase
          .from('background_jobs')
          .update({ 
            status: job.attempts + 1 >= job.max_attempts ? 'failed' : 'pending',
            attempts: job.attempts + 1,
            error_message: error instanceof Error ? error.message : 'Unknown error'
          })
          .eq('id', job.id);

        results.push({ id: job.id, status: 'failed', error: error instanceof Error ? error.message : 'Unknown error' });
      }
    }

    return new Response(JSON.stringify({ processed: results.length, results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in background job processor:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

async function processNotificationJob(supabase: any, job: any) {
  const { user_id, notification_data } = job.payload;
  
  await supabase.from('notifications').insert({
    user_id,
    ...notification_data
  });
  
  console.log(`Notification sent to user ${user_id}`);
}

async function processAnalyticsJob(supabase: any, job: any) {
  const { date } = job.payload;
  
  // Calculate engagement scores
  await supabase.rpc('calculate_daily_engagement_score', {
    target_date: date || new Date().toISOString().split('T')[0]
  });
  
  console.log(`Analytics generated for ${date}`);
}

async function processCleanupJob(supabase: any, job: any) {
  const { days_old } = job.payload;
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - (days_old || 30));
  
  // Clean up old rate limits
  await supabase
    .from('rate_limits')
    .delete()
    .lt('created_at', cutoffDate.toISOString());
  
  console.log(`Cleanup completed for data older than ${days_old} days`);
}
