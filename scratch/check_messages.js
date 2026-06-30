import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// Manually parse .env file
const envPath = path.resolve(process.cwd(), '.env');
const envContent = fs.readFileSync(envPath, 'utf-8');
const envVars = {};
envContent.split('\n').forEach(line => {
  const parts = line.split('=');
  if (parts.length >= 2) {
    const key = parts[0].trim();
    const value = parts.slice(1).join('=').trim().replace(/^["']|["']$/g, '');
    envVars[key] = value;
  }
});

const supabaseUrl = envVars.VITE_SUPABASE_URL || '';
const supabaseKey = envVars.VITE_SUPABASE_ANON_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkMessages() {
  console.log('Querying direct_messages...');
  const { data, error } = await supabase
    .from('direct_messages')
    .select('id, sender_id, receiver_id, channel_id, content, created_at')
    .order('created_at', { ascending: false })
    .limit(10);
  
  if (error) {
    console.error('Error:', error);
    return;
  }
  
  console.log('Latest 10 direct_messages:');
  data.forEach(m => {
    console.log(`- MsgID: ${m.id}\n  Sender: ${m.sender_id}\n  Receiver: ${m.receiver_id}\n  ChannelID: ${m.channel_id}\n  Content: ${m.content.slice(0, 80)}\n  Created At: ${m.created_at}`);
  });
}

checkMessages();
