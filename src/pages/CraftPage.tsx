
import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Profile } from '@/types';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { Briefcase, MapPin, Globe, User, Camera, Film } from 'lucide-react';
import { PageHeader } from '@/components/common/PageHeader';
import { BackButton } from '@/components/common/BackButton';

const CraftPage = () => {
  const { craftName } = useParams<{ craftName: string }>();
  const [loading, setLoading] = useState(true);
  const [professionals, setProfessionals] = useState<Profile[]>([]);

  const formattedCraftName = craftName?.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) || 'Craft';

  useEffect(() => {
    const fetchProfessionals = async () => {
      if (!craftName) return;

      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('craft', formattedCraftName);

        if (error) throw error;
        setProfessionals((data as unknown as Profile[]) || []);
      } catch (error) {
        console.error('Error fetching professionals:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchProfessionals();
  }, [craftName, formattedCraftName]);

  return (
    <div className="min-h-screen bg-background selection:bg-primary/30">
        {/* Background Orbs */}
        <div className="fixed inset-0 overflow-hidden pointer-events-none">
            <div className="absolute top-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-primary/5 blur-[120px]" />
        </div>

        <main className="max-w-7xl mx-auto px-4 md:px-8 pt-16 md:pt-20 pb-24 relative z-10">
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
                            className="rounded-2xl px-8 py-3 font-black text-xs uppercase tracking-[0.1em] transition-all data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-lg relative"
                        >
                            <User className="mr-2 h-4 w-4" />
                            Professionals
                        </TabsTrigger>
                        <TabsTrigger 
                            value="projects" 
                            className="rounded-2xl px-8 py-3 font-black text-xs uppercase tracking-[0.1em] transition-all data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-lg relative"
                        >
                            <Briefcase className="mr-2 h-4 w-4" />
                            Projects
                        </TabsTrigger>
                    </TabsList>
                </div>
                
                <TabsContent value="professionals" className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-24 space-y-4">
                            <LoadingSpinner size="lg" className="text-primary" />
                            <p className="text-xs font-black uppercase tracking-widest text-muted-foreground animate-pulse">Scanning database...</p>
                        </div>
                    ) : professionals.length > 0 ? (
                        <div className="grid grid-cols-1 gap-6 md:gap-8 sm:grid-cols-2 lg:grid-cols-3">
                            {professionals.map((pro) => (
                                <Card key={pro.id} className="bg-card/40 backdrop-blur-xl border-border/50 text-white flex flex-col group hover:border-primary/50 hover:shadow-2xl transition-all duration-500 rounded-[2.5rem] overflow-hidden">
                                    <CardContent className="p-8 flex-grow">
                                        <div className="flex items-start gap-5">
                                            <Avatar className="w-20 h-20 border-2 border-border/50 shadow-xl group-hover:scale-105 transition-transform duration-500">
                                                <AvatarImage src={pro.avatar_url || ''} alt={pro.username || ''} className="object-cover" />
                                                <AvatarFallback className="bg-primary/20 text-primary text-2xl font-black">
                                                    {pro.username?.charAt(0).toUpperCase()}
                                                </AvatarFallback>
                                            </Avatar>
                                            <div className="flex-grow pt-2">
                                                <h3 className="text-2xl font-black tracking-tight group-hover:text-primary transition-colors leading-tight">
                                                    {pro.full_name || pro.username}
                                                </h3>
                                                {pro.location && (
                                                    <div className="flex items-center text-xs font-black uppercase tracking-widest text-muted-foreground/60 mt-2">
                                                        <MapPin className="mr-2 h-3.5 w-3.5 text-primary/40" />
                                                        <span>{pro.location}</span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                        {pro.bio && (
                                            <p className="mt-8 text-lg font-medium text-muted-foreground leading-relaxed line-clamp-3">
                                                {pro.bio}
                                            </p>
                                        )}
                                    </CardContent>
                                    <div className="p-8 pt-0 flex items-center justify-between mt-auto">
                                        <div className="flex gap-4">
                                            {pro.website && (
                                                <a href={pro.website} target="_blank" rel="noopener noreferrer" className="h-12 w-12 rounded-2xl bg-muted/30 border border-white/5 flex items-center justify-center text-muted-foreground hover:text-primary hover:bg-primary/10 transition-all shadow-inner">
                                                    <Globe className="h-5 w-5" />
                                                </a>
                                            )}
                                        </div>
                                        <Button asChild className="h-12 px-8 rounded-2xl bg-primary hover:bg-primary/90 text-primary-foreground font-black uppercase tracking-widest text-xs shadow-lg shadow-primary/10">
                                            <Link to={`/profile/${pro.username}`}>View Profile</Link>
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

                <TabsContent value="projects" className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="text-center py-24 bg-card/10 border border-border/50 border-dashed rounded-[3rem]">
                        <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-6">
                            <Briefcase size={32} className="text-primary" />
                        </div>
                        <h3 className="text-2xl font-black mb-2">Project Integration Pending</h3>
                        <p className="text-muted-foreground max-w-sm mx-auto font-medium leading-relaxed">
                            We are currently curating high-fidelity {formattedCraftName} projects for this gallery. Stay tuned!
                        </p>
                    </div>
                </TabsContent>
            </Tabs>
        </main>
    </div>
  );
};

export default CraftPage;
