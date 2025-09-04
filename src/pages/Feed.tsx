import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { EnhancedSkeleton, CardSkeleton } from '@/components/ui/enhanced-skeleton';
import { InteractiveCard } from '@/components/ui/interactive-card';
import { FloatingActionButton } from '@/components/ui/floating-action-button';
import { 
  Plus, 
  TrendingUp, 
  Activity, 
  Sparkles, 
  Rss 
} from 'lucide-react';

// Import our tab components
import FeedTab from '@/components/feed/FeedTab';
import DiscussionRoomsTab from '@/components/feed/DiscussionRoomsTab';
import ChatTab from '@/components/feed/ChatTab';
import AnnouncementsTab from '@/components/feed/AnnouncementsTab';
import RatingsTab from '@/components/feed/RatingsTab';
import { ActivityFeed } from '@/components/dashboard/ActivityFeed';
import RecommendationsPanel from '@/components/ai/RecommendationsPanel';
import EnhancedNotificationsCenter from '@/components/notifications/EnhancedNotificationsCenter';

const Feed = () => {
  const [activeTab, setActiveTab] = useState('all');
  const [loading, setLoading] = useState(true);
  const [postRatings, setPostRatings] = useState<{ [postId: string]: number }>({});

  useEffect(() => {
    // Simulate loading
    const timer = setTimeout(() => setLoading(false), 800);
    return () => clearTimeout(timer);
  }, []);

  const handleRate = (postId: string | number, rating: number) => {
    setPostRatings((curr) => ({ ...curr, [String(postId)]: rating }));
  };

  const trendingTopics = [
    { name: '#FilmMaking', posts: '2.1k' },
    { name: '#Cinematography', posts: '1.8k' },
    { name: '#PostProduction', posts: '1.5k' },
    { name: '#Screenwriting', posts: '1.2k' },
    { name: '#ActingTips', posts: '980' },
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-background pt-20">
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-between mb-8">
            <EnhancedSkeleton className="h-8 w-48" />
            <EnhancedSkeleton className="h-10 w-32" />
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            <div className="lg:col-span-3 space-y-6">
              {[...Array(3)].map((_, i) => (
                <CardSkeleton key={i} className="h-48" />
              ))}
            </div>
            <div className="space-y-6">
              <CardSkeleton className="h-32" />
              <CardSkeleton className="h-48" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pt-20 relative">
      <div className="container mx-auto px-4 py-8 animate-fade-in">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between mb-8 space-y-4 lg:space-y-0">
          <div>
            <h1 className="text-3xl font-bold text-foreground mb-2 flex items-center">
              <Rss className="mr-3 h-8 w-8 text-primary" />
              Community Feed
            </h1>
            <p className="text-muted-foreground">Discover and share creative content with the community</p>
          </div>
          <Button className="bg-primary hover:bg-primary/90 hover-glow">
            <Plus className="mr-2 h-4 w-4" />
            Create Post
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Main Feed */}
          <div className="lg:col-span-3">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
              <TabsList className="grid w-full grid-cols-5 mb-6">
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
                <FeedTab postRatings={postRatings} onRate={handleRate} />
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
          <div className="space-y-6">
            {/* Trending Topics */}
            <InteractiveCard
              title="Trending Topics"
              icon={TrendingUp}
              variant="hover-lift"
            >
              <div className="space-y-2">
                {trendingTopics.map((topic, index) => (
                  <div key={index} className="flex items-center justify-between p-2 rounded hover:bg-accent/50 transition-colors cursor-pointer click-effect">
                    <span className="text-sm font-medium">{topic.name}</span>
                    <Badge variant="secondary" className="text-xs">
                      {topic.posts}
                    </Badge>
                  </div>
                ))}
              </div>
            </InteractiveCard>

            {/* Notifications */}
            <EnhancedNotificationsCenter />

            {/* Activity Feed */}
            <InteractiveCard
              title="Recent Activity"
              icon={Activity}
              variant="glow"
            >
              <ActivityFeed />
            </InteractiveCard>

            {/* AI Recommendations */}
            <InteractiveCard
              title="Recommended for You"
              icon={Sparkles}
              variant="gradient"
            >
              <RecommendationsPanel />
            </InteractiveCard>
          </div>
        </div>
        
        {/* Floating Action Button */}
        <FloatingActionButton
          icon={Plus}
          onClick={() => console.log('Create new post')}
          label="Create Post"
          variant="primary"
        />
      </div>
    </div>
  );
};

export default Feed;