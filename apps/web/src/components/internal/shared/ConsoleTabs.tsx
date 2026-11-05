import { useEffect, useRef, useState } from 'react';
import { TabsList } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';

/**
 * The tab row of a staff console. With many tabs it scrolls sideways instead of running off the page, scrolls the open
 * tab into view, and fades the edge where there is more to see.
 */
export const ConsoleTabs = ({ active, children }: { active: string; children: React.ReactNode }) => {
  const ref = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ left: false, right: false });

  const measure = () => {
    const el = ref.current;
    if (!el) return;
    setEdges({ left: el.scrollLeft > 4, right: el.scrollLeft + el.clientWidth < el.scrollWidth - 4 });
  };

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.querySelector<HTMLElement>('[data-state="active"]')?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
    measure();
    el.addEventListener('scroll', measure, { passive: true });
    window.addEventListener('resize', measure);
    return () => { el.removeEventListener('scroll', measure); window.removeEventListener('resize', measure); };
  }, [active]);

  return (
    <div className="relative">
      <TabsList
        ref={ref}
        className="flex w-full justify-start overflow-x-auto no-scrollbar bg-muted/50 p-1.5 rounded-2xl border border-border/50 h-auto gap-1"
      >
        {children}
      </TabsList>
      <div aria-hidden className={cn('pointer-events-none absolute inset-y-0 left-0 w-10 rounded-l-2xl bg-gradient-to-r from-background to-transparent transition-opacity', edges.left ? 'opacity-100' : 'opacity-0')} />
      <div aria-hidden className={cn('pointer-events-none absolute inset-y-0 right-0 w-10 rounded-r-2xl bg-gradient-to-l from-background to-transparent transition-opacity', edges.right ? 'opacity-100' : 'opacity-0')} />
    </div>
  );
};

export default ConsoleTabs;
