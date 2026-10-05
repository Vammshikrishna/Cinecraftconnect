import { cn } from '@/lib/utils';

/** A small "Open to work" / "Booked" marker for cards and profiles. Renders nothing for people who are not looking. */
export const AvailabilityBadge = ({ status, className }: { status?: string | null; className?: string }) => {
  if (status !== 'open' && status !== 'booked') return null;
  const open = status === 'open';
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider',
        open ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400',
        className
      )}
    >
      <span className={cn('h-1.5 w-1.5 rounded-full', open ? 'bg-emerald-500' : 'bg-amber-500')} />
      {open ? 'Open to work' : 'Booked'}
    </span>
  );
};
