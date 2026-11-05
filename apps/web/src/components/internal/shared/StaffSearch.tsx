import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAppNavigation } from '@/contexts/NavigationContext';
import { useAppRole } from '@/hooks/useAppRole';
import { FileText, Flag, Search, User } from 'lucide-react';

interface Hit { kind: 'user' | 'report' | 'post'; id: string; label: string; sub: string }

/** One search box for staff. Type a name, a report number, or paste a user id or a post link. Ctrl+K focuses it. */
const StaffSearch = () => {
  const { push } = useAppNavigation();
  const { role } = useAppRole();
  const [q, setQ] = useState('');
  const [hits, setHits] = useState<Hit[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); input.current?.focus(); }
    };
    const onClick = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false); };
    window.addEventListener('keydown', onKey);
    window.addEventListener('mousedown', onClick);
    return () => { window.removeEventListener('keydown', onKey); window.removeEventListener('mousedown', onClick); };
  }, []);

  useEffect(() => {
    if (q.trim().length < 2) { setHits([]); return; }
    const t = setTimeout(async () => {
      const { data } = await (supabase as any).rpc('staff_search', { p_q: q });
      setHits((data as Hit[]) || []);
      setActive(0);
      setOpen(true);
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  const go = (h: Hit) => {
    setOpen(false);
    setQ('');
    const isAdmin = role === 'admin' || role === 'super_admin';
    if (h.kind === 'user') push(isAdmin ? `/admin?user=${h.id}` : `/profile/${h.id}`);
    else if (h.kind === 'report') push(`/moderation?case=${h.id}`);
    else push(`/post/${h.id}`);
  };

  const Icon = (k: Hit['kind']) => (k === 'user' ? User : k === 'report' ? Flag : FileText);

  return (
    <div ref={box} className="relative hidden xl:block w-64">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
      <input
        ref={input}
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onFocus={() => hits.length && setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(a + 1, hits.length - 1)); }
          else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
          else if (e.key === 'Enter' && hits[active]) go(hits[active]);
          else if (e.key === 'Escape') setOpen(false);
        }}
        placeholder="Find a person, report or post…  Ctrl K"
        aria-label="Search people, reports and posts"
        className="w-full h-9 rounded-xl border border-border/50 bg-muted/30 pl-9 pr-3 text-xs outline-none focus:ring-2 focus:ring-primary/30"
      />
      {open && q.trim().length >= 2 && (
        <div className="absolute right-0 mt-2 w-80 rounded-xl border border-border bg-popover shadow-xl overflow-hidden z-[120]">
          {hits.length === 0 ? (
            <p className="px-4 py-3 text-xs text-muted-foreground">Nothing found.</p>
          ) : (
            hits.map((h, i) => {
              const I = Icon(h.kind);
              return (
                <button
                  key={`${h.kind}-${h.id}`}
                  type="button"
                  onMouseEnter={() => setActive(i)}
                  onClick={() => go(h)}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 text-left ${i === active ? 'bg-muted' : ''}`}
                >
                  <I className="w-4 h-4 text-muted-foreground shrink-0" />
                  <span className="min-w-0">
                    <span className="block text-sm font-medium truncate">{h.label}</span>
                    {h.sub && <span className="block text-[12px] text-muted-foreground truncate">{h.sub}</span>}
                  </span>
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
};

export default StaffSearch;
