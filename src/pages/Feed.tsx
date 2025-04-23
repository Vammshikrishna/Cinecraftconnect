import { useState } from "react";
import { Link } from "react-router-dom";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Heart, MessageCircle, Share2, Film, Camera, PenTool, Music, Scissors, Video, Mic, Play } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import StarRating from "@/components/StarRating";

const mockPosts = [
  {
    id: 1,
    author: {
      name: "Alex Rivera",
      role: "Director",
      initials: "AR"
    },
    timeAgo: "2 hours ago",
    content: "Just wrapped principal photography on my new short film 'Echoes in Silence'. Can't wait to share more during the post-production journey!",
    likes: 42,
    comments: 8,
    tags: ["directing", "shortfilm", "indiefilm"]
  },
  {
    id: 2,
    author: {
      name: "Maya Chen",
      role: "Cinematographer",
      initials: "MC"
    },
    timeAgo: "5 hours ago",
    content: "Testing some new lighting setups for an upcoming music video shoot. Playing with dramatic shadows and neon accents. What do you think?",
    hasImage: true,
    imageAlt: "Dramatic lighting setup with neon accents",
    isAIGenerated: true,
    likes: 67,
    comments: 12,
    tags: ["cinematography", "lighting", "musicvideo"]
  },
  {
    id: 3,
    author: {
      name: "James Wilson",
      role: "Production Designer",
      initials: "JW"
    },
    timeAgo: "1 day ago",
    content: "Just finished these concept sketches for our sci-fi short. Going for a retro-futuristic aesthetic inspired by 70s space films but with a modern twist.",
    hasImage: true,
    imageAlt: "Concept sketches for sci-fi short film",
    isAIGenerated: true,
    likes: 35,
    comments: 6,
    tags: ["productiondesign", "conceptart", "scifi"]
  },
  {
    id: 4,
    author: {
      name: "Sofia Patel",
      role: "VFX Artist",
      initials: "SP"
    },
    timeAgo: "3 hours ago",
    content: "Check out this VFX breakdown of our latest short film. Used a combination of practical effects and AI-assisted digital compositing.",
    hasVideo: true,
    videoThumbnail: "VFX breakdown video",
    isAIGenerated: true,
    likes: 92,
    comments: 24,
    tags: ["vfx", "filmmaking", "AI"]
  }
];

const craftFilters = [
  { name: "All", icon: null, active: true },
  { name: "Directing", icon: <Film size={16} />, active: false },
  { name: "Cinematography", icon: <Camera size={16} />, active: false },
  { name: "Writing", icon: <PenTool size={16} />, active: false },
  { name: "Sound", icon: <Music size={16} />, active: false },
  { name: "Editing", icon: <Scissors size={16} />, active: false }
];

