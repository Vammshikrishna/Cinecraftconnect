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

async function testSyntax() {
  const userId = '836a3a0c-3259-48e5-8285-68b834cb2300';
  const partnerId = '114246c9-e957-4230-95a5-96d7534e73cc';
  
  console.log('Testing parenthesized or syntax...');
  const res1 = await supabase
    .from('direct_messages')
    .delete()
    .or(`(sender_id.eq.${userId},receiver_id.eq.${partnerId}),(sender_id.eq.${partnerId},receiver_id.eq.${userId})`);
  
  if (res1.error) {
    console.error('Parenthesized OR Error:', res1.error);
  } else {
    console.log('Parenthesized OR: Success (no syntax error)');
  }

  console.log('\nTesting and(...) or syntax...');
  const res2 = await supabase
    .from('direct_messages')
    .delete()
    .or(`and(sender_id.eq.${userId},receiver_id.eq.${partnerId}),and(sender_id.eq.${partnerId},receiver_id.eq.${userId})`);
  
  if (res2.error) {
    console.error('and(...) OR Error:', res2.error);
  } else {
    console.log('and(...) OR: Success (no syntax error)');
  }

  console.log('\nTesting simple channel_id eq or syntax...');
  const res3 = await supabase
    .from('direct_messages')
    .delete()
    .or(`channel_id.eq.dummy-36-char,channel_id.eq.dummy-73-char-id-longer`);
  
  if (res3.error) {
    console.error('Simple eq OR Error:', res3.error);
  } else {
    console.log('Simple eq OR: Success (no syntax error)');
  }
}

testSyntax();
