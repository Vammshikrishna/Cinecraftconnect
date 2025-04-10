
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, MapPin, Users, Film, MessageCircle, UserPlus } from "lucide-react";

const Network = () => {
  // Mock professionals data
  const professionals = [
    {
      id: 1,
      name: "Sophia Chen",
      role: "Cinematographer",
      location: "Los Angeles, CA",
      connections: 342,
      projects: 18,
      avatar: "/placeholder.svg",
      initials: "SC"
    },
    {
      id: 2,
      name: "Marcus Johnson",
      role: "Director",
      location: "New York, NY",
      connections: 517,
      projects: 24,
      avatar: "/placeholder.svg",
      initials: "MJ"
    },
    {
      id: 3,
      name: "Aisha Patel",
      role: "Production Designer",
      location: "Toronto, Canada",
      connections: 215,
      projects: 12,
      avatar: "/placeholder.svg",
      initials: "AP"
    },
    {
      id: 4,
      name: "Jordan Rivera",
      role: "Sound Designer",
      location: "Austin, TX",
      connections: 189,
      projects: 31,
      avatar: "/placeholder.svg",
      initials: "JR"
    },
    {
      id: 5,
      name: "Emma Clark",
      role: "Editor",
      location: "London, UK",
      connections: 276,
      projects: 22,
      avatar: "/placeholder.svg",
      initials: "EC"
    },
    {
      id: 6,
      name: "Leo Kim",
      role: "Screenwriter",
      location: "Vancouver, Canada",
      connections: 198,
      projects: 15,
      avatar: "/placeholder.svg",
      initials: "LK"
    }
  ];

  // Filter categories
  const filterCategories = [
    "All", "Director", "Cinematographer", "Editor", "Sound", "Production Design", "Costume", "Makeup", "VFX"
  ];

  return (
    <div className="min-h-screen bg-cinesphere-dark">
      <Navbar />
      <main className="pt-24 pb-16 px-4 md:px-8">
        <div className="max-w-6xl mx-auto">
          <div className="flex justify-between items-center mb-8">
            <h1 className="text-3xl font-bold">Network</h1>
          </div>

          {/* Search and Filter Bar */}
          <div className="glass-card rounded-xl p-4 mb-8">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="relative flex-grow">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <Input 
                  placeholder="Search for professionals..."
                  className="pl-10 bg-cinesphere-dark/50 border-white/10"
                />
              </div>
            </div>
            
            {/* Filter Pills */}
            <div className="mt-4 flex flex-wrap gap-2">
              {filterCategories.map((category, index) => (
                <Button 
                  key={category} 
                  variant={index === 0 ? "default" : "outline"} 
                  size="sm"
                  className={index === 0 ? "bg-cinesphere-purple" : "border-white/20"}
                >
                  {category}
                </Button>
              ))}
            </div>
          </div>

          {/* Professionals Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {professionals.map((professional) => (
              <div key={professional.id} className="glass-card rounded-xl p-6 hover:shadow-lg transition-all">
                <div className="flex items-start gap-4">
                  <Avatar className="h-14 w-14">
                    <AvatarImage src={professional.avatar} />
                    <AvatarFallback className="bg-cinesphere-purple/30 text-white">{professional.initials}</AvatarFallback>
                  </Avatar>
                  
                  <div className="flex-1">
                    <h3 className="text-xl font-semibold">{professional.name}</h3>
                    <p className="text-cinesphere-purple mb-1">{professional.role}</p>
                    <div className="flex items-center text-sm text-gray-400 mb-3">
                      <MapPin size={14} className="mr-1" />
                      {professional.location}
                    </div>
                    
                    <div className="flex justify-between text-sm text-gray-300 mb-4">
                      <div className="flex items-center">
                        <Users size={14} className="mr-1 text-gray-400" />
                        {professional.connections} connections
                      </div>
                      <div className="flex items-center">
                        <Film size={14} className="mr-1 text-gray-400" />
                        {professional.projects} projects
                      </div>
                    </div>
                    
                    <div className="flex gap-2">
                      <Button size="sm" className="flex-1 bg-cinesphere-purple hover:bg-cinesphere-purple/90">
                        <UserPlus size={14} className="mr-1" /> Connect
                      </Button>
                      <Button size="sm" variant="outline" className="flex-1 border-white/20">
                        <MessageCircle size={14} className="mr-1" /> Message
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default Network;
