import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1"

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { record, table, type } = await req.json();

    console.log(`[VIDEO TRANSCODER] Received trigger for table: ${table}, type: ${type}`);

    // If it's a new video post insertion or portfolio upload
    if (table === 'posts' && type === 'INSERT' && record.media_url?.includes('.mp4')) {
      console.log(`[VIDEO TRANSCODER] Processing post video: ${record.media_url}`);
      
      // Here you would call a transcoding API like Mux, Cloudinary, or Cococonvert.
      // Example call to Mux to create an asset:
      /*
      const response = await fetch('https://api.mux.com/video/v1/assets', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Basic ${btoa(MUX_TOKEN_ID + ':' + MUX_TOKEN_SECRET)}`
        },
        body: JSON.stringify({
          input: record.media_url,
          playback_policy: ['public']
        })
      });
      const data = await response.json();
      */

      // Mark the video status as processing
      await supabase
        .from('posts')
        .update({ status: 'processing_video' } as any)
        .eq('id', record.id);
    }

    return new Response(JSON.stringify({ success: true, message: 'Job scheduled successfully' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error: any) {
    console.error('[VIDEO TRANSCODER ERROR]', error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
})
