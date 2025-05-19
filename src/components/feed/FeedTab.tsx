
import { useState } from "react";
import PostCard from "./PostCard";
import CraftFilters from "./CraftFilters";

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

interface FeedTabProps {
  postRatings: { [postId: number]: number };
  onRate: (postId: number, rating: number) => void;
}

const FeedTab = ({ postRatings, onRate }: FeedTabProps) => {
  const [activeFilter, setActiveFilter] = useState("All");

  return (
    <>
      <CraftFilters
        activeFilter={activeFilter}
        onFilterChange={setActiveFilter}
      />
      
      <div className="space-y-6">
        {mockPosts.map((post) => (
          <PostCard
            key={post.id}
            id={post.id}
            author={post.author}
            timeAgo={post.timeAgo}
            content={post.content}
            hasImage={post.hasImage}
            imageAlt={post.imageAlt}
            hasVideo={post.hasVideo}
            videoThumbnail={post.videoThumbnail}
            isAIGenerated={post.isAIGenerated}
            likes={post.likes}
            comments={post.comments}
            tags={post.tags}
            rating={postRatings[post.id]}
            onRate={onRate}
          />
        ))}
      </div>
    </>
  );
};

export default FeedTab;
