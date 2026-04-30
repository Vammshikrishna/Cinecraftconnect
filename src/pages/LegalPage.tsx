import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Shield, ChevronLeft, FileText, Clock, Scale } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Footer from '@/components/Footer';
import Navbar from '@/components/navbar/Navbar';

export const LegalPage = () => {
  const { type } = useParams<{ type: string }>();
  const [policy, setPolicy] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPolicy = async () => {
      const { data } = await (supabase as any)
        .from('platform_policies')
        .select('*')
        .eq('type', type)
        .eq('is_active', true)
        .order('updated_at', { ascending: false })
        .limit(1)
        .single();
      
      if (data) setPolicy(data);
      setLoading(false);
    };

    fetchPolicy();
  }, [type]);

  if (loading) return null;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar />
      
      <main className="flex-1 max-w-4xl mx-auto w-full px-6 py-12">
        <Link to="/">
          <Button variant="ghost" size="sm" className="mb-8 text-xs font-bold gap-2 hover:bg-primary/5 hover:text-primary transition-all">
            <ChevronLeft className="w-4 h-4" /> Back to CineCraft
          </Button>
        </Link>

        {policy ? (
          <article className="space-y-8">
            <div className="space-y-4 border-b border-border/50 pb-8">
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-primary/10 text-primary rounded-full">
                <Scale className="w-3.5 h-3.5" />
                <span className="text-[10px] font-black uppercase tracking-widest">Platform Governance</span>
              </div>
              <h1 className="text-4xl md:text-5xl font-black uppercase tracking-tighter leading-none">
                {policy.title}
              </h1>
              <div className="flex items-center gap-6 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                <div className="flex items-center gap-2">
                  <Clock className="w-3.5 h-3.5" /> Last Updated: {new Date(policy.updated_at).toLocaleDateString()}
                </div>
                <div className="flex items-center gap-2">
                  <Shield className="w-3.5 h-3.5 text-emerald-500" /> Policy Verified
                </div>
              </div>
            </div>

            <div className="prose prose-slate dark:prose-invert max-w-none prose-sm md:prose-base prose-headings:uppercase prose-headings:font-black prose-headings:tracking-tight">
               {policy.content.split('\n').map((para: string, i: number) => (
                 para.trim() ? <p key={i}>{para}</p> : <br key={i} />
               ))}
            </div>

            <div className="pt-12 border-t border-border/50 mt-12 flex flex-col items-center text-center space-y-4">
              <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center">
                <FileText className="w-6 h-6 text-primary" />
              </div>
              <div>
                <p className="text-xs font-bold">Have questions about this policy?</p>
                <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-medium mt-1">Contact our Governance Team at legal@cinecraft.connect</p>
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
