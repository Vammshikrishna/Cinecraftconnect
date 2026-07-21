const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const { data, error } = await supabase.from('user_push_tokens').select('*').order('last_seen', { ascending: false }).limit(5);
  console.log('Push Tokens:', JSON.stringify(data, null, 2));
  console.log('Error:', error);
}
check();
