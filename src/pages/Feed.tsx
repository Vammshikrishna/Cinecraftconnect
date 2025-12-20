import { useState, useEffect, Suspense, lazy } from 'react';
import { EnhancedSkeleton } from '@/components/ui/enhanced-skeleton';
import UniversalCreateButton from '@/components/feed/UniversalCreateButton';

// Lazy load tab components
const HomeTab = lazy(() => import('@/components/feed/HomeTab'));

const FeedSkeleton = () => (
  <div className="min-h-screen bg-background pt-20">
    <div className="container mx-auto px-4 pb-8">
      <div className="max-w-4xl mx-auto">
        <div className="glass-card rounded-xl p-6">
          <div className="flex flex-wrap gap-2 mb-8">
            {[...Array(6)].map((_, i) => <EnhancedSkeleton key={i} className="h-8 w-24 rounded-full" />)}
          </div>
          <div className="space-y-6">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="border border-border/50 p-6 rounded-xl bg-card/50">
                <div className="flex items-center space-x-4 mb-4">
                  <EnhancedSkeleton className="h-12 w-12 rounded-full" />
                  <div className="space-y-2">
                    <EnhancedSkeleton className="h-4 w-[250px]" />
                    <EnhancedSkeleton className="h-3 w-[150px]" />
                  </div>
                </div>
                <EnhancedSkeleton className="h-32 w-full rounded-lg mb-4" />
                <div className="flex gap-4">
                  <EnhancedSkeleton className="h-8 w-20" />
                  <EnhancedSkeleton className="h-8 w-20" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  </div>
);

const Feed = ({ openCreate = false }: { openCreate?: boolean }) => {
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
          <Suspense fallback={<FeedSkeleton />}>
            <HomeTab postRatings={postRatings} onRate={handleRate} openCreate={openCreate} />
          </Suspense>
        </div>
        <UniversalCreateButton />
      </div>
    </div>
  );
};

export default Feed;
