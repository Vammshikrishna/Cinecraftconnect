import { useState } from 'react';
import { EnhancedSkeleton, PostSkeleton } from '@/components/ui/enhanced-skeleton';
import SEO from '@/components/common/SEO';
import HomeTab from '@/components/feed/HomeTab';

export { FeedSkeleton } from '@/components/feed/FeedSkeleton';

const Feed = ({ openCreate = false }: { openCreate?: boolean }) => {
    const [postRatings, setPostRatings] = useState<{ [postId: string]: number }>({});

    const handleRate = (postId: string | number, rating: number) => {
        setPostRatings(curr => ({ ...curr, [String(postId)]: rating }));
    };

    return (
        <div className="min-h-screen bg-background pt-[68px] md:pt-20 relative">
            <SEO 
                title="Feed" 
                description="Explore the latest updates from the entertainment world. Follow creators, filmmakers, and industry professionals in your CineCraft feed." 
            />
            <div className="w-full md:container mx-auto px-0 md:px-8 pb-36 animate-fade-in">
                <div className="w-full">
                    <HomeTab postRatings={postRatings} onRate={handleRate} openCreate={openCreate} />
                </div>
            </div>
        </div>
    );
};

export default Feed;
