import { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { EnhancedSkeleton, CardSkeleton } from '@/components/ui/enhanced-skeleton';
import { FloatingActionButton } from '@/components/ui/floating-action-button';
import { Plus } from 'lucide-react';

// Import our tab components
import FeedTab from '@/components/feed/FeedTab';
import DiscussionRoomsTab from '@/components/feed/DiscussionRoomsTab';
import AnnouncementsTab from '@/components/feed/AnnouncementsTab';
import RatingsTab from '@/components/feed/RatingsTab';
import ProjectsTab from '@/components/feed/ProjectsTab';
import AllContentTab from '@/components/feed/AllContentTab';

const Feed = () => {
  const [activeTab, setActiveTab] = useState('all');
  const [loading, setLoading] = useState(true);
  const [postRatings, setPostRatings] = useState<{
    [postId: string]: number;
  }>({});

  useEffect(() => {
    // Simulate loading
    const timer = setTimeout(() => setLoading(false), 800);
    return () => clearTimeout(timer);
  }, []);

  const handleRate = (postId: string | number, rating: number) => {
    setPostRatings(curr => ({
      ...curr,
      [String(postId)]: rating
    }));
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background pt-20">
        <div className="container mx-auto px-4 pb-8">
          <div className="flex items-center justify-between mb-8">
            <EnhancedSkeleton className="h-8 w-48" />
            <EnhancedSkeleton className="h-10 w-32" />
          </div>
          <div className="max-w-4xl mx-auto">
            <div className="space-y-6">
              {[...Array(3)].map((_, i) => <CardSkeleton key={i} className="h-48" />)}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pt-20 relative">
      <div className="container mx-auto px-4 pb-8 animate-fade-in">
        <div className="max-w-4xl mx-auto">
          {/* Main Feed */}
          <div className="">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
              <TabsList className="flex flex-wrap h-auto w-full mb-6">
                <TabsTrigger value="all" className="data-[state=active]:bg-primary">
                  All
                </TabsTrigger>
                <TabsTrigger value="posts" className="data-[state=active]:bg-primary">
                  Posts
                </TabsTrigger>
                <TabsTrigger value="discussions" className="data-[state=active]:bg-primary">
                  Discussions
                </TabsTrigger>
                <TabsTrigger value="projects" className="data-[state=active]:bg-primary">
                  Projects
                </TabsTrigger>
                <TabsTrigger value="announcements" className="data-[state=active]:bg-primary">
                  Announcements
                </TabsTrigger>
                <TabsTrigger value="ratings" className="data-[state=active]:bg-primary">
                  Ratings
                </TabsTrigger>
              </TabsList>

              <TabsContent value="all" className="space-y-6">
                <AllContentTab postRatings={postRatings} onRate={handleRate} />
              </TabsContent>

              <TabsContent value="posts" className="space-y-6">
                <FeedTab postRatings={postRatings} onRate={handleRate} />
              </TabsContent>
              
              <TabsContent value="discussions" className="space-y-6">
                <DiscussionRoomsTab />
              </TabsContent>

              <TabsContent value="projects" className="space-y-6">
                <ProjectsTab />
              </TabsContent>
              
              <TabsContent value="announcements" className="space-y-6">
                <AnnouncementsTab />
              </TabsContent>
              
              <TabsContent value="ratings" className="space-y-6">
                <RatingsTab />
              </TabsContent>
            </Tabs>
          </div>

          {/* Sidebar */}
          
        </div>
        
        {/* Floating Action Button */}
        <FloatingActionButton icon={Plus} onClick={() => console.log('Create new post')} label="Create Post" variant="primary" />
      </div>
    </div>
  );
};

export default Feed;
