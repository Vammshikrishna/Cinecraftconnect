import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { fetchPostInsights, type PostInsights } from '@cinecraft/core';

/** Numbers for the author of a post. */
export function PostInsightsDialog({ postId, open, onOpenChange }: { postId: string; open: boolean; onOpenChange: (o: boolean) => void }) {
    const [data, setData] = useState<PostInsights | null | undefined>(undefined);

    useEffect(() => {
        if (!open) return;
        let alive = true;
        setData(undefined);
        fetchPostInsights(supabase, postId).then((d) => { if (alive) setData(d); }).catch(() => { if (alive) setData(null); });
        return () => { alive = false; };
    }, [open, postId]);

    const rows: [string, number | undefined][] = [
        ['People reached', data?.people_reached],
        ['Views', data?.views],
        ['Likes', data?.likes],
        ['Comments', data?.comments],
        ['Shares', data?.shares],
        ['Saves', data?.saves],
    ];

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-sm">
                <DialogHeader>
                    <DialogTitle>Post insights</DialogTitle>
                    <DialogDescription>Only you can see these numbers. Reach counts people who scrolled past your post in their feed.</DialogDescription>
                </DialogHeader>
                {data === undefined ? (
                    <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
                ) : data === null ? (
                    <p className="text-sm text-muted-foreground py-6 text-center">Insights are not available for this post.</p>
                ) : (
                    <dl className="grid grid-cols-2 gap-3">
                        {rows.map(([label, n]) => (
                            <div key={label} className="rounded-2xl border border-border/50 bg-muted/20 p-3 text-center">
                                <dd className="text-2xl font-black">{n ?? 0}</dd>
                                <dt className="text-[12px] font-black uppercase tracking-widest text-muted-foreground/70">{label}</dt>
                            </div>
                        ))}
                    </dl>
                )}
            </DialogContent>
        </Dialog>
    );
}
