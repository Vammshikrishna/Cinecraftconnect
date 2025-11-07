import { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { EnhancedSkeleton, CardSkeleton } from '@/components/ui/enhanced-skeleton';
import { FloatingActionButton } from '@/components/ui/floating-action-button';
import { Plus } from 'lucide-react';

// Import our tab components
import FeedTab from '@/components/feed/FeedTab';
import FollowingFeedTab from '@/components/feed/FollowingFeedTab'; // Import the new component
import DiscussionRoomsTab from '@/components/feed/DiscussionRoomsTab';
import AnnouncementsTab from '@/components/feed/AnnouncementsTab';
import RatingsTab from '@/components/feed/RatingsTab';

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
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            <div className="lg:col-span-3 space-y-6">
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
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Main Feed */}
          <div className="lg:col-span-3">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
              <TabsList className="flex flex-wrap h-auto w-full mb-6">
                <TabsTrigger value="all" className="data-[state=active]:bg-primary">
                  All Posts
                </TabsTrigger>
                <TabsTrigger value="following" className="data-[state=active]:bg-primary">
                  Following
                </TabsTrigger>
                <TabsTrigger value="discussions" className="data-[state=active]:bg-primary">
                  Discussions
                </TabsTrigger>
                <TabsTrigger value="announcements" className="data-[state=active]:bg-primary">
                  Announcements
                </TabsTrigger>
                <TabsTrigger value="ratings" className="data-[state=active]:bg-primary">
                  Ratings
                </TabsTrigger>
              </TabsList>

              <TabsContent value="all" className="space-y-6">
                <FeedTab postRatings={postRatings} onRate={handleRate} />
              </TabsContent>
              
              <TabsContent value="following" className="space-y-6">
                <FollowingFeedTab />
              </TabsContent>
              
              <TabsContent value="discussions" className="space-y-6">
                <DiscussionRoomsTab />
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
