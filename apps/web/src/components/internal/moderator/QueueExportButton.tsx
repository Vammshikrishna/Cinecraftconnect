import { useState } from 'react';
import { Download } from 'lucide-react';
import { friendlyError } from '@cinecraft/core';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { downloadText } from '@/lib/receipt';
import { buildCsv, isMissingDbObject } from '../shared/deskLogic';
import { QUEUE_EXPORT_CAP, QUEUE_EXPORT_COLUMNS, queueExportFileName, queueExportIds } from './queueTools';

/**
 * Downloads the queue as it is filtered right now. The rows come from a database function (case id, type, status, priority, SLA state,
 * created, claimed-by handle, escalation reason: no emails, phones or message text) that also writes the audit entry.
 * Needs supabase/manual/part_gh_mod_queue_export.sql.
 */
const QueueExportButton = ({ cases }: { cases: Array<{ id: string }> }) => {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const [missing, setMissing] = useState(false);

  const run = async () => {
    const { ids, cut } = queueExportIds(cases);
    if (ids.length === 0 || busy) return;
    setBusy(true);
    const { data, error } = await (supabase as any).rpc('mod_export_queue', { p_case_ids: ids });
    setBusy(false);
    if (error) {
      if (isMissingDbObject(error)) setMissing(true);
      toast({ title: 'Could not export', description: friendlyError(error), variant: 'destructive' });
      return;
    }
    const rows = (data || []) as Record<string, unknown>[];
    downloadText(queueExportFileName(), buildCsv([...QUEUE_EXPORT_COLUMNS], rows));
    toast({
      title: 'Export ready',
      description: `${rows.length} case${rows.length === 1 ? '' : 's'}${cut ? `, the first ${QUEUE_EXPORT_CAP} of the list` : ''}. This export is in the audit log.`,
    });
  };

  return (
    <>
      <Button size="sm" variant="outline" className="h-7 text-[12px] font-bold gap-1.5" disabled={busy || cases.length === 0} onClick={run} aria-label="Export the filtered queue as CSV">
        <Download className="w-3 h-3" /> {busy ? 'Exporting…' : 'Export CSV'}
      </Button>
      {missing && (
        <p className="basis-full text-[12px] rounded-xl border border-amber-500/30 bg-amber-500/5 px-3 py-2" role="status">
          Queue export is not switched on yet. Run <span className="font-mono">supabase/manual/part_gh_mod_queue_export.sql</span> in the SQL editor.
        </p>
      )}
    </>
  );
};

export default QueueExportButton;
