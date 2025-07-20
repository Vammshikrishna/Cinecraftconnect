
import { useState } from "react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Play, Video, MessageCircle } from "lucide-react";

// Import our new components
import FeedTab from "@/components/feed/FeedTab";
import DiscussionRoomsTab from "@/components/feed/DiscussionRoomsTab";
import ChatTab from "@/components/feed/ChatTab";

const Feed = () => {
  const [activeTab, setActiveTab] = useState("feed");
  const [postRatings, setPostRatings] = useState<{ [postId: string]: number }>({});

  const handleRate = (postId: string | number, rating: number) => {
    setPostRatings((curr) => ({ ...curr, [String(postId)]: rating }));
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
              <FeedTab
                postRatings={postRatings}
                onRate={handleRate}
              />
            </TabsContent>
            
            <TabsContent value="discussion">
              <DiscussionRoomsTab />
            </TabsContent>
            
            <TabsContent value="chats">
              <ChatTab />
            </TabsContent>
          </Tabs>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default Feed;
