import { useState } from 'react';
import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { downloadText } from '@/lib/receipt';
import { friendlyError } from '@cinecraft/core';
import { EXPORTS, buildCsv, exportFileName, isMissingDbObject, validateRange, type ExportKind } from '../shared/deskLogic';

const isoDay = (d: Date) => d.toISOString().slice(0, 10);

/**
 * Admin CSV exports (people summary, support tickets, verification requests) for a date range.
 * The rows come from database functions that leave out personal details and write an audit entry for every export.
 * Needs supabase/manual/part_gb_admin_exports.sql.
 */
const ExportsPanel = () => {
  const { toast } = useToast();
  const today = new Date();
  const [from, setFrom] = useState(isoDay(new Date(today.getTime() - 30 * 86_400_000)));
  const [to, setTo] = useState(isoDay(today));
  const [busy, setBusy] = useState<ExportKind | null>(null);
  const [missing, setMissing] = useState(false);
  const [last, setLast] = useState<string | null>(null);

  const rangeError = validateRange(from, to);

  const run = async (kind: ExportKind) => {
    if (rangeError) { toast({ title: rangeError, variant: 'destructive' }); return; }
    const def = EXPORTS[kind];
    setBusy(kind);
    const { data, error } = await (supabase as any).rpc(def.rpc, { p_from: from, p_to: to });
    setBusy(null);
    if (error) {
      if (isMissingDbObject(error)) setMissing(true);
      toast({ title: 'Could not export', description: friendlyError(error), variant: 'destructive' });
      return;
    }
    const rows = (data || []) as Record<string, unknown>[];
    const name = exportFileName(kind.replace(/_/g, '-'), from, to);
    downloadText(name, buildCsv([...def.columns], rows));
    setLast(`${def.title}: ${rows.length} row${rows.length === 1 ? '' : 's'} saved as ${name}. This export is in the audit log.`);
    toast({ title: 'Export ready', description: `${rows.length} row${rows.length === 1 ? '' : 's'}` });
  };

  return (
    <section aria-label="Exports" className="glass-card p-6 rounded-2xl border-border/50 space-y-4">
      <div>
        <h3 className="text-sm font-black uppercase tracking-tight">Exports</h3>
        <p className="text-[12px] text-muted-foreground">Download a list as a CSV file. No emails, phone numbers, message text or documents are included. Every export is written to the audit log.</p>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <label className="text-[12px] font-bold space-y-1">
          <span className="block text-muted-foreground uppercase tracking-widest">From</span>
          <input type="date" aria-label="Export from date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} className="h-9 rounded-xl border border-border/60 bg-muted/20 px-3 text-xs" />
        </label>
        <label className="text-[12px] font-bold space-y-1">
          <span className="block text-muted-foreground uppercase tracking-widest">To</span>
          <input type="date" aria-label="Export to date" value={to} min={from} onChange={(e) => setTo(e.target.value)} className="h-9 rounded-xl border border-border/60 bg-muted/20 px-3 text-xs" />
        </label>
        {rangeError && <p className="text-xs text-red-500 pb-2" role="alert">{rangeError}</p>}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {(Object.keys(EXPORTS) as ExportKind[]).map((k) => (
          <div key={k} className="rounded-2xl border border-border/50 bg-card/60 p-4 flex flex-col gap-3">
            <div>
              <p className="text-sm font-bold">{EXPORTS[k].title}</p>
              <p className="text-[12px] text-muted-foreground leading-snug mt-0.5">{EXPORTS[k].hint}</p>
            </div>
            <Button variant="outline" size="sm" className="mt-auto h-9 rounded-xl gap-2 text-xs font-bold" disabled={!!busy || !!rangeError} onClick={() => run(k)} aria-label={`Export ${EXPORTS[k].title}`}>
              <Download className="w-4 h-4" /> {busy === k ? 'Exporting…' : 'Export CSV'}
            </Button>
          </div>
        ))}
      </div>

      {missing && (
        <p className="text-[12px] rounded-xl border border-amber-500/30 bg-amber-500/5 px-3 py-2" role="status">
          Exports are not switched on yet. Run <span className="font-mono">supabase/manual/part_gb_admin_exports.sql</span> in the SQL editor.
        </p>
      )}
      {last && <p className="text-[12px] text-muted-foreground" role="status">{last}</p>}
    </section>
  );
};

export default ExportsPanel;
