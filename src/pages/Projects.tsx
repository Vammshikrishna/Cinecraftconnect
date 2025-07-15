
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { useState, useEffect } from "react";
import { Plus, MapPin, DollarSign, Eye, Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const Projects = () => {
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchProjects = async () => {
    try {
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setProjects(data || []);
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to load projects",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  // Mock projects for demo (since no real projects exist yet)
  const mockProjects = [
    {
      id: 1,
      title: "Midnight Chronicles",
      description: "A dark thriller exploring the depths of human psychology",
      status: "production",
      budget_min: 50000,
      budget_max: 100000,
      genre: ["Thriller", "Drama"],
      location: "New York",
      creator: "Sarah Director"
    },
    {
      id: 2,
      title: "Silent Echoes",
      description: "An intimate documentary about forgotten voices",
      status: "post_production",
      budget_min: 25000,
      budget_max: 50000,
      genre: ["Documentary"],
      location: "Los Angeles",
      creator: "Mike Producer"
    },
    {
      id: 3,
      title: "Neon Dreams",
      description: "A cyberpunk short film set in 2087",
      status: "planning",
      budget_min: 15000,
      budget_max: 30000,
      genre: ["Sci-Fi", "Short"],
      location: "Remote",
      creator: "Alex Visionary"
    }
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'planning': return 'bg-blue-500/20 text-blue-300';
      case 'development': return 'bg-yellow-500/20 text-yellow-300';
      case 'production': return 'bg-green-500/20 text-green-300';
      case 'post_production': return 'bg-purple-500/20 text-purple-300';
      case 'completed': return 'bg-emerald-500/20 text-emerald-300';
      default: return 'bg-gray-500/20 text-gray-300';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-cinesphere-dark to-black">
      <Navbar />
      <main className="pt-24 pb-16 px-4 md:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex justify-between items-center mb-8">
            <div>
              <h1 className="text-3xl md:text-4xl font-bold mb-2">Projects</h1>
              <p className="text-gray-400">Discover and collaborate on exciting film projects</p>
            </div>
            <Button className="bg-cinesphere-purple hover:bg-cinesphere-purple/90">
              <Plus className="mr-2 h-4 w-4" />
              Create Project
            </Button>
          </div>

          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="h-64 bg-muted animate-pulse rounded-lg" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {mockProjects.map((project) => (
                <Card key={project.id} className="glass-card hover:shadow-xl transition-all duration-300 group">
                  <CardContent className="p-6">
                    <div className="flex justify-between items-start mb-4">
                      <h3 className="text-xl font-bold group-hover:text-cinesphere-purple transition-colors">
                        {project.title}
                      </h3>
                      <Badge className={getStatusColor(project.status)}>
                        {project.status.replace('_', ' ')}
                      </Badge>
                    </div>
                    
                    <p className="text-gray-300 mb-4 line-clamp-3">
                      {project.description}
                    </p>
                    
                    <div className="space-y-3">
                      <div className="flex items-center text-sm text-gray-400">
                        <MapPin className="mr-2 h-4 w-4" />
                        {project.location}
                      </div>
                      
                      <div className="flex items-center text-sm text-gray-400">
                        <DollarSign className="mr-2 h-4 w-4" />
                        ${project.budget_min?.toLocaleString()} - ${project.budget_max?.toLocaleString()}
                      </div>
                      
                      <div className="flex flex-wrap gap-1 mb-4">
                        {project.genre?.map((genre: string, index: number) => (
                          <Badge key={index} variant="outline" className="text-xs">
                            {genre}
                          </Badge>
                        ))}
                      </div>
                      
                      <div className="flex items-center justify-between pt-4 border-t border-white/10">
                        <span className="text-sm text-gray-400">by {project.creator}</span>
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline">
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button size="sm" className="bg-cinesphere-purple hover:bg-cinesphere-purple/90">
                            <Heart className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
              
              {/* Create New Project Card */}
              <Card className="glass-card hover:shadow-xl transition-all duration-300 group cursor-pointer border-dashed border-2 border-cinesphere-purple/30 hover:border-cinesphere-purple">
                <CardContent className="p-6 flex flex-col items-center justify-center h-full min-h-[300px]">
                  <Plus className="h-12 w-12 text-cinesphere-purple mb-4 group-hover:scale-110 transition-transform" />
                  <h3 className="text-xl font-bold mb-2 text-center">Create New Project</h3>
                  <p className="text-gray-400 text-center">Start your next film project and find collaborators</p>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default Projects;
