import { useEffect, useState } from 'react';
import { PhoneCall } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

/** "On call now" in the staff header. Shows nothing until part GI-3 is applied, for finance accounts, or when nobody is set for today. */
const OnCallBadge = () => {
  const [now, setNow] = useState<{ primary: string | null; backup: string | null } | null>(null);
  useEffect(() => {
    let live = true;
    (async () => {
      const { data, error } = await (supabase as any).rpc('oncall_now');
      if (live && !error && data) setNow({ primary: data.primary ?? null, backup: data.backup ?? null });
    })();
    return () => { live = false; };
  }, []);
  if (!now || (!now.primary && !now.backup)) return null;
  return (
    <div className="hidden xl:flex items-center gap-2 rounded-xl border border-border/50 bg-muted/30 px-3 py-1.5" title="Who is on call today (UTC day)">
      <PhoneCall className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
      <div className="leading-tight">
        <p className="text-[12px] font-black uppercase tracking-widest text-muted-foreground">On call now</p>
        <p className="text-[12px] font-bold text-foreground">
          {now.primary || 'No primary'}{now.backup ? <span className="font-medium text-muted-foreground"> · backup {now.backup}</span> : null}
        </p>
      </div>
    </div>
  );
};

export default OnCallBadge;
