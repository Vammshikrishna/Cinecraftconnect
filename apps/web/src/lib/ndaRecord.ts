import { supabase } from '@/integrations/supabase/client';
import { fetchNdaRecord, buildNdaRecordHtml } from '@cinecraft/core';

/** Opens the NDA record of a pitch in a new tab, ready to print or save as PDF. Returns false when it could not be built. */
export async function openNdaRecord(submissionId: string): Promise<boolean> {
    // the tab opens first (a pop-up blocker allows it only straight after the click)
    const w = window.open('', '_blank');
    try {
        const record = await fetchNdaRecord(supabase, submissionId);
        if (!record || !w) { w?.close(); return false; }
        w.document.open();
        w.document.write(buildNdaRecordHtml(record));
        w.document.close();
        w.focus();
        setTimeout(() => { try { w.print(); } catch { /* the page can still be printed by hand */ } }, 400);
        return true;
    } catch {
        w?.close();
        return false;
    }
}
