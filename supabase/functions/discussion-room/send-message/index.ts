// deno-lint-ignore-file
import { serve } from "https://deno.land/std@0.225.0/http/mod.ts";
import { createClient } from "supabase";

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

const MAX_CONTENT_LENGTH = 10000; // Set a max length for messages

serve(async (req) => {
  // 1. Parse JSON body and handle parsing errors
  let body;
  try {
    body = await req.json();
  } catch (_error) {
    return new Response(
      JSON.stringify({ error: "Invalid JSON format." }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  // 2. Validate input fields (room_id, content)
  const { room_id, content } = body;
  
  if (!room_id || typeof room_id !== 'string') {
    return new Response(
      JSON.stringify({ error: "The 'room_id' field is required and must be a string." }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const trimmedContent = content ? String(content).trim() : '';
  if (!trimmedContent) {
    return new Response(
      JSON.stringify({ error: "Message content cannot be empty." }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  if (trimmedContent.length > MAX_CONTENT_LENGTH) {
    return new Response(
      JSON.stringify({ error: `Message content exceeds maximum length of ${MAX_CONTENT_LENGTH} characters.` }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  // 3. Authenticate user
  const authHeader = req.headers.get('Authorization');
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader || '' } },
  });

  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { "Content-Type": "application/json" } });
  }

  // 4. Insert the new message into the database
  const { data, error } = await supabase
    .from('messages')
    .insert([{ room_id, content: trimmedContent, user_id: user.id }])
    .select();

  if (error) {
    console.error(`Error inserting message for room ${room_id}:`, error);
    return new Response(
      JSON.stringify({ error: 'Failed to send message.', details: error.message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  if (!data || data.length === 0) {
    console.error(`Insert succeeded but no data returned for room ${room_id}`);
    return new Response(
        JSON.stringify({ error: 'Failed to create message, no data returned.' }),
        { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  // 5. Update the last_activity_at timestamp for the room
  // This is a secondary action, so we log errors but don't fail the request
  const { error: updateError } = await supabase
    .from('discussion_rooms')
    .update({ last_activity_at: new Date().toISOString() })
    .eq('id', room_id);

  if (updateError) {
    console.error(`Failed to update last_activity_at for room ${room_id}:`, updateError.message);
    // We don't return an error response here because the message was sent successfully.
  }

  // 6. Return the newly created message
  return new Response(JSON.stringify(data[0]), {
    status: 201, // 201 Created
    headers: { 'Content-Type': 'application/json' },
  });
})
