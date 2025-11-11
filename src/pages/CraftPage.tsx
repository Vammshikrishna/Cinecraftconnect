import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Profile } from '@/types';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { Briefcase, MapPin, Globe, User } from 'lucide-react';

const CraftPage = () => {
  const { craftName } = useParams<{ craftName: string }>();
  const [loading, setLoading] = useState(true);
  const [professionals, setProfessionals] = useState<Profile[]>([]);
  // Projects functionality will be implemented in a future step.

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
        setProfessionals(data || []);
      } catch (error) {
        console.error('Error fetching professionals:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchProfessionals();
  }, [craftName, formattedCraftName]);

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold tracking-tight text-white sm:text-6xl">
          {formattedCraftName}
        </h1>
        <p className="mt-4 text-lg leading-8 text-gray-400">
          Discover top professionals and noteworthy projects in {formattedCraftName}.
        </p>
      </div>

      <Tabs defaultValue="professionals" className="w-full">
        <TabsList className="grid w-full grid-cols-2 bg-gray-900/80 h-12">
          <TabsTrigger value="professionals" className="text-gray-400 data-[state=active]:text-white data-[state=active]:bg-gray-800/80 rounded-md">
            <User className="mr-2 h-4 w-4" />
            Professionals
          </TabsTrigger>
          <TabsTrigger value="projects" className="text-gray-400 data-[state=active]:text-white data-[state=active]:bg-gray-800/80 rounded-md">
            <Briefcase className="mr-2 h-4 w-4" />
            Projects
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="professionals" className="mt-8">
          {loading ? (
            <div className="flex justify-center py-12">
              <LoadingSpinner size="lg" />
            </div>
          ) : (
            professionals.length > 0 ? (
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {professionals.map((pro) => (
                  <Card key={pro.id} className="bg-gray-900/60 border-gray-800 text-white flex flex-col">
                    <CardContent className="p-6 flex-grow">
                      <div className="flex items-start gap-4">
                        <Avatar className="w-16 h-16 border-2 border-gray-700">
                          <AvatarImage src={pro.avatar_url || ''} alt={pro.username || ''} />
                          <AvatarFallback>{pro.username?.charAt(0).toUpperCase()}</AvatarFallback>
                        </Avatar>
                        <div className="flex-grow">
                          <h3 className="text-lg font-semibold text-white">{pro.full_name || pro.username}</h3>
                          {pro.location && (
                            <div className="flex items-center text-sm text-gray-400 mt-1">
                              <MapPin className="mr-2 h-4 w-4" />
                              <span>{pro.location}</span>
                            </div>
                          )}
                        </div>
                      </div>
                      {pro.bio && <p className="mt-4 text-sm text-gray-300 line-clamp-3">{pro.bio}</p>}
                    </CardContent>
                    <div className="p-6 pt-0 flex items-center justify-between">
                      {pro.website && (
                        <a href={pro.website} target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-white transition-colors">
                          <Globe className="h-5 w-5" />
                        </a>
                      )}
                       <Button asChild variant="secondary" size="sm" className="ml-auto bg-gray-800 hover:bg-gray-700">
                        <Link to={`/profile/${pro.username}`}>View Profile</Link>
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <p className="text-gray-400">No professionals found for this craft yet.</p>
              </div>
            )
          )}
        </TabsContent>

        <TabsContent value="projects" className="mt-8">
           <div className="text-center py-12">
              <p className="text-gray-400">Project integration is coming soon. Stay tuned!</p>
            </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default CraftPage;
