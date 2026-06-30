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

async function checkProfiles() {
  console.log('Querying profiles...');
  const { data, error } = await supabase
    .from('profiles')
    .select('id, username, full_name, account_type, public_key');
  
  if (error) {
    console.error('Error:', error);
    return;
  }
  
  console.log('Profiles found:');
  data.forEach(p => {
    console.log(`- ID: ${p.id} | Username: ${p.username} | Full Name: ${p.full_name} | Type: ${p.account_type} | Has Key: ${!!p.public_key}`);
  });
}

checkProfiles();
