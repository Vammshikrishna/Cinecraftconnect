import { serve } from "jsr:@std/http";
import { createClient } from "@supabase/supabase-js";

serve(async (req) => {

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
  );

  const { data: { user }, error: userError } = await supabase.auth.getUser();

  if (userError) {
    return new Response(JSON.stringify({ error: userError.message }), { status: 401 });
  }

  const { data, error } = await supabase
    .from('discussion_rooms')
    .select(`
      *,
      room_members ( user_id )
    `)
    .or(`room_type.eq.public,and(room_type.eq.private,room_members.user_id.eq.${user.id})`);

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }

  return new Response(JSON.stringify(data), { status: 200 });
});
