import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { BadgeCheck, Lock, Film, ExternalLink, ArrowUpRight } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Link } from 'react-router-dom';

interface ProjectCredit {
  id: string;
  project_id: string | null;
  project_title: string;
  user_id: string;
  role: string;
  verifier_id: string | null;
  created_at: string;
  profiles?: {
    full_name: string | null;
    username: string | null;
  } | null;
}

export const VerifiedCredits = ({ userId }: { userId: string }) => {
  const [credits, setCredits] = useState<ProjectCredit[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchCredits = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('project_credits')
        .select(`
          *,
          profiles:verifier_id (
            full_name,
            username
          )
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setCredits((data as any) || []);
    } catch (error: any) {
      toast({
        title: 'Error loading credits',
        description: error.message || 'Failed to retrieve verified production credits.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [userId, toast]);

  useEffect(() => {
    fetchCredits();
  }, [fetchCredits]);

  if (loading) {
    return <div className="p-8 text-center text-muted-foreground">Loading verified credits...</div>;
  }

  if (credits.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center glass-card border border-border/40 rounded-[32px] p-6 max-w-xl mx-auto">
        <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-6 border border-primary/20">
          <Film className="w-8 h-8 text-primary" />
        </div>
        <h3 className="text-xl font-bold text-foreground mb-2">No Verified Credits Yet</h3>
        <p className="text-muted-foreground max-w-xs text-sm">
          Verified credits are officially locked to your profile when a director/project creator wraps a production space and tags your crew role.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between px-2">
        <div className="flex items-center gap-2">
          <BadgeCheck className="h-5 w-5 text-amber-500 fill-amber-500/10" />
          <span className="text-sm font-black text-amber-500 uppercase tracking-widest">
            Verified Filmography
          </span>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-semibold">
          <Lock className="h-3 w-3" /> Locked & Verified
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {credits.map((credit) => (
          <Card 
            key={credit.id} 
            className="group relative bg-card/40 backdrop-blur-xl border border-border/50 rounded-2xl overflow-hidden hover:scale-[1.02] hover:border-primary/30 transition-all duration-300 shadow-md"
          >
            <div className="absolute inset-0 bg-gradient-to-tr from-amber-500/5 via-primary/0 to-primary/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />

            <CardContent className="p-6 relative z-10 flex flex-col justify-between h-full gap-4">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <span className="text-[10px] font-black text-amber-500 uppercase tracking-[0.2em] block">
                    {credit.role}
                  </span>
                  <h3 className="text-lg font-black text-foreground tracking-tight line-clamp-1 group-hover:text-primary transition-colors">
                    {credit.project_title}
                  </h3>
                </div>
                <div className="shrink-0 bg-amber-500/10 p-2 rounded-xl border border-amber-500/20 shadow-inner">
                  <BadgeCheck className="h-4 w-4 text-amber-500" />
                </div>
              </div>

              <div className="flex items-center justify-between border-t border-border/30 pt-4 text-xs">
                <div className="space-y-0.5">
                  <p className="text-[9px] text-muted-foreground uppercase tracking-widest font-black opacity-60">Verified By</p>
                  {credit.profiles ? (
                    <Link 
                      to={`/profile/${credit.verifier_id}`} 
                      className="font-bold text-foreground hover:text-primary transition-colors inline-flex items-center gap-1"
                    >
                      {credit.profiles.full_name || `@${credit.profiles.username}`}
                      <ArrowUpRight className="h-3 w-3 opacity-50" />
                    </Link>
                  ) : (
                    <span className="font-semibold text-muted-foreground">System / Anonymous</span>
                  )}
                </div>

                {credit.project_id && (
                  <Link 
                    to={`/projects/${credit.project_id}`}
                    className="flex items-center gap-1.5 bg-muted/30 border border-border/50 px-3 py-1.5 rounded-lg font-bold text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-all text-[10px] uppercase tracking-wider"
                  >
                    View Project <ExternalLink className="h-3 w-3" />
                  </Link>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};
