import SEO from '@/components/common/SEO';
import { useEffect, useState } from 'react';
import { friendlyError } from '@cinecraft/core';
import { supabase } from '@/integrations/supabase/client';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import TransparencyData, { type TransparencyNumbers } from '@/components/safety/TransparencyData';

interface Published {
  id: string; title: string; summary: string; period_start: string; period_end: string; published_at: string; data: TransparencyNumbers;
}

/** Public: how we handle reports and what we did, period by period. Numbers only; counts of 1 to 4 show as "<5". */
const Transparency = () => {
  const [reports, setReports] = useState<Published[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    setError(null);
    (supabase as any).from('transparency_reports').select('id, title, summary, period_start, period_end, published_at, data')
      .eq('status', 'published').order('period_end', { ascending: false })
      .then(({ data, error: err }: any) => {
        if (err) setError(friendlyError(err)); else setReports((data as Published[]) || []);
      });
  };
  useEffect(load, []);

  return (
    <main className="max-w-4xl mx-auto px-4 sm:px-6 py-10 pb-24">
      <SEO title="Transparency reports" description="Published reports on moderation actions, response times and appeals." />
      <h1 className="text-3xl font-bold tracking-tight">Transparency reports</h1>
      <p className="text-muted-foreground mt-2 max-w-2xl">How many reports we receive, what we do about them, how quickly, and how often people appeal. Counts of one to four are shown as "&lt;5" to protect privacy.</p>

      {error ? (
        <div role="alert" className="mt-8 flex flex-wrap items-center gap-3">
          <p className="text-sm text-destructive">{error}</p>
          <button type="button" onClick={load} className="min-h-11 px-4 rounded-full border border-border text-sm font-semibold hover:bg-muted">Try again</button>
        </div>
      ) : !reports ? (
        <div className="py-16 flex justify-center"><LoadingSpinner size="lg" /></div>
      ) : reports.length === 0 ? (
        <div className="mt-10 rounded-3xl border border-border bg-card py-16 text-center">
          <p className="font-semibold">No report has been published yet</p>
          <p className="text-sm text-muted-foreground mt-1">The first one will appear here.</p>
        </div>
      ) : (
        <div className="mt-10 space-y-14">
          {reports.map((r) => (
            <article key={r.id} aria-labelledby={`t-${r.id}`} className="space-y-5">
              <header>
                <h2 id={`t-${r.id}`} className="text-xl font-bold">{r.title}</h2>
                <p className="text-xs text-muted-foreground mt-1">Published {new Date(r.published_at).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })}</p>
              </header>
              {r.summary && <p className="text-sm leading-relaxed whitespace-pre-wrap max-w-3xl">{r.summary}</p>}
              <TransparencyData data={r.data} />
            </article>
          ))}
        </div>
      )}
    </main>
  );
};

export default Transparency;
