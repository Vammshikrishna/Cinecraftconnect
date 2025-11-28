import { useState, useEffect, Suspense, lazy } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { FloatingActionButton } from '@/components/ui/floating-action-button';
import { Plus, MessageSquare, Briefcase, Star, Rss, LayoutGrid } from 'lucide-react';

// Lazy load tab components
const AllContentTab = lazy(() => import('@/components/feed/AllContentTab'));
const FeedTab = lazy(() => import('@/components/feed/FeedTab'));
const DiscussionRoomsTab = lazy(() => import('@/components/feed/DiscussionRoomsTab'));
const ProjectsTab = lazy(() => import('@/components/feed/ProjectsTab'));
const AnnouncementsTab = lazy(() => import('@/components/feed/AnnouncementsTab'));
const RatingsTab = lazy(() => import('@/components/feed/RatingsTab'));

const TABS = [
  { value: 'all', label: 'All', Icon: LayoutGrid, Component: AllContentTab },
  { value: 'posts', label: 'Posts', Icon: Rss, Component: FeedTab },
  { value: 'discussions', label: 'Discussions', Icon: MessageSquare, Component: DiscussionRoomsTab },
  { value: 'projects', label: 'Projects', Icon: Briefcase, Component: ProjectsTab },
  { value: 'announcements', label: 'Announcements', Icon: Star, Component: AnnouncementsTab },
  { value: 'ratings', label: 'Ratings', Icon: Star, Component: RatingsTab },
];

const FeedSkeleton = () => (
  <div className="min-h-screen bg-background pt-20">
    <div className="container mx-auto px-4 pb-8">
      <div className="max-w-4xl mx-auto">
        <Card>
          <CardHeader>
            <div className="flex flex-wrap gap-2 mb-4">
              {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-10 w-24" />)}
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="border p-4 rounded-lg">
                <div className="flex items-center space-x-4 mb-4">
                  <Skeleton className="h-12 w-12 rounded-full" />
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-[250px]" />
                    <Skeleton className="h-4 w-[200px]" />
                  </div>
                </div>
                <Skeleton className="h-32 w-full" />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  </div>
);

const Feed = () => {
  const [activeTab, setActiveTab] = useState(TABS[0].value);
  const [loading, setLoading] = useState(true);
  const [postRatings, setPostRatings] = useState<{ [postId: string]: number }>({});

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 800);
    return () => clearTimeout(timer);
  }, []);

  const handleRate = (postId: string | number, rating: number) => {
    setPostRatings(curr => ({ ...curr, [String(postId)]: rating }));
  };

  if (loading) {
    return <FeedSkeleton />;
  }

  return (
    <div className="min-h-screen bg-background pt-20 relative">
      <div className="container mx-auto px-4 pb-24 animate-fade-in">
        <div className="max-w-4xl mx-auto">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <div className="relative w-full mb-6">
              <div className="flex overflow-x-auto gap-2 pb-2 scrollbar-hide w-full" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                <TabsList className="flex h-auto bg-transparent gap-2 p-0">
                  {TABS.map(({ value, label, Icon }) => (
                    <TabsTrigger
                      key={value}
                      value={value}
                      className="flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all duration-300 border shrink-0 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:border-primary data-[state=active]:shadow-[0_0_15px_-3px_rgba(var(--primary),0.4)] data-[state=active]:scale-105 bg-secondary/30 border-transparent text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
                    >
                      <Icon className="h-3.5 w-3.5" />
                      {label}
                    </TabsTrigger>
                  ))}
                </TabsList>
                <div className="w-4 shrink-0" />
              </div>
              <div className="absolute right-0 top-0 bottom-2 w-12 bg-gradient-to-l from-background to-transparent pointer-events-none" />
              <div className="absolute left-0 top-0 bottom-2 w-4 bg-gradient-to-r from-background to-transparent pointer-events-none" />
            </div>

            <Suspense fallback={<FeedSkeleton />}>
              {TABS.map(({ value, Component }) => (
                <TabsContent key={value} value={value} className="space-y-6">
                  <Component postRatings={postRatings} onRate={handleRate} />
                </TabsContent>
              ))}
            </Suspense>
          </Tabs>
        </div>
        <FloatingActionButton icon={Plus} onClick={() => console.log('Create new post')} label="Create Post" variant="primary" />
      </div>
    </div>
  );
};

export default Feed;
