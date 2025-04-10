
import { useState } from "react";
import { Link } from "react-router-dom";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Heart, MessageCircle, Share2, Film, Camera, PenTool, Music, Scissors } from "lucide-react";

// Mock data for posts
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
    likes: 67,
    comments: 12,
    tags: ["cinematography", "lighting", "musicvideo"]
  },
  {
    i: 3,
    author: {
      name: "James Wilson",
      role: "Production Designer",
      initials: "JW"
    },
    timeAgo: "1 day ago",
    content: "Just finished these concept sketches for our sci-fi short. Going for a retro-futuristic aesthetic inspired by 70s space films but with a modern twist.",
    hasImage: true,
    likes: 35,
    comments: 6,
    tags: ["productiondesign", "conceptart", "scifi"]
  }
];

// Craft filters for the feed
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
  
  return (
    <div className="min-h-screen bg-cinesphere-dark">
      <Navbar />
      <main className="pt-24 pb-16 px-4 md:px-8">
        <div className="max-w-4xl mx-auto">
          {/* Craft Filters */}
          <div className="mb-8 overflow-x-auto">
            <div className="flex space-x-2 min-w-max">
              {craftFilters.map((filter) => (
                <Button
                  key={filter.name}
                  variant={filter.active ? "default" : "outline"}
                  className={`px-4 py-2 rounded-full ${
                    filter.active 
                      ? "bg-cinesphere-purple hover:bg-cinesphere-purple/90" 
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
          
          {/* Posts Feed */}
          <div className="space-y-6">
            {mockPosts.map((post) => (
              <div key={post.id} className="glass-card rounded-xl p-6">
                {/* Post Header */}
                <div className="flex items-center mb-4">
                  <Avatar className="h-10 w-10 mr-3">
                    <AvatarImage src="/placeholder.svg" />
                    <AvatarFallback className="bg-cinesphere-purple/30 text-white">{post.author.initials}</AvatarFallback>
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
                
                {/* Post Content */}
                <p className="mb-4">{post.content}</p>
                
                {/* Post Image (if any) */}
                {post.hasImage && (
                  <div className="mb-4 rounded-lg overflow-hidden bg-cinesphere-dark/50 h-64 flex items-center justify-center">
                    <p className="text-gray-400">Image Placeholder</p>
                  </div>
                )}
                
                {/* Post Tags */}
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
                
                {/* Post Actions */}
                <div className="flex items-center justify-between pt-4 border-t border-white/10">
                  <Button variant="ghost" size="sm" className="text-gray-400 hover:text-white flex items-center">
                    <Heart size={18} className="mr-1" />
                    <span>{post.likes}</span>
                  </Button>
                  <Button variant="ghost" size="sm" className="text-gray-400 hover:text-white flex items-center">
                    <MessageCircle size={18} className="mr-1" />
                    <span>{post.comments}</span>
                  </Button>
                  <Button variant="ghost" size="sm" className="text-gray-400 hover:text-white">
                    <Share2 size={18} />
                  </Button>
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

export default Feed;
