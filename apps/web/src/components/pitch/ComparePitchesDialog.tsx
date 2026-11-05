import { useEffect, useState } from 'react';
import { Star } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { PitchSubmission, PITCH_STATUS_LABELS } from '@/hooks/usePitch';
import { fetchReviewNotes, listText, type ReviewNote } from '@cinecraft/core';
import { formatDistanceToNow } from 'date-fns';

/** 2 or 3 pitches side by side: the story, the writer, your private rating and note. */
export function ComparePitchesDialog({ submissions, open, onClose, onOpen }: {
    submissions: PitchSubmission[]; open: boolean; onClose: () => void; onOpen: (id: string) => void;
}) {
    const [notes, setNotes] = useState<Record<string, ReviewNote>>({});
    useEffect(() => {
        if (!open || submissions.length === 0) return;
        let alive = true;
        fetchReviewNotes(supabase, submissions.map((s) => s.id)).then((n) => { if (alive) setNotes(n); }).catch(() => { });
        return () => { alive = false; };
    }, [open, submissions.map((s) => s.id).join(',')]);

    const rows: { label: string; render: (s: PitchSubmission) => React.ReactNode }[] = [
        { label: 'Writer', render: (s) => (s as any).profiles?.full_name || '' },
        { label: 'Status', render: (s) => PITCH_STATUS_LABELS[s.status || 'submitted']?.label || s.status },
        { label: 'Logline', render: (s) => <span className="italic">"{s.logline}"</span> },
        { label: 'Genre', render: (s) => listText(s.genre as any) || '-' },
        { label: 'Language', render: (s) => listText(s.language as any) || '-' },
        { label: 'Format', render: (s) => s.format || '-' },
        { label: 'Tone', render: (s) => s.tone || '-' },
        { label: 'Why it fits', render: (s) => (s as any).why_fits || '-' },
        { label: 'Short synopsis', render: (s) => <span className="whitespace-pre-wrap">{s.short_synopsis}</span> },
        { label: 'Sent', render: (s) => formatDistanceToNow(new Date(s.submitted_at), { addSuffix: true }) },
        {
            label: 'Your rating', render: (s) => {
                const r = notes[s.id]?.rating;
                return r ? (
                    <span className="flex gap-0.5" aria-label={`${r} out of 5`}>
                        {[1, 2, 3, 4, 5].map((n) => <Star key={n} className={n <= r ? 'h-4 w-4 fill-amber-400 text-amber-400' : 'h-4 w-4 text-muted-foreground/40'} />)}
                    </span>
                ) : '-';
            },
        },
        { label: 'Your note', render: (s) => <span className="whitespace-pre-wrap">{notes[s.id]?.note || '-'}</span> },
    ];

    return (
        <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
            <DialogContent className="max-w-5xl max-h-[90vh] overflow-auto">
                <DialogHeader><DialogTitle>Compare pitches</DialogTitle></DialogHeader>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm border-collapse">
                        <thead>
                            <tr>
                                <th className="w-28" />
                                {submissions.map((s) => (
                                    <th key={s.id} className="p-3 text-left align-top border-b border-border/50 min-w-[220px]">
                                        <p className="font-black">{s.title}</p>
                                        <Button size="sm" variant="outline" className="mt-2 h-10 md:h-8 text-xs" onClick={() => onOpen(s.id)}>Open pitch</Button>
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map((row) => (
                                <tr key={row.label} className="border-b border-border/30 align-top">
                                    <th scope="row" className="p-3 text-left text-[12px] font-black uppercase tracking-widest text-muted-foreground/70">{row.label}</th>
                                    {submissions.map((s) => <td key={s.id} className="p-3">{row.render(s)}</td>)}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </DialogContent>
        </Dialog>
    );
}
