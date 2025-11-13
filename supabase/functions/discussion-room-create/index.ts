// deno-lint-ignore-file

import { createClient } from 
"npm:@supabase/supabase-js@2.81.1"
;
import { corsHeaders } from 
"../_shared/cors.ts"
;
if (!Deno.env.get(
"SUPABASE_URL"
) || !Deno.env.get(
"SUPABASE_ANON_KEY"
)) {
  console.error(
"Missing SUPABASE_URL or SUPABASE_ANON_KEY environment variables"
);
}
Deno.serve(async (req: Request) => {
  if (req.method === 
"OPTIONS"
) {
    return new Response(
"ok"
, { headers: corsHeaders });
  }
  try {
    const auth = req.headers.get(
"Authorization"
);
    if (!auth) {
      return new Response(
        JSON.stringify({ error: 
"Authorization header is missing"
 }),
        { headers: { ...corsHeaders, 
"Content-Type"
: 
"application/json"
 }, status: 
401
 }
      );
    }
    const body = await req.json().catch(() => ({}));
    const { name, description, room_type = 
"public"
 } = body as {
      name?: string;
      description?: string;
      room_type?: 
"public"
 | 
"private"
;
    };
    if (!name) {
      return new Response(JSON.stringify({ error: 
"Room name is required"
 }), {
        status: 
400
,
        headers: { ...corsHeaders, 
"Content-Type"
: 
"application/json"
 },
      });
    }
    if (![
"public"
, 
"private"
].includes(room_type)) {
      return new Response(
        JSON.stringify({ error: 
"Invalid room_type. Must be 'public' or 'private'."
 }),
        {
          status: 
400
,
          headers: { ...corsHeaders, 
"Content-Type"
: 
"application/json"
 },
        }
      );
    }
    const supabase = createClient(
      Deno.env.get(
"SUPABASE_URL"
) ?? 
""
,
      Deno.env.get(
"SUPABASE_ANON_KEY"
) ?? 
""
,
      { global: { headers: { Authorization: auth } } }
    );
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: userError?.message || 
"User not authenticated"
 }),
        { headers: { ...corsHeaders, 
"Content-Type"
: 
"application/json"
 }, status: 
401
 }
      );
    }
    const insertRoom = await supabase
      .from(
"discussion_rooms"
)
      .insert({
        name,
        description,
        room_type,
        created_by: user.id,
      })
      .select()
      .single();
    if (insertRoom.error || !insertRoom.data) {
      return new Response(JSON.stringify({ error: insertRoom.error?.message ?? 
"Failed to create room"
 }), {
        status: 
500
,
        headers: { ...corsHeaders, 
"Content-Type"
: 
"application/json"
 },
      });
    }
    const roomData = insertRoom.data as any;
    const memberInsert = await supabase.from(
"room_members"
).insert({
      room_id: roomData.id,
      user_id: user.id,
    });
    if (memberInsert.error) {
      console.error(`Failed to add creator as member for room ${roomData.id}:`, memberInsert.error.message);
      
// Attempt cleanup

      const cleanup = await supabase.from(
"discussion_rooms"
).delete().eq(
"id"
, roomData.id);
      if (cleanup.error) {
        console.error(
"Failed to cleanup room after member insert failure:"
, cleanup.error.message);
      }
      return new Response(
        JSON.stringify({ error: 
"Failed to create room: could not add creator as a member."
 }),
        {
          status: 
500
,
          headers: { ...corsHeaders, 
"Content-Type"
: 
"application/json"
 },
        }
      );
    }
    const newRoomData = {
      ...roomData,
      room_members: [{ user_id: user.id }],
    };
    return new Response(JSON.stringify(newRoomData), {
      status: 
201
,
      headers: { ...corsHeaders, 
"Content-Type"
: 
"application/json"
 },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: message }), {
      headers: { ...corsHeaders, 
"Content-Type"
: 
"application/json"
 },
      status: 
500
,
    });
  }
});