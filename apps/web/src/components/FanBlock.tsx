import React from 'react';
import { Link, Navigate } from 'react-router-dom';
import { Heart } from 'lucide-react';
import { useAccountType } from '@/hooks/useAccountType';
import { Button } from '@/components/ui/button';

/**
 * Wraps a page that publishes content (create a post). Fan accounts follow and react but do not publish,
 * so they see a short explanation. The database refuses the same insert too (supabase/manual/part_dm_fans_cannot_post.sql).
 */
interface FanBlockProps {
  children: React.ReactNode;
  /** Replaces the default "Posting is for creators and studios" heading. */
  title?: string;
  /** Replaces the default explanation. */
  description?: string;
  /** When set, a fan is sent to this path straight away (no page flash) instead of seeing the explanation. */
  redirectTo?: string;
}

export const FanBlock = ({ children, title, description, redirectTo }: FanBlockProps) => {
  const { isFan } = useAccountType();
  if (!isFan) return <>{children}</>;
  if (redirectTo) return <Navigate to={redirectTo} replace />;
  return (
    <main className="min-h-[70vh] flex flex-col items-center justify-center px-6 text-center">
      <div className="h-16 w-16 rounded-2xl bg-primary/10 text-primary grid place-items-center mb-5">
        <Heart className="h-8 w-8" />
      </div>
      <h1 className="text-2xl font-bold tracking-tight text-foreground">{title ?? 'Posting is for creators and studios'}</h1>
      <p className="text-sm text-muted-foreground mt-2 max-w-md leading-relaxed">
        {description ?? 'Fan accounts can follow people, like, comment and save posts, but cannot create posts.'}
      </p>
      <Button asChild className="mt-6 h-11 rounded-xl px-6 font-semibold">
        <Link to="/feed">Back to your feed</Link>
      </Button>
    </main>
  );
};

export default FanBlock;