const Feed = () => {
  const [activeFilter, setActiveFilter] = useState("All");
  const [activeTab, setActiveTab] = useState("feed");
  const [postRatings, setPostRatings] = useState<{ [postId: number]: number }>({});

  const handleRate = (postId: number, rating: number) => {
    setPostRatings((curr) => ({ ...curr, [postId]: rating }));
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-cinesphere-dark to-black">
      <Navbar />
      <main className="pt-24 pb-16 px-4 md:px-8">
        <div className="max-w-5xl mx-auto">
          <Tabs defaultValue="feed" className="mb-8" onValueChange={setActiveTab}>
            <TabsList className="grid grid-cols-3 mb-6 bg-black/30 backdrop-blur-sm border border-white/10 rounded-lg">
              <TabsTrigger value="feed" className="data-[state=active]:bg-cinesphere-purple/20">
                <Play size={16} className="mr-2" />
                Feed
              </TabsTrigger>
              <TabsTrigger value="discussion" className="data-[state=active]:bg-cinesphere-purple/20">
                <Video size={16} className="mr-2" />
                Discussion Room
              </TabsTrigger>
              <TabsTrigger value="chats" className="data-[state=active]:bg-cinesphere-purple/20">
                <MessageCircle size={16} className="mr-2" />
                Chats
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="feed">
              <div className="mb-8 overflow-x-auto">
                <div className="flex space-x-2 min-w-max">
                  {craftFilters.map((filter) => (
                    <Button
                      key={filter.name}
                      variant={filter.name === activeFilter ? "default" : "outline"}
                      className={`px-4 py-2 rounded-full ${
                        filter.name === activeFilter 
                          ? "bg-gradient-to-r from-cinesphere-purple to-cinesphere-blue hover:from-cinesphere-purple/90 hover:to-cinesphere-blue/90" 
                          : "border-white/20 hover:bg-white/5"
                      }`}
                      onClick={() => setActiveFilter(filter.name)}
                    >
                      <div className="flex items-center">
                        {filter.icon && <span className="mr-2">{filter.icon}</span>}
                        <span>{filter.name}</span>
                      </div>
                    </Button>
                  ))}
                </div>
              </div>
              
              <div className="space-y-6">
                {mockPosts.map((post) => (
                  <div key={post.id} className="glass-card rounded-xl p-6 transition-all duration-300 hover:shadow-[0_0_15px_rgba(155,135,245,0.3)]">
                    <div className="flex items-center mb-4">
                      <Avatar className="h-10 w-10 mr-3">
                        <AvatarImage src="/placeholder.svg" />
                        <AvatarFallback className="bg-gradient-to-br from-cinesphere-purple to-cinesphere-blue text-white">{post.author.initials}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-semibold">{post.author.name}</p>
                            <p className="text-xs text-gray-400">{post.author.role} • {post.timeAgo}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    <p className="mb-4">{post.content}</p>
                    
                    {post.hasImage && (
                      <div className="mb-4 rounded-lg overflow-hidden bg-cinesphere-dark/50 h-64 flex items-center justify-center relative">
                        <div className="absolute inset-0 flex items-center justify-center backdrop-blur-sm">
                          <p className="text-gray-400">{post.imageAlt || "Image"}</p>
                        </div>
                        {post.isAIGenerated && (
                          <div className="absolute top-2 right-2 bg-gradient-to-r from-cinesphere-purple to-cinesphere-blue text-white text-xs px-2 py-1 rounded-full">
                            AI Generated
                          </div>
                        )}
                      </div>
                    )}
                    
                    {post.hasVideo && (
                      <div className="mb-4 rounded-lg overflow-hidden bg-cinesphere-dark/50 h-80 flex items-center justify-center relative">
                        <div className="absolute inset-0 flex items-center justify-center backdrop-blur-sm">
                          <p className="text-gray-400">{post.videoThumbnail}</p>
                          <Button variant="default" size="icon" className="absolute bg-cinesphere-purple/80 hover:bg-cinesphere-purple">
                            <Play size={24} />
                          </Button>
                        </div>
                        {post.isAIGenerated && (
                          <div className="absolute top-2 right-2 bg-gradient-to-r from-cinesphere-purple to-cinesphere-blue text-white text-xs px-2 py-1 rounded-full">
                            AI Generated
                          </div>
                        )}
                      </div>
                    )}
                    
                    <div className="flex flex-wrap gap-2 mb-4">
                      {post.tags && post.tags.map((tag) => (
                        <span 
                          key={tag} 
                          className="text-xs px-2 py-1 bg-white/10 rounded-full text-gray-300 hover:bg-cinesphere-purple/20 cursor-pointer"
                        >
                          #{tag}
                        </span>
                      ))}
                    </div>
                    
                    <div className="flex items-center justify-between pt-4 border-t border-white/10">
                      <Button variant="ghost" size="sm" className="text-gray-400 hover:text-cinesphere-purple hover:bg-cinesphere-purple/10 flex items-center">
                        <Heart size={18} className="mr-1" />
                        <span>{post.likes}</span>
                      </Button>
                      <Button variant="ghost" size="sm" className="text-gray-400 hover:text-cinesphere-purple hover:bg-cinesphere-purple/10 flex items-center">
                        <MessageCircle size={18} className="mr-1" />
                        <span>{post.comments}</span>
                      </Button>
                      <Button variant="ghost" size="sm" className="text-gray-400 hover:text-cinesphere-purple hover:bg-cinesphere-purple/10">
                        <Share2 size={18} />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </TabsContent>
            
            <TabsContent value="discussion">
              <div className="glass-card rounded-xl p-6">
                <h2 className="text-xl font-bold mb-4 text-gradient">Discussion Rooms</h2>
                <p className="mb-6 text-gray-300">Connect with other filmmakers in virtual rooms to discuss projects, share ideas, and collaborate.</p>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                  <div className="border border-white/10 rounded-lg p-4 bg-gradient-to-b from-black/40 to-cinesphere-purple/10 hover:from-black/30 hover:to-cinesphere-purple/20 transition-all cursor-pointer">
                    <div className="flex justify-between items-start mb-3">
                      <h3 className="font-semibold">Indie Film Financing</h3>
                      <div className="bg-cinesphere-purple/30 px-2 py-1 rounded text-xs">5 members</div>
                    </div>
                    <p className="text-sm text-gray-400 mb-4">Ongoing discussion about creative funding strategies for independent productions.</p>
                    <div className="flex justify-between items-center">
                      <div className="flex -space-x-2">
                        <Avatar className="h-6 w-6 border border-black">
                          <AvatarFallback className="bg-cinesphere-purple/50 text-xs">JD</AvatarFallback>
                        </Avatar>
                        <Avatar className="h-6 w-6 border border-black">
                          <AvatarFallback className="bg-cinesphere-blue/50 text-xs">TS</AvatarFallback>
                        </Avatar>
                        <Avatar className="h-6 w-6 border border-black">
                          <AvatarFallback className="bg-cinesphere-purple/80 text-xs">KL</AvatarFallback>
                        </Avatar>
                      </div>
                      <div className="flex space-x-2">
                        <Button size="sm" variant="ghost" className="h-8 w-8 p-0">
                          <Mic size={16} />
                        </Button>
                        <Button size="sm" variant="default" className="h-8 px-3 bg-gradient-to-r from-cinesphere-purple to-cinesphere-blue">
                          <Video size={16} className="mr-1" />
                          Join
                        </Button>
                      </div>
                    </div>
                  </div>
                  
                  <div className="border border-white/10 rounded-lg p-4 bg-gradient-to-b from-black/40 to-cinesphere-blue/10 hover:from-black/30 hover:to-cinesphere-blue/20 transition-all cursor-pointer">
                    <div className="flex justify-between items-start mb-3">
                      <h3 className="font-semibold">Post-Production Workflow</h3>
                      <div className="bg-cinesphere-blue/30 px-2 py-1 rounded text-xs">8 members</div>
                    </div>
                    <p className="text-sm text-gray-400 mb-4">Tips and tricks for optimizing your post-production pipeline.</p>
                    <div className="flex justify-between items-center">
                      <div className="flex -space-x-2">
                        <Avatar className="h-6 w-6 border border-black">
                          <AvatarFallback className="bg-cinesphere-purple/50 text-xs">AR</AvatarFallback>
                        </Avatar>
                        <Avatar className="h-6 w-6 border border-black">
                          <AvatarFallback className="bg-cinesphere-blue/50 text-xs">MC</AvatarFallback>
                        </Avatar>
                        <Avatar className="h-6 w-6 border border-black">
                          <AvatarFallback className="bg-cinesphere-purple/80 text-xs">+5</AvatarFallback>
                        </Avatar>
                      </div>
                      <div className="flex space-x-2">
                        <Button size="sm" variant="ghost" className="h-8 w-8 p-0">
                          <Mic size={16} />
                        </Button>
                        <Button size="sm" variant="default" className="h-8 px-3 bg-gradient-to-r from-cinesphere-purple to-cinesphere-blue">
                          <Video size={16} className="mr-1" />
                          Join
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
                
                <Button className="w-full bg-gradient-to-r from-cinesphere-purple to-cinesphere-blue hover:from-cinesphere-purple/90 hover:to-cinesphere-blue/90">
                  Create New Discussion Room
                </Button>
              </div>
            </TabsContent>
            
            <TabsContent value="chats">
              <div className="glass-card rounded-xl p-6">
                <h2 className="text-xl font-bold mb-4 text-gradient">Messages</h2>
                <p className="mb-6 text-gray-300">Chat with other filmmakers, collaborators, and mentors.</p>
                
                <div className="space-y-3 mb-6">
                  <div className="flex items-center p-3 rounded-lg hover:bg-white/5 cursor-pointer transition-colors">
                    <Avatar className="h-10 w-10 mr-3">
                      <AvatarFallback className="bg-gradient-to-br from-cinesphere-purple to-cinesphere-blue">MC</AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <div className="flex justify-between">
                        <h4 className="font-medium">Maya Chen</h4>
                        <span className="text-xs text-gray-400">2h ago</span>
                      </div>
                      <p className="text-sm text-gray-400 truncate">Can you share those lighting references?</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center p-3 rounded-lg hover:bg-white/5 cursor-pointer transition-colors">
                    <Avatar className="h-10 w-10 mr-3">
                      <AvatarFallback className="bg-gradient-to-br from-cinesphere-blue to-green-400">JW</AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <div className="flex justify-between">
                        <h4 className="font-medium">James Wilson</h4>
                        <span className="text-xs text-gray-400">1d ago</span>
                      </div>
                      <p className="text-sm text-gray-400 truncate">Let me know what you think of the new concept art!</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center p-3 rounded-lg hover:bg-white/5 cursor-pointer transition-colors">
                    <Avatar className="h-10 w-10 mr-3">
                      <AvatarFallback className="bg-gradient-to-br from-orange-400 to-red-500">SP</AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <div className="flex justify-between">
                        <h4 className="font-medium">Sofia Patel</h4>
                        <span className="text-xs text-gray-400">3d ago</span>
                      </div>
                      <p className="text-sm text-gray-400 truncate">The VFX test looks promising! I'll send you the final version soon.</p>
                    </div>
                  </div>
                </div>
                
                <Button className="w-full bg-gradient-to-r from-cinesphere-purple to-cinesphere-blue hover:from-cinesphere-purple/90 hover:to-cinesphere-blue/90">
                  New Message
                </Button>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default Feed;
