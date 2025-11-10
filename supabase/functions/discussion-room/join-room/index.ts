// deno-lint-ignore-file no-explicit-any
import { serve } from "jsr:@std/http";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.80.0";

serve(async (req: { headers: { get: (arg0: string) => string; }; json: () => PromiseLike<{ room_id: any; }> | { room_id: any; }; }) => {

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? '',
   { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
 );

 const { room_id } = await req.json();

 const { data: { user }, error: userError } = await supabase.auth.getUser();

  if (userError || !user) {
    return new Response(JSON.stringify({ error: userError?.message || 'User not authenticated' }), { status: 401 });
  }

 const { data, error } = await supabase
   .from('room_members')
   .insert({ room_id, user_id: user.id });

 if (error) {
   return new Response(JSON.stringify({ error: error.message }), { status: 500 });
 }

 return new Response(JSON.stringify(data), { status: 200 });
});
