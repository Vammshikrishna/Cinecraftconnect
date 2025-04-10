
import { useParams } from "react-router-dom";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Film, User, Search } from "lucide-react";
import { Input } from "@/components/ui/input";

const CraftPage = () => {
  const { craftName } = useParams<{ craftName: string }>();
  
  // Format the craft name for display (convert from URL format)
  const formattedCraftName = craftName ? craftName.charAt(0).toUpperCase() + craftName.slice(1).replace(/-/g, ' ') : '';
  
  // Mock professionals data for this craft
  const professionals = [
    {
      id: 1,
      name: "Emma Rodriguez",
      title: `Senior ${formattedCraftName} Professional`,
      location: "Los Angeles, CA",
      bio: "Award-winning professional with over 10 years of experience in international productions.",
      avatar: "/placeholder.svg",
      initials: "ER"
    },
    {
      id: 2,
      name: "Marcus Chen",
      title: `${formattedCraftName} Specialist`,
      location: "New York, NY",
      bio: "Specializing in independent films and documentaries with a unique visual style.",
      avatar: "/placeholder.svg",
      initials: "MC"
    },
    {
      id: 3,
      name: "Aisha Johnson",
      title: `${formattedCraftName}`,
      location: "Atlanta, GA",
      bio: "Rising talent with a fresh perspective and innovative approach to storytelling.",
      avatar: "/placeholder.svg",
      initials: "AJ"
    }
  ];
  
  // Mock projects for this craft
  const projects = [
    {
      id: 1,
      title: "The Silent Echo",
      type: "Feature Film",
      description: `A dramatic story showcasing exceptional ${formattedCraftName.toLowerCase()} work.`
    },
    {
      id: 2,
      title: "Urban Rhythms",
      type: "Documentary Series",
      description: `Exploring city life through innovative ${formattedCraftName.toLowerCase()} techniques.`
    },
    {
      id: 3,
      title: "Beyond the Horizon",
      type: "Short Film",
      description: `Award-winning ${formattedCraftName.toLowerCase()} in this science fiction narrative.`
    }
  ];

  return (
    <div className="min-h-screen bg-cinesphere-dark">
      <Navbar />
      <main className="pt-24 pb-16 px-4 md:px-8">
        <div className="max-w-6xl mx-auto">
          {/* Craft Header */}
          <div className="glass-card rounded-xl p-8 mb-12 text-center">
            <h1 className="text-3xl md:text-4xl font-bold mb-4">
              {formattedCraftName}
            </h1>
            <p className="text-xl text-gray-300 max-w-3xl mx-auto mb-6">
              Connect with professionals specializing in {formattedCraftName.toLowerCase()} and discover related projects.
            </p>
            
            {/* Search Bar */}
            <div className="max-w-xl mx-auto">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <Input 
                  placeholder={`Search ${formattedCraftName} professionals and projects...`}
                  className="pl-10 bg-cinesphere-dark/50 border-white/10"
                />
              </div>
            </div>
          </div>
          
          {/* Two Column Layout */}
          <div className="grid md:grid-cols-3 gap-8">
            {/* Left Column: Professionals */}
            <div className="md:col-span-2">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold">Top Professionals</h2>
                <Button variant="outline" className="border-white/20">
                  View All
                </Button>
              </div>
              
              <div className="space-y-6">
                {professionals.map((professional) => (
                  <div key={professional.id} className="glass-card rounded-xl p-6 hover:shadow-lg transition-all">
                    <div className="flex items-start gap-4">
                      <Avatar className="h-16 w-16">
                        <AvatarImage src={professional.avatar} />
                        <AvatarFallback className="bg-cinesphere-purple/30 text-white text-xl">{professional.initials}</AvatarFallback>
                      </Avatar>
                      
                      <div className="flex-1">
                        <h3 className="text-xl font-semibold">{professional.name}</h3>
                        <p className="text-cinesphere-purple mb-1">{professional.title}</p>
                        <p className="text-sm text-gray-400 mb-3">{professional.location}</p>
                        <p className="text-gray-300 mb-4">{professional.bio}</p>
                        
                        <div className="flex gap-2">
                          <Button size="sm" className="bg-cinesphere-purple hover:bg-cinesphere-purple/90">
                            Connect
                          </Button>
                          <Button size="sm" variant="outline" className="border-white/20">
                            View Profile
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            
            {/* Right Column: Projects & Resources */}
            <div>
              <h2 className="text-2xl font-bold mb-6">Featured Projects</h2>
              
              <div className="space-y-4 mb-8">
                {projects.map((project) => (
                  <div key={project.id} className="glass-card rounded-xl p-4 hover:bg-white/5 transition-colors">
                    <h3 className="text-lg font-semibold">{project.title}</h3>
                    <p className="text-sm text-cinesphere-purple mb-2">{project.type}</p>
                    <p className="text-sm text-gray-300">{project.description}</p>
                  </div>
                ))}
                
                <Button variant="outline" className="w-full border-white/20">
                  Explore More Projects
                </Button>
              </div>
              
              {/* Resources Section */}
              <h2 className="text-2xl font-bold mb-4">Resources</h2>
              <div className="glass-card rounded-xl p-4 mb-4">
                <h3 className="font-semibold mb-2">Learning Materials</h3>
                <ul className="text-sm text-gray-300 space-y-2">
                  <li className="text-cinesphere-purple hover:underline cursor-pointer">
                    Best Practices for {formattedCraftName}
                  </li>
                  <li className="text-cinesphere-purple hover:underline cursor-pointer">
                    Industry Standards Guide
                  </li>
                  <li className="text-cinesphere-purple hover:underline cursor-pointer">
                    Equipment & Technical Resources
                  </li>
                </ul>
              </div>
              
              <div className="glass-card rounded-xl p-4">
                <h3 className="font-semibold mb-2">Upcoming Events</h3>
                <div className="text-sm text-gray-300">
                  <p className="mb-1">{formattedCraftName} Masterclass</p>
                  <p className="text-xs text-gray-400 mb-3">July 15, 2025 • Online</p>
                  <Button size="sm" variant="outline" className="w-full border-white/20">
                    View All Events
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default CraftPage;
