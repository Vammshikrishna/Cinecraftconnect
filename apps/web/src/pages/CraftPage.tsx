
import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { craftSearchTerms, profileMatchesCraft, titleFromSlug, findCraft } from './craftMapping';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { Briefcase, MapPin, Globe, User, Camera, Film } from 'lucide-react';
import { PageHeader } from '@/components/common/PageHeader';
import { BackButton } from '@/components/common/BackButton';
import { formatURL } from '@/lib/utils';

type CraftPro = {
  id: string; username: string | null; full_name: string | null; avatar_url: string | null;
  location: string | null; bio: string | null; website: string | null; craft: string | null;
  is_banned?: boolean | null; onboarding_completed?: boolean | null;
};

const PRO_LIMIT = 60;

const CraftPage = () => {
  const { craftName } = useParams<{ craftName: string }>();
  const [loading, setLoading] = useState(true);
  const [professionals, setProfessionals] = useState<CraftPro[]>([]);

  const [loadError, setLoadError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const formattedCraftName = findCraft(craftName)?.label || titleFromSlug(craftName);

  useEffect(() => {
    let cancelled = false;
    const fetchProfessionals = async () => {
      if (!craftName) return;

      setLoading(true);
      setLoadError(false);
      try {
        const terms = craftSearchTerms(craftName);
        // only the columns this public page shows; the exact craft match is checked again below
        const { data, error } = await supabase
          .from('profiles')
          .select('id, username, full_name, avatar_url, location, bio, website, craft, is_banned, onboarding_completed')
          .or(terms.map((t) => `craft.ilike.%${t}%`).join(','))
          .limit(300);

        if (error) throw error;
        if (cancelled) return;
        const rows = ((data as unknown as CraftPro[]) || [])
          .filter((p) => !p.is_banned && p.onboarding_completed !== false && profileMatchesCraft(p.craft, craftName))
          .slice(0, PRO_LIMIT);
        setProfessionals(rows);
      } catch (error) {
        console.error('Error fetching professionals:', error);
        if (!cancelled) { setProfessionals([]); setLoadError(true); }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchProfessionals();
    return () => { cancelled = true; };
  }, [craftName, reloadKey]);

  return (
    <div className="min-h-dvh bg-background selection:bg-primary/30">
        {/* Background Orbs */}
        <div className="fixed inset-0 overflow-hidden pointer-events-none">
            <div className="absolute top-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-primary/5 blur-[120px]" />
        </div>

        <main className="max-w-[1560px] mx-auto px-4 md:px-8 pt-16 md:pt-20 pb-24 relative z-10">
            <BackButton label="BACK" className="mb-8" />

            <PageHeader 
                title={formattedCraftName} 
                subtitle={`Discover top professionals and noteworthy projects shaping the art of ${formattedCraftName}.`} 
                Icon={formattedCraftName.toLowerCase().includes('cinematography') || formattedCraftName.toLowerCase().includes('camera') ? Camera : Film}
            />

            <Tabs defaultValue="professionals" className="w-full mt-12">
                <div className="flex items-center justify-between mb-8 overflow-x-auto scrollbar-none pb-2 border-b border-border/20">
                    <TabsList className="bg-transparent gap-2">
                        <TabsTrigger 
                            value="professionals" 
                            className="rounded-2xl px-8 py-3 font-black text-xs uppercase tracking-[0.1em] transition-colors data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-lg relative"
                        >
                            <User className="mr-2 h-4 w-4" />
                            Professionals
                        </TabsTrigger>
                    </TabsList>
                </div>
                
                <TabsContent value="professionals" className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-24 space-y-4">
                            <LoadingSpinner size="lg" className="text-primary" />
                            <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Loading professionals...</p>
                        </div>
                    ) : loadError ? (
                        <div className="text-center py-24" role="alert">
                            <h3 className="text-2xl font-black mb-2">Could not load professionals</h3>
                            <p className="text-muted-foreground mb-6 font-medium">Check your connection and try again.</p>
                            <Button onClick={() => setReloadKey((k) => k + 1)}>Try again</Button>
                        </div>
                    ) : professionals.length > 0 ? (
                        <div className="grid grid-cols-1 gap-6 md:gap-8 sm:grid-cols-2 lg:grid-cols-3">
                            {professionals.map((pro) => (
                                <Card key={pro.id} className="bg-card/40 border-border/50 text-foreground flex flex-col group hover:border-primary/50 hover:shadow-2xl transition duration-500 rounded-[2.5rem] overflow-hidden">
                                    <CardContent className="p-5 sm:p-8 flex-grow">
                                        <div className="flex items-start gap-5">
                                            <Avatar className="w-20 h-20 border-2 border-border/50 shadow-xl [@media(hover:hover)]:group-hover:scale-105 transition-transform duration-300">
                                                <AvatarImage src={pro.avatar_url || ''} alt={pro.username || ''} className="object-cover" />
                                                <AvatarFallback className="bg-primary/20 text-primary text-2xl font-black">
                                                    {Array.from(pro.username || pro.full_name || '?')[0]?.toString().toUpperCase()}
                                                </AvatarFallback>
                                            </Avatar>
                                            <div className="flex-grow pt-2 min-w-0">
                                                <h3 className="text-2xl font-black tracking-tight group-hover:text-primary transition-colors leading-tight break-words">
                                                    {pro.full_name || pro.username}
                                                </h3>
                                                {pro.location && (
                                                    <div className="flex items-center text-xs font-black uppercase tracking-widest text-muted-foreground mt-2">
                                                        <MapPin className="mr-2 h-3.5 w-3.5 text-primary/40" />
                                                        <span>{pro.location}</span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                        {pro.bio && (
                                            <p className="mt-6 sm:mt-8 text-base font-medium text-muted-foreground leading-relaxed line-clamp-3 break-words">
                                                {pro.bio}
                                            </p>
                                        )}
                                    </CardContent>
                                    <div className="p-5 sm:p-8 pt-0 flex items-center justify-between mt-auto">
                                        <div className="flex gap-4">
                                            {pro.website && (
                                                <a href={formatURL(pro.website)} target="_blank" rel="noopener noreferrer" aria-label={`Website of ${pro.full_name || pro.username || 'this professional'}`} className="h-12 w-12 rounded-2xl bg-muted/30 border border-foreground/5 flex items-center justify-center text-muted-foreground hover:text-primary hover:bg-primary/10 transition shadow-inner">
                                                    <Globe className="h-5 w-5" />
                                                </a>
                                            )}
                                        </div>
                                        <Button asChild className="h-12 px-8 rounded-2xl bg-primary hover:bg-primary/90 text-primary-foreground font-black uppercase tracking-widest text-xs shadow-lg shadow-primary/10">
                                            <Link to={`/profile/${pro.username || pro.id}`}>View Profile</Link>
                                        </Button>
                                    </div>
                                </Card>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-24 bg-card/10 border border-border/50 border-dashed rounded-[3rem]">
                            <div className="w-20 h-20 rounded-full bg-muted/20 flex items-center justify-center mx-auto mb-6">
                                <User size={32} className="text-muted-foreground/40" />
                            </div>
                            <h3 className="text-2xl font-black mb-2">No professionals yet</h3>
                            <p className="text-muted-foreground max-w-sm mx-auto font-medium">
                                Be the first professional to establish a presence in {formattedCraftName}!
                            </p>
                        </div>
                    )}
                </TabsContent>
            </Tabs>
        </main>
    </div>
  );
};

export default CraftPage;
