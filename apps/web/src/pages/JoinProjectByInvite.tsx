import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAppNavigation } from '@/contexts/NavigationContext';
import { friendlyError } from '@cinecraft/core';
import { Button } from '@/components/ui/button';

/** /projects/join/:code - redeems a project invite link (Team > Invite Link) and opens the project space. */
const JoinProjectByInvite = () => {
  const { code } = useParams<{ code: string }>();
  const { replace, push } = useAppNavigation();
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  useEffect(() => {
    if (!code || started.current) return;
    started.current = true;
    (async () => {
      const { data, error: rpcError } = await (supabase as any).rpc('join_project_by_invite', { p_code: code });
      if (rpcError) {
        setError(friendlyError(rpcError, 'This invite link could not be used.'));
        return;
      }
      replace(`/projects/${data}/space`);
    })();
  }, [code, replace]);

  if (error) {
    return (
      <main className="min-h-[70vh] flex flex-col items-center justify-center px-6 text-center gap-3">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Could not join the project</h1>
        <p className="text-sm text-muted-foreground max-w-md">{error}</p>
        <Button onClick={() => push('/projects')} className="mt-2 h-11 rounded-xl px-6 font-semibold">Back to projects</Button>
      </main>
    );
  }
  return (
    <main className="min-h-[70vh] flex flex-col items-center justify-center gap-3 text-muted-foreground">
      <Loader2 className="h-7 w-7 animate-spin" />
      <p className="text-sm">Joining the project…</p>
    </main>
  );
};

export default JoinProjectByInvite;
