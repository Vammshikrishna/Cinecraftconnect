
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Search, MapPin, Users, Film, MessageCircle, UserPlus, 
  Filter, Calendar, Megaphone, PenTool, Video, Music 
} from "lucide-react";
import { useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";

const Network = () => {
  // State for collaboration post form
  const [collaborationTitle, setCollaborationTitle] = useState("");
  const [collaborationDescription, setCollaborationDescription] = useState("");
  const [collaborationCraft, setCollaborationCraft] = useState("Director");
  const [collaborationLocation, setCollaborationLocation] = useState("");
  
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

  // Mock collaboration opportunities
  const collaborations = [
    {
      id: 1,
      title: "Seeking Director for Short Film",
      description: "Looking for an experienced director for a 15-minute sci-fi short film shooting in September.",
      poster: "Emma Clark",
      posterRole: "Producer",
      posterAvatar: "/placeholder.svg",
      posterInitials: "EC",
      craft: "Director",
      location: "Los Angeles, CA",
      postedDate: "2025-04-28",
      matches: 85
    },
    {
      id: 2,
      title: "Cinematographer Needed for Music Video",
      description: "Indie band looking for creative cinematographer for an outdoor music video shoot in May.",
      poster: "Marcus Johnson",
      posterRole: "Music Video Director",
      posterAvatar: "/placeholder.svg",
      posterInitials: "MJ",
      craft: "Cinematographer",
      location: "New York, NY",
      postedDate: "2025-05-01",
      matches: 92
    },
    {
      id: 3,
      title: "Sound Designer for Documentary Project",
      description: "Feature-length documentary about climate change needs experienced sound designer.",
      poster: "Aisha Patel",
      posterRole: "Documentary Director",
      posterAvatar: "/placeholder.svg",
      posterInitials: "AP",
      craft: "Sound Designer",
      location: "Remote",
      postedDate: "2025-05-05",
      matches: 78
    },
    {
      id: 4,
      title: "Screenwriter Collaboration on TV Pilot",
      description: "Looking to co-write a drama series pilot with experienced screenwriter.",
      poster: "Jordan Rivera",
      posterRole: "Screenwriter",
      posterAvatar: "/placeholder.svg",
      posterInitials: "JR",
      craft: "Screenwriter",
      location: "Remote",
      postedDate: "2025-05-08",
      matches: 90
    }
  ];

  // Filter categories
  const filterCategories = [
    "All", "Director", "Cinematographer", "Editor", "Sound", "Production Design", "Costume", "Makeup", "VFX"
  ];

  // Handle collaboration post submission
  const handleCollaborationSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // In a real app, this would save to the database
    alert("Collaboration post submitted!");
    // Reset form
    setCollaborationTitle("");
    setCollaborationDescription("");
    setCollaborationCraft("Director");
    setCollaborationLocation("");
  };

  return (
    <div className="min-h-screen bg-cinesphere-dark">
      <Navbar />
      <main className="pt-24 pb-16 px-4 md:px-8">
        <div className="max-w-6xl mx-auto">
          <div className="flex justify-between items-center mb-8">
            <h1 className="text-3xl font-bold">Network</h1>
          </div>

          <Tabs defaultValue="professionals" className="mb-8">
            <TabsList className="grid grid-cols-2 mb-6">
              <TabsTrigger value="professionals" className="text-base">Industry Professionals</TabsTrigger>
              <TabsTrigger value="collaboration-hub" className="text-base">Collaboration Hub</TabsTrigger>
            </TabsList>
            
            <TabsContent value="professionals">
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
            </TabsContent>
            
            <TabsContent value="collaboration-hub">
              <div className="mb-8">
                <div className="glass-card rounded-xl p-6 mb-8">
                  <h2 className="text-2xl font-semibold mb-6">Post a Collaboration Opportunity</h2>
                  <form onSubmit={handleCollaborationSubmit} className="space-y-4">
                    <div>
                      <label htmlFor="title" className="block text-sm font-medium mb-1">Title</label>
                      <Input
                        id="title"
                        value={collaborationTitle}
                        onChange={(e) => setCollaborationTitle(e.target.value)}
                        placeholder="E.g., Seeking Director for Short Film"
                        className="bg-cinesphere-dark/50 border-white/10"
                        required
                      />
                    </div>
                    
                    <div>
                      <label htmlFor="description" className="block text-sm font-medium mb-1">Description</label>
                      <Textarea
                        id="description"
                        value={collaborationDescription}
                        onChange={(e) => setCollaborationDescription(e.target.value)}
                        placeholder="Describe your project and what you're looking for..."
                        className="bg-cinesphere-dark/50 border-white/10 min-h-[100px]"
                        required
                      />
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label htmlFor="craft" className="block text-sm font-medium mb-1">Craft Needed</label>
                        <select
                          id="craft"
                          value={collaborationCraft}
                          onChange={(e) => setCollaborationCraft(e.target.value)}
                          className="w-full bg-cinesphere-dark/50 border-white/10 rounded-md py-2 px-3"
                          required
                        >
                          {filterCategories.filter(c => c !== "All").map((craft) => (
                            <option key={craft} value={craft}>{craft}</option>
                          ))}
                        </select>
                      </div>
                      
                      <div>
                        <label htmlFor="location" className="block text-sm font-medium mb-1">Location</label>
                        <Input
                          id="location"
                          value={collaborationLocation}
                          onChange={(e) => setCollaborationLocation(e.target.value)}
                          placeholder="E.g., Los Angeles, Remote, etc."
                          className="bg-cinesphere-dark/50 border-white/10"
                        />
                      </div>
                    </div>
                    
                    <Button type="submit" className="bg-cinesphere-purple hover:bg-cinesphere-purple/90">
                      Post Collaboration
                    </Button>
                  </form>
                </div>
                
                <div>
                  <div className="flex justify-between items-center mb-6">
                    <h2 className="text-2xl font-semibold">Find Collaborators</h2>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" className="border-white/20">
                        <Filter size={14} className="mr-1" /> Filter
                      </Button>
                      <Button variant="outline" size="sm" className="border-white/20">
                        <Calendar size={14} className="mr-1" /> Date
                      </Button>
                    </div>
                  </div>
                  
                  <div className="space-y-6">
                    {collaborations.map((collab) => (
                      <div key={collab.id} className="glass-card rounded-xl p-6 hover:shadow-lg transition-all">
                        <div className="flex items-start gap-4">
                          <Avatar className="h-14 w-14">
                            <AvatarImage src={collab.posterAvatar} />
                            <AvatarFallback className="bg-cinesphere-purple/30 text-white">{collab.posterInitials}</AvatarFallback>
                          </Avatar>
                          
                          <div className="flex-1">
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-2">
                              <h3 className="text-xl font-semibold">{collab.title}</h3>
                              <Badge className="mt-1 sm:mt-0 w-fit bg-cinesphere-purple/20 text-cinesphere-purple border border-cinesphere-purple/30">
                                {collab.craft}
                              </Badge>
                            </div>
                            
                            <p className="text-gray-300 mb-3">{collab.description}</p>
                            
                            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-gray-400 mb-4">
                              <div className="flex items-center">
                                <UserPlus size={14} className="mr-1" />
                                Posted by {collab.poster} ({collab.posterRole})
                              </div>
                              <div className="flex items-center">
                                <MapPin size={14} className="mr-1" />
                                {collab.location}
                              </div>
                              <div className="flex items-center">
                                <Calendar size={14} className="mr-1" />
                                Posted {new Date(collab.postedDate).toLocaleDateString()}
                              </div>
                            </div>
                            
                            <div className="flex flex-col sm:flex-row gap-2">
                              <Button size="sm" className="bg-cinesphere-purple hover:bg-cinesphere-purple/90">
                                Apply for Collaboration
                              </Button>
                              <Button size="sm" variant="outline" className="border-white/20">
                                <MessageCircle size={14} className="mr-1" /> Message Poster
                              </Button>
                              <div className="hidden sm:flex items-center ml-auto text-sm">
                                <span className="text-cinesphere-purple font-medium">{collab.matches}%</span>
                                <span className="text-gray-400 ml-1">match with your profile</span>
                              </div>
                            </div>
                            <div className="sm:hidden flex items-center mt-2 text-sm">
                              <span className="text-cinesphere-purple font-medium">{collab.matches}%</span>
                              <span className="text-gray-400 ml-1">match with your profile</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default Network;
