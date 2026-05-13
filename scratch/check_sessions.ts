import { supabase } from './src/integrations/supabase/client';

async function checkSessions() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    console.log('No active auth session.');
    return;
  }

  console.log('User ID:', session.user.id);
  
  const { data: sessions, error } = await supabase
    .from('user_sessions' as any)
    .select('*')
    .eq('user_id', session.user.id);

  if (error) {
    console.error('Error fetching sessions:', error);
  } else {
    console.log('Sessions found:', sessions.length);
    console.log(JSON.stringify(sessions, null, 2));
  }
}

checkSessions();
