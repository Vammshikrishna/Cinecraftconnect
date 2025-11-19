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
      <div className="container mx-auto px-4 pb-8 animate-fade-in">
        <div className="max-w-4xl mx-auto">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <TabsList className="grid w-full grid-cols-2 sm:grid-cols-3 md:grid-cols-6 h-auto">
              {TABS.map(({ value, label, Icon }) => (
                <TabsTrigger key={value} value={value} className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                  <Icon className="mr-2 h-4 w-4" /> {label}
                </TabsTrigger>
              ))}
            </TabsList>

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
