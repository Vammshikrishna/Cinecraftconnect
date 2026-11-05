import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Shield, ChevronLeft, FileText, Clock, Scale } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Footer from '@/components/Footer';
import SEO from '@/components/common/SEO';
import { LoadingSpinner } from '@/components/ui/loading-spinner';

const LegalPage = () => {
  const { type } = useParams<{ type: string }>();
  const [policy, setPolicy] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    // Clear the previous policy first so a missing or slow type never shows the text of the last one.
    setPolicy(null);
    setFailed(false);
    setLoading(true);
    const fetchPolicy = async () => {
      try {
        const { data, error } = await (supabase as any)
          .from('platform_policies')
          .select('*')
          .eq('type', type)
          .eq('is_active', true)
          .order('updated_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        
        if (cancelled) return;
        if (error) throw error;
        if (data) setPolicy(data);
      } catch (e) {
        console.warn('Could not fetch policy:', e);
        if (!cancelled) setFailed(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchPolicy();
    return () => { cancelled = true; };
  }, [type]);

  return (
    <div className="min-h-dvh bg-background flex flex-col">
      {/* The app-level navigation wrapper already renders the navbar; do not add a second one here. */}
      <SEO title={policy?.title || 'Policy'} />
      <main className="flex-1 max-w-4xl mx-auto w-full px-6 py-12">
        <Button asChild variant="ghost" size="sm" className="mb-8 text-xs font-bold gap-2 hover:bg-primary/5 hover:text-primary transition-colors">
          <Link to="/"><ChevronLeft className="w-4 h-4" /> Back to CineCraft</Link>
        </Button>

        {loading ? (
          <div className="flex justify-center py-24" role="status" aria-label="Loading policy"><LoadingSpinner /></div>
        ) : failed ? (
          <div className="text-center py-20" role="alert">
            <h1 className="text-2xl font-black uppercase">Could not load this policy</h1>
            <p className="text-muted-foreground text-sm mt-2">Check your connection and try again.</p>
            <Button className="mt-4" variant="outline" onClick={() => window.location.reload()}>Try again</Button>
          </div>
        ) : policy ? (
          <article className="space-y-8">
            <div className="space-y-4 border-b border-border/50 pb-8">
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-primary/10 text-primary rounded-full">
                <Scale className="w-3.5 h-3.5" />
                <span className="text-[12px] font-semibold uppercase tracking-widest">Platform Governance</span>
              </div>
              <h1 className="text-4xl md:text-5xl font-black uppercase tracking-tighter leading-[1.05] break-words">
                {policy.title}
              </h1>
              <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-[12px] font-semibold uppercase tracking-widest text-muted-foreground">
                <div className="flex items-center gap-2">
                  <Clock className="w-3.5 h-3.5" /> Last Updated: {new Date(policy.updated_at).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })}
                </div>
                <div className="flex items-center gap-2">
                  <Shield className="w-3.5 h-3.5 text-emerald-500" /> Policy Verified
                </div>
              </div>
            </div>

            <div className="prose prose-slate dark:prose-invert max-w-none prose-sm md:prose-base prose-headings:uppercase prose-headings:font-black prose-headings:tracking-tight">
               {String(policy.content || '').split(/\n\s*\n/).map((block: string, i: number) => (
                 block.trim() ? <p key={i} className="whitespace-pre-line break-words">{block.trim()}</p> : null
               ))}
            </div>

            <div className="pt-12 border-t border-border/50 mt-12 flex flex-col items-center text-center space-y-4">
              <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center">
                <FileText className="w-6 h-6 text-primary" />
              </div>
              <div>
                <p className="text-xs font-bold">Have questions about this policy?</p>
                <p className="text-[12px] text-muted-foreground uppercase tracking-widest font-medium mt-1">Contact our team at <a href="mailto:support@cinecraftconnect.com" className="normal-case tracking-normal underline">support@cinecraftconnect.com</a></p>
              </div>
            </div>
          </article>
        ) : (
          <div className="text-center py-20">
             <h1 className="text-2xl font-black uppercase">Policy Not Found</h1>
             <p className="text-muted-foreground text-sm mt-2">The requested governance document is unavailable.</p>
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
};

export default LegalPage;
