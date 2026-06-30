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

async function checkDb() {
  const userId = '04c085b6-fc1e-4528-8819-220503ff5136'; // vamshikrishna
  const roomId = '53cda2a7-2a0a-47d6-b7b6-c7a932ce21da'; // target room in console log
  
  console.log('Querying group_keys using anon key...');
  const res1 = await supabase
    .from('group_keys')
    .select('*')
    .eq('target_id', roomId);
  console.log('Anon key group_keys results:', res1.data, 'Error:', res1.error);

  console.log('\nQuerying room_members for this room...');
  const res2 = await supabase
    .from('room_members')
    .select('*')
    .eq('room_id', roomId);
  console.log('Room members results:', res2.data, 'Error:', res2.error);

  console.log('\nQuerying discussion_rooms details...');
  const res3 = await supabase
    .from('discussion_rooms')
    .select('id, title, creator_id, room_type')
    .eq('id', roomId);
  console.log('Room details:', res3.data, 'Error:', res3.error);
}

checkDb();
