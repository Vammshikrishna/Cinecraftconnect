import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { ScreenSkeleton } from '@/components/ui/enhanced-skeleton';

/**
 * Wraps /discussion-rooms/:roomId/chat. An id that matches no room (or a room the viewer cannot see)
 * shows "Discussion Room Not Found" instead of silently rendering the room list.
 */
export const RoomExistsGuard = ({ children }: { children: React.ReactNode }) => {
  const { roomId } = useParams<{ roomId: string }>();
  const [state, setState] = useState<'loading' | 'found' | 'missing' | 'error'>('loading');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!roomId) { setState('missing'); return; }
    let cancelled = false;
    setState('loading');
    supabase.from('discussion_rooms').select('id').eq('id', roomId).maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          // a malformed id (not a UUID) comes back as an error from the database: that is "not found" too
          setState(/invalid input syntax|22P02/i.test(`${error.message} ${error.code}`) ? 'missing' : 'error');
        } else setState(data ? 'found' : 'missing');
      });
    return () => { cancelled = true; };
  }, [roomId, attempt]);

  if (state === 'loading') return <ScreenSkeleton variant="detail" />;
  if (state === 'found') return <>{children}</>;
  return (
    <div className="flex min-h-[70vh] items-center justify-center flex-col gap-4 bg-background px-6 text-center">
      <h2 className="text-2xl font-bold">{state === 'error' ? 'Could not load this room' : 'Discussion Room Not Found'}</h2>
      <p className="text-sm text-muted-foreground max-w-md">
        {state === 'error' ? 'Check your connection and try again.' : 'This room does not exist or you cannot see it.'}
      </p>
      {state === 'error' && <Button onClick={() => setAttempt((a) => a + 1)}>Try again</Button>}
      <Button asChild variant={state === 'error' ? 'outline' : 'default'}><Link to="/discussion-rooms">View All Rooms</Link></Button>
    </div>
  );
};

export default RoomExistsGuard;
