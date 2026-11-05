import React from 'react';
import { Link } from 'react-router-dom';
import { ShieldCheck } from 'lucide-react';
import { useAppRole } from '@/hooks/useAppRole';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { Button } from '@/components/ui/button';

/**
 * Wraps a page that belongs to the social side of the app (writing posts, direct messages, applications, bookings,
 * ratings). Staff accounts are for governance, moderation and support, so they see a short explanation instead.
 * The database refuses the same actions too (see docs/STAFF_ACCOUNT_RULES.md); this just keeps the page out of the way.
 */
export const StaffBlock = ({ children }: { children: React.ReactNode }) => {
  const { isInternal, isSuperAdmin, isAdmin, isFinance, loading } = useAppRole();

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }
  if (!isInternal) return <>{children}</>;

  const home = isSuperAdmin ? '/super-admin' : isAdmin ? '/admin' : isFinance ? '/finance' : '/moderation';
  return (
    <main className="min-h-[70vh] flex flex-col items-center justify-center px-6 text-center">
      <div className="h-16 w-16 rounded-2xl bg-primary/10 text-primary grid place-items-center mb-5">
        <ShieldCheck className="h-8 w-8" />
      </div>
      <h1 className="text-2xl font-bold tracking-tight text-foreground">Not available for staff accounts</h1>
      <p className="text-sm text-muted-foreground mt-2 max-w-md leading-relaxed">
        Internal accounts are for governance, moderation and support. They do not post, message, apply or rate.
      </p>
      <Button asChild className="mt-6 h-11 rounded-xl px-6 font-semibold">
        <Link to={home}>Go to your console</Link>
      </Button>
    </main>
  );
};

export default StaffBlock;
